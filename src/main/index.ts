import { app, BrowserWindow, ipcMain } from "electron";
import { join } from "node:path";

const isDev = !app.isPackaged;
const startHidden = process.argv.includes("--hidden");

let settingsWindow: BrowserWindow | null = null;

function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const win = new BrowserWindow({
    width: 880,
    height: 600,
    minWidth: 720,
    minHeight: 520,
    show: false,
    backgroundColor: "#FAFAF7",
    title: "Tumaninah",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => {
    settingsWindow = null;
  });

  const devUrl = process.env["ELECTRON_RENDERER_URL"];
  if (isDev && devUrl) {
    void win.loadURL(`${devUrl}/settings/index.html`);
  } else {
    void win.loadFile(join(__dirname, "../renderer/settings/index.html"));
  }

  settingsWindow = win;
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    createSettingsWindow();
  });

  app.whenReady().then(() => {
    ipcMain.handle("app:ping", () => "pong" as const);

    if (!startHidden) {
      createSettingsWindow();
    }
  });

  app.on("window-all-closed", () => {
    // Tray keeps the app alive; do not quit when all windows close.
  });
}
