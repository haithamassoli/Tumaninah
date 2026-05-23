import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { IpcChannels } from "../shared/ipc";
import type {
  AdhkarImportPayload,
  AdhkarImportResult,
  AdhkarUpdatePayload,
  PausePayload,
} from "../shared/ipc";
import type { AppData, Dhikr, SchedulerStatus, Settings } from "../shared/types";
import type { Store } from "./store";

export interface SchedulerLike {
  getStatus(): SchedulerStatus;
  pauseUntil(iso: string): SchedulerStatus;
  resume(): SchedulerStatus;
  fireNow(): SchedulerStatus;
  rescheduleFromNow(): void;
}

export interface IpcDeps {
  store: Store;
  /** Scheduler is wired in M3; pass `undefined` until then. */
  scheduler?: SchedulerLike;
  /** Absolute path to data.json so the About tab can open its folder. */
  dataFilePath: string;
}

/**
 * Register all main-process IPC handlers. Returns a disposer that removes them.
 *
 * Every handler validates input and throws on invalid shapes — the renderer
 * sees these as rejected promises, which is the desired UX.
 */
export function registerIpc(deps: IpcDeps): () => void {
  const { store, scheduler, dataFilePath } = deps;

  const handlers: Array<[string, (...args: unknown[]) => unknown]> = [
    [IpcChannels.SettingsGet, () => store.getSettings()],
    [
      IpcChannels.SettingsSet,
      (_e, patch) => {
        assertObject(patch, "settings patch");
        const prev = store.getSettings();
        const next = store.setSettings(patch as Partial<Settings>);
        broadcast(IpcChannels.SettingsChanged, next);
        if (scheduler && next.intervalMinutes !== prev.intervalMinutes) {
          // Interval changed: requeue next fire from now.
          scheduler.rescheduleFromNow();
        }
        return next;
      },
    ],

    [IpcChannels.AdhkarList, () => store.getAdhkar()],
    [
      IpcChannels.AdhkarAdd,
      (_e, payload) => {
        const text = readText(payload, "adhkar:add");
        const dhikr = store.addDhikr(text);
        broadcast(IpcChannels.AdhkarChanged, store.getAdhkar());
        return dhikr;
      },
    ],
    [
      IpcChannels.AdhkarUpdate,
      (_e, payload) => {
        assertObject(payload, "adhkar:update");
        const p = payload as Partial<AdhkarUpdatePayload>;
        if (typeof p.id !== "string" || !p.id) throw new Error("Invalid id");
        if (typeof p.text !== "string") throw new Error("Invalid text");
        const dhikr = store.updateDhikr(p.id, p.text);
        broadcast(IpcChannels.AdhkarChanged, store.getAdhkar());
        return dhikr;
      },
    ],
    [
      IpcChannels.AdhkarDelete,
      (_e, payload) => {
        assertObject(payload, "adhkar:delete");
        const id = (payload as { id?: unknown }).id;
        if (typeof id !== "string" || !id) throw new Error("Invalid id");
        store.deleteDhikr(id);
        broadcast(IpcChannels.AdhkarChanged, store.getAdhkar());
        return { id };
      },
    ],
    [
      IpcChannels.AdhkarImport,
      (_e, payload): AdhkarImportResult => {
        assertObject(payload, "adhkar:import");
        const p = payload as Partial<AdhkarImportPayload>;
        if (!Array.isArray(p.texts)) throw new Error("texts must be an array of strings");
        const texts = p.texts.filter((t): t is string => typeof t === "string");
        const mode: "merge" | "replace" = p.mode === "replace" ? "replace" : "merge";
        const result = store.importAdhkar(texts, mode);
        broadcast(IpcChannels.AdhkarChanged, store.getAdhkar());
        return result;
      },
    ],
    [
      IpcChannels.AdhkarExport,
      () => ({ adhkar: store.getAdhkar().map((d: Dhikr) => d.text) }),
    ],

    [
      IpcChannels.SchedulerStatus,
      (): SchedulerStatus =>
        scheduler?.getStatus() ?? { nextFireAt: null, pausedUntil: store.getSettings().pausedUntil },
    ],
    [
      IpcChannels.SchedulerPause,
      (_e, payload): SchedulerStatus => {
        assertObject(payload, "scheduler:pause");
        const until = (payload as Partial<PausePayload>).until;
        if (typeof until !== "string" || Number.isNaN(Date.parse(until))) {
          throw new Error("Invalid pause timestamp");
        }
        if (scheduler) return scheduler.pauseUntil(until);
        store.setSettings({ pausedUntil: until });
        return { nextFireAt: null, pausedUntil: until };
      },
    ],
    [
      IpcChannels.SchedulerResume,
      (): SchedulerStatus => {
        if (scheduler) return scheduler.resume();
        store.setSettings({ pausedUntil: null });
        return { nextFireAt: null, pausedUntil: null };
      },
    ],
    [
      IpcChannels.SchedulerFireNow,
      (): SchedulerStatus =>
        scheduler?.fireNow() ?? { nextFireAt: null, pausedUntil: store.getSettings().pausedUntil },
    ],

    // NotificationDismiss + NotificationMeasure are owned by NotificationController.

    [IpcChannels.DataExportRaw, (): AppData => store.getData()],
    [
      IpcChannels.DataResetDefaults,
      (): AppData => {
        const data = store.resetToDefaults();
        broadcast(IpcChannels.SettingsChanged, data.settings);
        broadcast(IpcChannels.AdhkarChanged, data.adhkar);
        return data;
      },
    ],
    [
      IpcChannels.DataOpenFolder,
      async () => {
        await shell.openPath(dirname(dataFilePath));
      },
    ],

    [
      IpcChannels.DataImportDialog,
      async (event, payload): Promise<AdhkarImportResult | null> => {
        assertObject(payload, "data:importDialog");
        const mode: "merge" | "replace" =
          (payload as { mode?: unknown }).mode === "replace" ? "replace" : "merge";
        const parent = BrowserWindow.fromWebContents(
          (event as Electron.IpcMainInvokeEvent).sender,
        );
        const result = await (parent
          ? dialog.showOpenDialog(parent, openOpts())
          : dialog.showOpenDialog(openOpts()));
        if (result.canceled || result.filePaths.length === 0) return null;
        const filePath = result.filePaths[0]!;
        const raw = await readFile(filePath, "utf8");
        const texts = filePath.toLowerCase().endsWith(".json")
          ? parseJsonAdhkar(raw)
          : parseTxtAdhkar(raw);
        const importResult = store.importAdhkar(texts, mode);
        broadcast(IpcChannels.AdhkarChanged, store.getAdhkar());
        return importResult;
      },
    ],
    [
      IpcChannels.DataExportDialog,
      async (event, payload): Promise<{ path: string } | null> => {
        assertObject(payload, "data:exportDialog");
        const format: "json" | "txt" =
          (payload as { format?: unknown }).format === "txt" ? "txt" : "json";
        const parent = BrowserWindow.fromWebContents(
          (event as Electron.IpcMainInvokeEvent).sender,
        );
        const opts = saveOpts(format);
        const result = await (parent
          ? dialog.showSaveDialog(parent, opts)
          : dialog.showSaveDialog(opts));
        if (result.canceled || !result.filePath) return null;
        const texts = store.getAdhkar().map((d) => d.text);
        const payloadOut =
          format === "json"
            ? `${JSON.stringify({ adhkar: texts }, null, 2)}\n`
            : `${texts.join("\n")}\n`;
        await writeFile(result.filePath, payloadOut, "utf8");
        return { path: result.filePath };
      },
    ],
  ];

  for (const [channel, handler] of handlers) {
    ipcMain.handle(channel, handler as Parameters<typeof ipcMain.handle>[1]);
  }

  return () => {
    for (const [channel] of handlers) ipcMain.removeHandler(channel);
  };
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function assertObject(v: unknown, name: string): asserts v is Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) {
    throw new Error(`Invalid payload for ${name}`);
  }
}

function readText(payload: unknown, name: string): string {
  assertObject(payload, name);
  const text = (payload as { text?: unknown }).text;
  if (typeof text !== "string") throw new Error(`Invalid text for ${name}`);
  return text;
}

function openOpts(): Electron.OpenDialogOptions {
  return {
    title: "Import adhkar",
    properties: ["openFile"],
    filters: [
      { name: "Adhkar", extensions: ["json", "txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  };
}

function saveOpts(format: "json" | "txt"): Electron.SaveDialogOptions {
  return {
    title: "Export adhkar",
    defaultPath: format === "json" ? "adhkar.json" : "adhkar.txt",
    filters:
      format === "json"
        ? [{ name: "JSON", extensions: ["json"] }]
        : [{ name: "Text", extensions: ["txt"] }],
  };
}

function parseJsonAdhkar(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    if (parsed && typeof parsed === "object" && Array.isArray((parsed as { adhkar?: unknown }).adhkar)) {
      return ((parsed as { adhkar: unknown[] }).adhkar).filter(
        (v): v is string => typeof v === "string",
      );
    }
  } catch {
    // fall through
  }
  throw new Error('Invalid JSON. Expected { "adhkar": ["..."] } or a string array.');
}

function parseTxtAdhkar(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}
