import { Menu, Tray, nativeImage } from "electron";
import type { MenuItemConstructorOptions, NativeImage } from "electron";
import type { Scheduler } from "./scheduler";
import type { Store } from "./store";

export interface TrayDeps {
  scheduler: Scheduler;
  store: Store;
  openSettings: () => void;
  quit: () => void;
}

const TOOLTIP_PREFIX = "Tumaninah";

export class TrayController {
  private tray: Tray | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  private unsubStatus: (() => void) | null = null;

  constructor(private readonly deps: TrayDeps) {}

  start(): void {
    if (this.tray) return;
    const icon = buildPlaceholderIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip(TOOLTIP_PREFIX);
    this.tray.on("click", () => this.deps.openSettings());
    this.refreshMenu();
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), 1000);
    this.unsubStatus = this.deps.scheduler.onStatusChange(() => this.refreshMenu());
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.unsubStatus?.();
    this.unsubStatus = null;
    this.tray?.destroy();
    this.tray = null;
  }

  private tick(): void {
    if (!this.tray) return;
    this.tray.setToolTip(this.formatTooltip());
  }

  private formatTooltip(): string {
    const { nextFireAt, pausedUntil } = this.deps.scheduler.getStatus();
    if (pausedUntil) {
      const ts = Date.parse(pausedUntil);
      if (Number.isFinite(ts) && ts > Date.now()) {
        return `${TOOLTIP_PREFIX} — Paused until ${formatClock(new Date(ts))}`;
      }
    }
    if (nextFireAt) {
      const remaining = Math.max(0, nextFireAt - Date.now());
      return `${TOOLTIP_PREFIX} — Next dhikr in ${formatMMSS(remaining)}`;
    }
    return TOOLTIP_PREFIX;
  }

  private refreshMenu(): void {
    if (!this.tray) return;
    const paused = this.isPaused();

    const pauseSubmenu: MenuItemConstructorOptions[] = [
      { label: "30 minutes", click: () => this.pauseFor(30) },
      { label: "1 hour", click: () => this.pauseFor(60) },
      { label: "Until tomorrow 6:00 AM", click: () => this.pauseUntilTomorrow6() },
    ];
    if (paused) {
      pauseSubmenu.push(
        { type: "separator" },
        { label: "Resume", click: () => this.deps.scheduler.resume() },
      );
    }

    const template: MenuItemConstructorOptions[] = [
      { label: "Open Settings", click: () => this.deps.openSettings() },
      { label: "Show next dhikr now", click: () => this.deps.scheduler.fireNow() },
      { label: "Pause", submenu: pauseSubmenu },
      { type: "separator" },
      { label: "Quit", click: () => this.deps.quit() },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  private pauseFor(minutes: number): void {
    const until = new Date(Date.now() + minutes * 60_000).toISOString();
    this.deps.scheduler.pauseUntil(until);
  }

  private pauseUntilTomorrow6(): void {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
    this.deps.scheduler.pauseUntil(d.toISOString());
  }

  private isPaused(): boolean {
    const { pausedUntil } = this.deps.scheduler.getStatus();
    if (!pausedUntil) return false;
    const ts = Date.parse(pausedUntil);
    return Number.isFinite(ts) && ts > Date.now();
  }
}

function formatMMSS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// 16x16 monochrome dot. Real Win11 theme-aware assets land in M7.
function buildPlaceholderIcon(): NativeImage {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= r * r;
      // createFromBitmap expects BGRA on Windows/macOS.
      buf[i] = 30;
      buf[i + 1] = 30;
      buf[i + 2] = 30;
      buf[i + 3] = inside ? 230 : 0;
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}
