import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipc";
import type {
  AdhkarExportResult,
  AdhkarImportPayload,
  AdhkarImportResult,
  AdhkarUpdatePayload,
  NotificationFadeDonePayload,
  NotificationHoverPayload,
  NotificationShowPayload,
  PausePayload,
} from "../shared/ipc";
import type { AppData, Dhikr, SchedulerStatus, Settings } from "../shared/types";

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>;

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T): void => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  settings: {
    get: (): Promise<Settings> => invoke(IpcChannels.SettingsGet),
    set: (patch: Partial<Settings>): Promise<Settings> => invoke(IpcChannels.SettingsSet, patch),
    onChanged: (handler: (settings: Settings) => void): (() => void) =>
      subscribe(IpcChannels.SettingsChanged, handler),
  },

  adhkar: {
    list: (): Promise<Dhikr[]> => invoke(IpcChannels.AdhkarList),
    add: (text: string): Promise<Dhikr> => invoke(IpcChannels.AdhkarAdd, { text }),
    update: (payload: AdhkarUpdatePayload): Promise<Dhikr> =>
      invoke(IpcChannels.AdhkarUpdate, payload),
    delete: (id: string): Promise<{ id: string }> => invoke(IpcChannels.AdhkarDelete, { id }),
    import: (payload: AdhkarImportPayload): Promise<AdhkarImportResult> =>
      invoke(IpcChannels.AdhkarImport, payload),
    export: (): Promise<AdhkarExportResult> => invoke(IpcChannels.AdhkarExport),
    onChanged: (handler: (adhkar: Dhikr[]) => void): (() => void) =>
      subscribe(IpcChannels.AdhkarChanged, handler),
  },

  scheduler: {
    status: (): Promise<SchedulerStatus> => invoke(IpcChannels.SchedulerStatus),
    pause: (payload: PausePayload): Promise<SchedulerStatus> =>
      invoke(IpcChannels.SchedulerPause, payload),
    resume: (): Promise<SchedulerStatus> => invoke(IpcChannels.SchedulerResume),
    fireNow: (): Promise<SchedulerStatus> => invoke(IpcChannels.SchedulerFireNow),
    onStatusChanged: (handler: (status: SchedulerStatus) => void): (() => void) =>
      subscribe(IpcChannels.SchedulerStatusChanged, handler),
  },

  notification: {
    dismiss: (): Promise<void> => invoke(IpcChannels.NotificationDismiss),
    measure: (size: { width: number; height: number }): Promise<void> =>
      invoke(IpcChannels.NotificationMeasure, size),
    hover: (payload: NotificationHoverPayload): void => {
      ipcRenderer.send(IpcChannels.NotificationHover, payload);
    },
    fadeDone: (payload: NotificationFadeDonePayload): void => {
      ipcRenderer.send(IpcChannels.NotificationFadeDone, payload);
    },
    onShow: (handler: (payload: NotificationShowPayload) => void): (() => void) =>
      subscribe(IpcChannels.NotificationShow, handler),
  },

  data: {
    exportRaw: (): Promise<AppData> => invoke(IpcChannels.DataExportRaw),
    resetDefaults: (): Promise<AppData> => invoke(IpcChannels.DataResetDefaults),
    openFolder: (): Promise<void> => invoke(IpcChannels.DataOpenFolder),
  },
} as const;

export type TumaninahApi = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("tumaninah", api);
} else {
  (globalThis as unknown as { tumaninah: TumaninahApi }).tumaninah = api;
}
