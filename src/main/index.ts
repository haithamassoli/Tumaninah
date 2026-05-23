import { app, BrowserWindow, powerMonitor } from "electron";
import { join } from "node:path";
import { IpcChannels } from "../shared/ipc";
import { registerIpc } from "./ipc";
import { Scheduler } from "./scheduler";
import { Store } from "./store";
import { TrayController } from "./tray";

const isDev = !app.isPackaged;
const startHidden = process.argv.includes("--hidden");

let settingsWindow: BrowserWindow | null = null;
let store: Store | null = null;
let scheduler: Scheduler | null = null;
let tray: TrayController | null = null;
let disposeIpc: (() => void) | null = null;
let disposeStatusBroadcast: (() => void) | null = null;

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

function broadcastStatus(): void {
  if (!scheduler) return;
  const status = scheduler.getStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IpcChannels.SchedulerStatusChanged, status);
    }
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    createSettingsWindow();
  });

  app.whenReady().then(async () => {
    store = await Store.load();
    const dataFilePath = join(app.getPath("userData"), "data.json");

    // M4 owns the notification window. Until it lands, surface fires via log
    // so M3 timing/selection is observable end-to-end.
    scheduler = new Scheduler(store, (dhikr, reason) => {
      console.log(`[scheduler:${reason}] ${dhikr.text}`);
    });

    disposeIpc = registerIpc({ store, scheduler, dataFilePath });
    disposeStatusBroadcast = scheduler.onStatusChange(() => broadcastStatus());

    tray = new TrayController({
      scheduler,
      store,
      openSettings: () => createSettingsWindow(),
      quit: () => app.quit(),
    });
    tray.start();

    scheduler.start();

    powerMonitor.on("resume", () => scheduler?.rescheduleFromNow());

    if (!startHidden) {
      createSettingsWindow();
    }
  });

  app.on("window-all-closed", () => {
    // Tray keeps the app alive; do not quit when all windows close.
  });

  app.on("before-quit", async (event) => {
    if (!store) return;
    event.preventDefault();
    disposeStatusBroadcast?.();
    disposeStatusBroadcast = null;
    scheduler?.stop();
    scheduler = null;
    tray?.stop();
    tray = null;
    disposeIpc?.();
    disposeIpc = null;
    try {
      await store.flush();
    } finally {
      store = null;
      app.exit(0);
    }
  });
}
