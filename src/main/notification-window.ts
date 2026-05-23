import { BrowserWindow, ipcMain, screen } from "electron";
import { join } from "node:path";
import { IpcChannels } from "../shared/ipc";
import type {
  NotificationFadeDonePayload,
  NotificationHoverPayload,
  NotificationShowPayload,
} from "../shared/ipc";
import type { Dhikr } from "../shared/types";
import type { Store } from "./store";

const SCREEN_MARGIN_PX = 24;
const MAX_POPUP_WIDTH = 520;
const TEXT_HORIZONTAL_PADDING = 64;
const MIN_POPUP_WIDTH = 200;
const MIN_POPUP_HEIGHT = 80;

export interface NotificationControllerDeps {
  store: Store;
}

interface PendingShow {
  generation: number;
  payload: NotificationShowPayload;
}

/**
 * Owns the single pre-warmed frameless popup window. Each `present()` swaps
 * the displayed dhikr (replacement cancels the current fade per PRD §6.3).
 */
export class NotificationController {
  private window: BrowserWindow | null = null;
  private generation = 0;
  private isVisible = false;
  private pending: PendingShow | null = null;
  private readonly disposers: Array<() => void> = [];

  constructor(private readonly deps: NotificationControllerDeps) {
    this.registerIpc();
  }

  /** Show a dhikr immediately. Safe to call while another popup is on screen. */
  present(dhikr: Dhikr): void {
    const settings = this.deps.store.getSettings();
    this.generation += 1;
    const payload: NotificationShowPayload = {
      generation: this.generation,
      text: dhikr.text,
      fontSizePx: clamp(settings.fontSizePx, 14, 48),
      visibleDurationSeconds: clamp(settings.visibleDurationSeconds, 1, 60),
      theme: settings.theme,
    };

    const win = this.ensureWindow();
    if (win.webContents.isLoading()) {
      // Buffer until the renderer is ready; release on did-finish-load.
      this.pending = { generation: this.generation, payload };
      return;
    }
    this.sendShow(win, payload);
  }

  dispose(): void {
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }

  private sendShow(win: BrowserWindow, payload: NotificationShowPayload): void {
    win.webContents.send(IpcChannels.NotificationShow, payload);
  }

  private ensureWindow(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const isDev = !process.env["NODE_ENV"]?.includes("production");
    const win = new BrowserWindow({
      width: MIN_POPUP_WIDTH,
      height: MIN_POPUP_HEIGHT,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      focusable: false,
      alwaysOnTop: true,
      hasShadow: false,
      show: false,
      roundedCorners: false,
      backgroundColor: "#00000000",
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true, { forward: true });

    win.webContents.on("did-finish-load", () => {
      if (this.pending) {
        const { payload } = this.pending;
        this.pending = null;
        this.sendShow(win, payload);
      }
    });

    const devUrl = process.env["ELECTRON_RENDERER_URL"];
    if (isDev && devUrl) {
      void win.loadURL(`${devUrl}/notification/index.html`);
    } else {
      void win.loadFile(join(__dirname, "../renderer/notification/index.html"));
    }

    win.on("closed", () => {
      if (this.window === win) this.window = null;
      this.isVisible = false;
    });

    this.window = win;
    return win;
  }

  private registerIpc(): void {
    const onMeasure = (
      event: Electron.IpcMainInvokeEvent,
      payload: unknown,
    ): void => {
      if (!this.isOurSender(event)) return;
      if (!isMeasure(payload)) return;
      this.applyBoundsAndShow(payload.width, payload.height);
    };

    const onHover = (
      event: Electron.IpcMainEvent,
      payload: unknown,
    ): void => {
      if (!this.isOurSender(event)) return;
      if (!isHover(payload)) return;
      const win = this.window;
      if (!win || win.isDestroyed()) return;
      win.setIgnoreMouseEvents(!payload.hovering, { forward: true });
    };

    const onDismiss = (event: Electron.IpcMainInvokeEvent): void => {
      if (!this.isOurSender(event)) return;
      this.hide();
    };

    const onFadeDone = (
      event: Electron.IpcMainEvent,
      payload: unknown,
    ): void => {
      if (!this.isOurSender(event)) return;
      if (!isFadeDone(payload)) return;
      // Ignore stale fade-out completions from a replaced generation.
      if (payload.generation !== this.generation) return;
      this.hide();
    };

    ipcMain.handle(IpcChannels.NotificationMeasure, onMeasure);
    ipcMain.handle(IpcChannels.NotificationDismiss, onDismiss);

    ipcMain.on(IpcChannels.NotificationHover, onHover);
    ipcMain.on(IpcChannels.NotificationFadeDone, onFadeDone);

    this.disposers.push(() => {
      ipcMain.removeHandler(IpcChannels.NotificationMeasure);
      ipcMain.removeHandler(IpcChannels.NotificationDismiss);
      ipcMain.removeListener(IpcChannels.NotificationHover, onHover);
      ipcMain.removeListener(IpcChannels.NotificationFadeDone, onFadeDone);
    });
  }

  private isOurSender(
    event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent,
  ): boolean {
    return !!this.window && event.sender === this.window.webContents;
  }

  private applyBoundsAndShow(textWidth: number, textHeight: number): void {
    const win = this.window;
    if (!win || win.isDestroyed()) return;

    const width = Math.round(
      Math.max(MIN_POPUP_WIDTH, Math.min(textWidth + TEXT_HORIZONTAL_PADDING, MAX_POPUP_WIDTH)),
    );
    const height = Math.round(Math.max(MIN_POPUP_HEIGHT, textHeight));

    const { x, y } = this.computeAnchor(width, height);
    win.setBounds({ x, y, width, height });

    if (!this.isVisible) {
      win.showInactive();
      this.isVisible = true;
    }
  }

  private hide(): void {
    const win = this.window;
    if (!win || win.isDestroyed()) return;
    win.hide();
    win.setIgnoreMouseEvents(true, { forward: true });
    this.isVisible = false;
  }

  private computeAnchor(width: number, height: number): { x: number; y: number } {
    const settings = this.deps.store.getSettings();
    const cursor = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursor);
    const wa = display.workArea;
    const m = SCREEN_MARGIN_PX;

    const xLeft = wa.x + m;
    const xCenter = wa.x + Math.round((wa.width - width) / 2);
    const xRight = wa.x + wa.width - width - m;
    const yTop = wa.y + m;
    const yCenter = wa.y + Math.round((wa.height - height) / 2);
    const yBottom = wa.y + wa.height - height - m;

    switch (settings.popupPosition) {
      case "top-left":
        return { x: xLeft, y: yTop };
      case "top-center":
        return { x: xCenter, y: yTop };
      case "top-right":
        return { x: xRight, y: yTop };
      case "center":
        return { x: xCenter, y: yCenter };
      case "bottom-left":
        return { x: xLeft, y: yBottom };
      case "bottom-center":
        return { x: xCenter, y: yBottom };
      case "bottom-right":
        return { x: xRight, y: yBottom };
      default:
        return { x: xRight, y: yTop };
    }
  }
}

function isMeasure(v: unknown): v is { width: number; height: number } {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { width?: unknown }).width === "number" &&
    typeof (v as { height?: unknown }).height === "number"
  );
}

function isHover(v: unknown): v is NotificationHoverPayload {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { hovering?: unknown }).hovering === "boolean"
  );
}

function isFadeDone(v: unknown): v is NotificationFadeDonePayload {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { generation?: unknown }).generation === "number"
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
