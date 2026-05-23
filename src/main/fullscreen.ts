import { spawn } from "node:child_process";

/**
 * Fullscreen-foreground detection for Windows.
 *
 * Dependency choice: neither `node-active-window` nor `win-fullscreen`.
 * Both ship native bindings that drag node-gyp / prebuilt headaches into the
 * installer for a single boolean check that runs at most every 5s. We instead
 * shell out to PowerShell with an inline P/Invoke that asks Win32 the same
 * question the C++ libs would. Zero native deps, zero install-time risk,
 * trivially auditable. Cost: ~150ms per poll — irrelevant at a 5s cadence.
 *
 * The polling only runs when `respectFullscreen === true`; otherwise the
 * detector stays dormant and `isForegroundFullscreen()` returns `false`.
 */

const POLL_MS = 5_000;
const QUERY_TIMEOUT_MS = 2_500;

const PS_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Fs {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
  [DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO {
    public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags;
  }
}
"@
$h = [Fs]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero -or $h -eq [Fs]::GetShellWindow() -or $h -eq [Fs]::GetDesktopWindow()) { '0'; exit }
$w = New-Object Fs+RECT
if (-not [Fs]::GetWindowRect($h, [ref]$w)) { '0'; exit }
$mi = New-Object Fs+MONITORINFO
$mi.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($mi)
$mon = [Fs]::MonitorFromWindow($h, 2)
if (-not [Fs]::GetMonitorInfo($mon, [ref]$mi)) { '0'; exit }
$m = $mi.rcMonitor
if ($w.L -le $m.L -and $w.T -le $m.T -and $w.R -ge $m.R -and $w.B -ge $m.B) { '1' } else { '0' }
`.trim();

export class FullscreenDetector {
  private timer: NodeJS.Timeout | null = null;
  private active = false;
  private fullscreen = false;
  private inFlight: Promise<void> | null = null;

  /** Enable polling (called when respectFullscreen flips on). */
  enable(): void {
    if (process.platform !== "win32") return;
    if (this.active) return;
    this.active = true;
    void this.poll();
    this.timer = setInterval(() => void this.poll(), POLL_MS);
  }

  /** Stop polling and clear cached state. */
  disable(): void {
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.fullscreen = false;
  }

  /** Sync the detector to the current setting value. */
  sync(respectFullscreen: boolean): void {
    if (respectFullscreen) this.enable();
    else this.disable();
  }

  /** Last cached value. Cheap; safe to call during a fire decision. */
  isForegroundFullscreen(): boolean {
    return this.fullscreen;
  }

  dispose(): void {
    this.disable();
  }

  private poll(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.queryOnce()
      .then((v) => {
        if (this.active) this.fullscreen = v;
      })
      .catch(() => {
        // On any failure, fail-open: don't block fires.
        if (this.active) this.fullscreen = false;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  private queryOnce(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", PS_SCRIPT],
        { windowsHide: true },
      );
      let out = "";
      const killTimer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // ignore
        }
        reject(new Error("fullscreen query timeout"));
      }, QUERY_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => {
        out += chunk.toString("utf8");
      });
      child.on("error", (err) => {
        clearTimeout(killTimer);
        reject(err);
      });
      child.on("close", () => {
        clearTimeout(killTimer);
        resolve(out.trim() === "1");
      });
    });
  }
}
