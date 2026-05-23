import { app } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { DATA_VERSION, DEFAULT_SETTINGS, SEED_ADHKAR } from "../shared/defaults";
import { DHIKR_MAX_LENGTH } from "../shared/ipc";
import type { AppData, Dhikr, Settings } from "../shared/types";

const DEBOUNCE_MS = 250;

export interface StoreHooks {
  onChange?: (data: AppData) => void;
}

export class Store {
  private data: AppData;
  private readonly filePath: string;
  private writeTimer: NodeJS.Timeout | null = null;
  private writing = false;
  private writeQueued = false;
  private hooks: StoreHooks = {};

  private constructor(filePath: string, data: AppData) {
    this.filePath = filePath;
    this.data = data;
  }

  static async load(opts?: { userDataDir?: string; hooks?: StoreHooks }): Promise<Store> {
    const dir = opts?.userDataDir ?? app.getPath("userData");
    const filePath = join(dir, "data.json");
    await mkdir(dir, { recursive: true });

    let data: AppData;
    try {
      const raw = await readFile(filePath, "utf8");
      data = migrate(JSON.parse(raw));
    } catch (err) {
      if (isNotFound(err)) {
        data = seed();
        await atomicWrite(filePath, data);
      } else {
        // Corrupt file: back it up and reseed rather than crash.
        try {
          await rename(filePath, `${filePath}.corrupt-${Date.now()}`);
        } catch {
          // ignore
        }
        data = seed();
        await atomicWrite(filePath, data);
      }
    }

    const store = new Store(filePath, data);
    if (opts?.hooks) store.hooks = opts.hooks;
    return store;
  }

  getData(): AppData {
    return structuredClone(this.data);
  }

  getSettings(): Settings {
    return { ...this.data.settings };
  }

  getAdhkar(): Dhikr[] {
    return this.data.adhkar.map((d) => ({ ...d }));
  }

  setSettings(patch: Partial<Settings>): Settings {
    const next: Settings = { ...this.data.settings, ...sanitizeSettings(patch) };
    this.data = { ...this.data, settings: next };
    this.scheduleWrite();
    this.hooks.onChange?.(this.getData());
    return { ...next };
  }

  addDhikr(text: string): Dhikr {
    const clean = normalizeText(text);
    assertNonEmpty(clean);
    assertLength(clean);
    if (this.data.adhkar.some((d) => d.text === clean)) {
      const existing = this.data.adhkar.find((d) => d.text === clean);
      if (existing) return { ...existing };
    }
    const dhikr: Dhikr = { id: randomUUID(), text: clean };
    this.data = { ...this.data, adhkar: [...this.data.adhkar, dhikr] };
    this.scheduleWrite();
    this.hooks.onChange?.(this.getData());
    return { ...dhikr };
  }

  updateDhikr(id: string, text: string): Dhikr {
    const clean = normalizeText(text);
    assertNonEmpty(clean);
    assertLength(clean);
    const idx = this.data.adhkar.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error(`Dhikr not found: ${id}`);
    const next = [...this.data.adhkar];
    next[idx] = { id, text: clean };
    this.data = { ...this.data, adhkar: next };
    this.scheduleWrite();
    this.hooks.onChange?.(this.getData());
    return { id, text: clean };
  }

  deleteDhikr(id: string): boolean {
    const before = this.data.adhkar.length;
    const next = this.data.adhkar.filter((d) => d.id !== id);
    if (next.length === before) return false;
    this.data = { ...this.data, adhkar: next };
    this.scheduleWrite();
    this.hooks.onChange?.(this.getData());
    return true;
  }

  importAdhkar(
    texts: string[],
    mode: "merge" | "replace",
  ): { added: number; skipped: number; total: number } {
    const cleaned: string[] = [];
    const seen = new Set<string>();
    for (const raw of texts) {
      const t = normalizeText(raw);
      if (!t) continue;
      if (t.length > DHIKR_MAX_LENGTH) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      cleaned.push(t);
    }

    if (mode === "replace") {
      const adhkar = cleaned.map((text) => ({ id: randomUUID(), text }));
      this.data = { ...this.data, adhkar };
      this.scheduleWrite();
      this.hooks.onChange?.(this.getData());
      return { added: adhkar.length, skipped: 0, total: adhkar.length };
    }

    const existing = new Set(this.data.adhkar.map((d) => d.text));
    let added = 0;
    let skipped = 0;
    const newOnes: Dhikr[] = [];
    for (const text of cleaned) {
      if (existing.has(text)) {
        skipped += 1;
      } else {
        newOnes.push({ id: randomUUID(), text });
        existing.add(text);
        added += 1;
      }
    }
    if (newOnes.length > 0) {
      this.data = { ...this.data, adhkar: [...this.data.adhkar, ...newOnes] };
      this.scheduleWrite();
      this.hooks.onChange?.(this.getData());
    }
    return { added, skipped, total: this.data.adhkar.length };
  }

  resetToDefaults(): AppData {
    this.data = seed();
    this.scheduleWrite();
    this.hooks.onChange?.(this.getData());
    return this.getData();
  }

  /** Force pending write to disk now (used on quit). */
  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    await this.performWrite();
  }

  private scheduleWrite(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.performWrite();
    }, DEBOUNCE_MS);
  }

  private async performWrite(): Promise<void> {
    if (this.writing) {
      this.writeQueued = true;
      return;
    }
    this.writing = true;
    try {
      await atomicWrite(this.filePath, this.data);
    } finally {
      this.writing = false;
      if (this.writeQueued) {
        this.writeQueued = false;
        await this.performWrite();
      }
    }
  }
}

function seed(): AppData {
  return {
    version: DATA_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    adhkar: SEED_ADHKAR.map((text) => ({ id: randomUUID(), text })),
  };
}

function migrate(parsed: unknown): AppData {
  if (!isRecord(parsed)) return seed();

  const version =
    typeof parsed["version"] === "number" && Number.isFinite(parsed["version"])
      ? (parsed["version"] as number)
      : DATA_VERSION;

  const settings = sanitizeSettings(
    isRecord(parsed["settings"]) ? (parsed["settings"] as Partial<Settings>) : {},
    DEFAULT_SETTINGS,
  );

  const adhkar = Array.isArray(parsed["adhkar"])
    ? (parsed["adhkar"] as unknown[])
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const text = normalizeText(String(entry["text"] ?? ""));
          if (!text || text.length > DHIKR_MAX_LENGTH) return null;
          const id = typeof entry["id"] === "string" && entry["id"] ? entry["id"] : randomUUID();
          return { id, text } as Dhikr;
        })
        .filter((d): d is Dhikr => d !== null)
    : SEED_ADHKAR.map((text) => ({ id: randomUUID(), text }));

  return { version, settings, adhkar };
}

async function atomicWrite(filePath: string, data: AppData): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  try {
    await writeFile(tmp, payload, { encoding: "utf8" });
    await rename(tmp, filePath);
  } catch (err) {
    try {
      await unlink(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}

function sanitizeSettings(
  patch: Partial<Settings>,
  base: Settings = DEFAULT_SETTINGS,
): Settings {
  const out: Settings = { ...base };

  if (typeof patch.intervalMinutes === "number" && Number.isFinite(patch.intervalMinutes)) {
    out.intervalMinutes = clamp(Math.round(patch.intervalMinutes), 5, 240);
  }
  if (typeof patch.autoStart === "boolean") out.autoStart = patch.autoStart;
  if (typeof patch.respectFullscreen === "boolean") out.respectFullscreen = patch.respectFullscreen;
  if (patch.theme === "system" || patch.theme === "light" || patch.theme === "dark") {
    out.theme = patch.theme;
  }
  if (isPopupPosition(patch.popupPosition)) out.popupPosition = patch.popupPosition;
  if (
    typeof patch.visibleDurationSeconds === "number" &&
    Number.isFinite(patch.visibleDurationSeconds)
  ) {
    out.visibleDurationSeconds = clamp(Math.round(patch.visibleDurationSeconds), 3, 15);
  }
  if (typeof patch.fontSizePx === "number" && Number.isFinite(patch.fontSizePx)) {
    out.fontSizePx = clamp(Math.round(patch.fontSizePx), 16, 36);
  }
  if (typeof patch.soundEnabled === "boolean") out.soundEnabled = patch.soundEnabled;
  if (patch.pausedUntil === null) {
    out.pausedUntil = null;
  } else if (typeof patch.pausedUntil === "string") {
    const ts = Date.parse(patch.pausedUntil);
    out.pausedUntil = Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  return out;
}

function isPopupPosition(v: unknown): v is Settings["popupPosition"] {
  return (
    v === "top-left" ||
    v === "top-center" ||
    v === "top-right" ||
    v === "center" ||
    v === "bottom-left" ||
    v === "bottom-center" ||
    v === "bottom-right"
  );
}

function normalizeText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

function assertNonEmpty(s: string): void {
  if (!s) throw new Error("Dhikr text cannot be empty");
}

function assertLength(s: string): void {
  if (s.length > DHIKR_MAX_LENGTH) {
    throw new Error(`Dhikr text exceeds ${DHIKR_MAX_LENGTH} characters`);
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNotFound(err: unknown): boolean {
  return isRecord(err) && (err as { code?: string }).code === "ENOENT";
}
