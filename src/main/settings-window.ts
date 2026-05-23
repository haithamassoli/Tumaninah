import { app, BrowserWindow, nativeTheme } from "electron";
import { join } from "node:path";
import type { Store } from "./store";

export interface SettingsWindowDeps {
  store: Store;
}

/**
 * Lifecycle owner for the Settings window. Created lazily; toggling from tray
 * left-click hides without destroying so reopen is instant.
 */
export class SettingsWindowController {
  private win: BrowserWindow | null = null;

  constructor(private readonly deps: SettingsWindowDeps) {}

  open(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) {
      if (!this.win.isVisible()) this.win.show();
      this.win.focus();
      return this.win;
    }

    const theme = this.deps.store.getSettings().theme;
    const effectiveDark =
      theme === "dark" || (theme === "system" && nativeTheme.shouldUseDarkColors);

    const win = new BrowserWindow({
      width: 880,
      height: 600,
      minWidth: 720,
      minHeight: 520,
      show: false,
      backgroundColor: effectiveDark ? "#0E0E10" : "#FAFAF7",
      title: "Tumaninah",
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    win.removeMenu();
    win.once("ready-to-show", () => win.show());
    win.on("closed", () => {
      if (this.win === win) this.win = null;
    });

    const devUrl = process.env["ELECTRON_RENDERER_URL"];
    if (!app.isPackaged && devUrl) {
      void win.loadURL(`${devUrl}/settings/index.html`);
    } else {
      void win.loadFile(join(__dirname, "../renderer/settings/index.html"));
    }

    this.win = win;
    return win;
  }

  toggle(): void {
    if (this.win && !this.win.isDestroyed() && this.win.isVisible()) {
      this.win.hide();
      return;
    }
    this.open();
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.close();
  }

  current(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null;
  }
}
