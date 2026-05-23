import { app } from "electron";
import type { Settings } from "../shared/types";

/**
 * Bind Windows auto-start to settings.autoStart. Launches silently with
 * `--hidden` so the app boots tray-only without flashing a window.
 *
 * No-op on non-Windows platforms — `setLoginItemSettings` ignores `args`
 * outside macOS/Windows, and we never ship to Linux/macOS.
 */
export function applyAutostart(settings: Pick<Settings, "autoStart">): void {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({
    openAtLogin: settings.autoStart,
    openAsHidden: true,
    args: ["--hidden"],
  });
}

export function getAutostartStatus(): { openAtLogin: boolean } {
  if (process.platform !== "win32" && process.platform !== "darwin") {
    return { openAtLogin: false };
  }
  return { openAtLogin: app.getLoginItemSettings().openAtLogin };
}
