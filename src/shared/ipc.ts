import type { AppData, Dhikr, SchedulerStatus, Settings } from "./types";

export const IpcChannels = {
  SettingsGet: "settings:get",
  SettingsSet: "settings:set",
  SettingsChanged: "settings:changed",

  AdhkarList: "adhkar:list",
  AdhkarAdd: "adhkar:add",
  AdhkarUpdate: "adhkar:update",
  AdhkarDelete: "adhkar:delete",
  AdhkarImport: "adhkar:import",
  AdhkarExport: "adhkar:export",
  AdhkarChanged: "adhkar:changed",

  SchedulerStatus: "scheduler:status",
  SchedulerPause: "scheduler:pause",
  SchedulerResume: "scheduler:resume",
  SchedulerFireNow: "scheduler:fireNow",
  SchedulerStatusChanged: "scheduler:status-changed",

  NotificationDismiss: "notification:dismiss",
  NotificationMeasure: "notification:measure",
  NotificationDhikr: "notification:dhikr",

  DataExportRaw: "data:export",
  DataResetDefaults: "data:reset",
  DataOpenFolder: "data:openFolder",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export interface AdhkarUpdatePayload {
  id: string;
  text: string;
}

export interface AdhkarImportPayload {
  texts: string[];
  mode: "merge" | "replace";
}

export interface AdhkarImportResult {
  added: number;
  skipped: number;
  total: number;
}

export interface AdhkarExportResult {
  adhkar: string[];
}

export interface PausePayload {
  /** Absolute ISO timestamp until which the scheduler is paused. */
  until: string;
}

export interface IpcContract {
  [IpcChannels.SettingsGet]: { request: void; response: Settings };
  [IpcChannels.SettingsSet]: { request: Partial<Settings>; response: Settings };

  [IpcChannels.AdhkarList]: { request: void; response: Dhikr[] };
  [IpcChannels.AdhkarAdd]: { request: { text: string }; response: Dhikr };
  [IpcChannels.AdhkarUpdate]: { request: AdhkarUpdatePayload; response: Dhikr };
  [IpcChannels.AdhkarDelete]: { request: { id: string }; response: { id: string } };
  [IpcChannels.AdhkarImport]: { request: AdhkarImportPayload; response: AdhkarImportResult };
  [IpcChannels.AdhkarExport]: { request: void; response: AdhkarExportResult };

  [IpcChannels.SchedulerStatus]: { request: void; response: SchedulerStatus };
  [IpcChannels.SchedulerPause]: { request: PausePayload; response: SchedulerStatus };
  [IpcChannels.SchedulerResume]: { request: void; response: SchedulerStatus };
  [IpcChannels.SchedulerFireNow]: { request: void; response: SchedulerStatus };

  [IpcChannels.NotificationDismiss]: { request: void; response: void };
  [IpcChannels.NotificationMeasure]: {
    request: { width: number; height: number };
    response: void;
  };

  [IpcChannels.DataExportRaw]: { request: void; response: AppData };
  [IpcChannels.DataResetDefaults]: { request: void; response: AppData };
  [IpcChannels.DataOpenFolder]: { request: void; response: void };
}

export const DHIKR_MAX_LENGTH = 280;
