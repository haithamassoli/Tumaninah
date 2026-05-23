export type Theme = "system" | "light" | "dark";

export type PopupPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Settings {
  intervalMinutes: number;
  autoStart: boolean;
  respectFullscreen: boolean;
  theme: Theme;
  popupPosition: PopupPosition;
  visibleDurationSeconds: number;
  fontSizePx: number;
  soundEnabled: boolean;
  pausedUntil: string | null;
}

export interface Dhikr {
  id: string;
  text: string;
}

export interface AppData {
  version: number;
  settings: Settings;
  adhkar: Dhikr[];
}

export interface SchedulerStatus {
  nextFireAt: number | null;
  pausedUntil: string | null;
}
