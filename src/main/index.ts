import { app, BrowserWindow, powerMonitor } from "electron";
import { join } from "node:path";
import { IpcChannels } from "../shared/ipc";
import { registerIpc } from "./ipc";
import { NotificationController } from "./notification-window";
import { Scheduler } from "./scheduler";
import { SettingsWindowController } from "./settings-window";
import { Store } from "./store";
import { TrayController } from "./tray";

const startHidden = process.argv.includes("--hidden");

let store: Store | null = null;
let scheduler: Scheduler | null = null;
let tray: TrayController | null = null;
let notifications: NotificationController | null = null;
let settings: SettingsWindowController | null = null;
let disposeIpc: (() => void) | null = null;
let disposeStatusBroadcast: (() => void) | null = null;

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
    settings?.open();
  });

  app.whenReady().then(async () => {
    store = await Store.load();
    const dataFilePath = join(app.getPath("userData"), "data.json");

    notifications = new NotificationController({ store });
    scheduler = new Scheduler(store, (dhikr) => {
      notifications?.present(dhikr);
    });
    settings = new SettingsWindowController({ store });

    disposeIpc = registerIpc({ store, scheduler, dataFilePath });
    disposeStatusBroadcast = scheduler.onStatusChange(() => broadcastStatus());

    tray = new TrayController({
      scheduler,
      store,
      openSettings: () => settings?.toggle(),
      quit: () => app.quit(),
    });
    tray.start();

    scheduler.start();

    powerMonitor.on("resume", () => scheduler?.rescheduleFromNow());

    if (!startHidden) {
      settings.open();
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
    notifications?.dispose();
    notifications = null;
    settings?.close();
    settings = null;
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
