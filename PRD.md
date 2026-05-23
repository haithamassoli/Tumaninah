# Tumaninah (طمأنينة) — PRD

## Summary

Tumaninah is a Windows desktop app that quietly reminds the user of Islamic adhkar (remembrances) at fixed intervals via a custom, frameless, transparent popup that fades in over all windows without stealing focus or blocking clicks. It runs from the system tray with minimal resource use, ships an editable Arabic-only adhkar library, and is built on the latest Electron. The aesthetic is minimal: typography-led, RTL, with dark/light/system themes.

---

## 1. Goals

- Deliver brief, non-disruptive dhikr reminders that respect the user's flow.
- Look calm and intentional — typography, whitespace, smooth fades; nothing else.
- Stay invisible until it speaks: tray-resident, low CPU/RAM, no native toasts.
- Let the user own the content: edit, add, delete adhkar in a flat list stored as JSON.

## 2. Non-Goals (v1)

- No prayer-time integration, Qibla, Hijri calendar, or Quran features.
- No translations or transliteration (Arabic-only).
- No cloud sync, accounts, telemetry, or analytics.
- No macOS / Linux builds.
- No auto-update channel (manual download for v1).
- No categories, tags, or favorites for adhkar.

## 3. Target User

A Muslim Windows user who wants gentle, frequent reminders of Allah throughout the workday without breaking focus. Comfortable reading Arabic. Values minimalism and silence over features.

---

## 4. Tech Stack

- **Runtime:** Latest stable Electron.
- **Language:** TypeScript (strict).
- **Renderer UI:** React + Vite, RTL by default.
- **Styling:** Tailwind CSS with CSS variables for theme tokens.
- **State:** Zustand (renderer) + a single source-of-truth JSON on disk (main).
- **IPC:** Electron `ipcMain` / `ipcRenderer` with a typed preload bridge (`contextIsolation: true`, `nodeIntegration: false`).
- **Persistence:** Plain JSON file at `%APPDATA%/Tumaninah/data.json`.
- **Packaging:** electron-builder, NSIS installer, per-user install.
- **Font:** IBM Plex Sans Arabic, bundled locally (no network fetch).

---

## 5. Architecture

### Processes

1. **Main process** — owns lifecycle, tray, scheduler, JSON I/O, auto-start registration, window creation.
2. **Settings renderer** — React app inside a normal `BrowserWindow`, hidden until invoked.
3. **Notification renderer** — separate frameless, transparent `BrowserWindow` created on each fire (or pre-warmed once and reused). Single-instance; replacing an active popup tears down its DOM state and re-renders.

### Single Source of Truth

The main process owns `data.json`. Renderers read/write through IPC channels only:

- `settings:get`, `settings:set`
- `adhkar:list`, `adhkar:add`, `adhkar:update`, `adhkar:delete`, `adhkar:import`, `adhkar:export`
- `scheduler:status`, `scheduler:pause`, `scheduler:resume`, `scheduler:fireNow`
- `notification:dismiss`

### Scheduler

A single `setTimeout` chain in the main process. On fire:

1. Pick a random dhikr (uniform; avoid immediate repeat if `adhkar.length > 1`).
2. Check pause state and "respect fullscreen" setting (see §10).
3. Show the notification window with the chosen text.
4. Schedule the next fire = `now + intervalMinutes * 60_000`.

The scheduler is recomputed on settings change, pause/resume, and Wake from sleep (`powerMonitor` `resume` event → reschedule).

---

## 6. Core Features

### 6.1 System Tray

- Custom tray icon (monochrome, theme-aware on Windows 11).
- Tooltip: `Tumaninah — Next dhikr in MM:SS` (or `Paused`).
- Context menu:
  - **Open Settings**
  - **Show next dhikr now**
  - **Pause** ▸ submenu: `30 minutes`, `1 hour`, `Until tomorrow 6:00 AM`, `Resume` (last item shown only when paused)
  - separator
  - **Quit**
- Left-click toggles the Settings window.

### 6.2 Scheduler

- Interval is a fixed minute count, user-configurable (range 5–240, default 60).
- Selection: uniform random from active adhkar; never immediate repeat.
- Pause states are persisted so a restart preserves "Paused until 2026-05-24 06:00".
- Manual fire (`Show next dhikr now`) does **not** reset the interval timer.

### 6.3 Notification Popup — The Critical Component

**Window flags:**

```ts
new BrowserWindow({
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
  webPreferences: { contextIsolation: true, sandbox: true, preload },
});
win.setAlwaysOnTop(true, "screen-saver");
win.setVisibleOnAllWorkspaces(true);
win.setIgnoreMouseEvents(true, { forward: true });
```

**Behavior:**

- **Always on top** above fullscreen windows where the OS permits (`"screen-saver"` level).
- **No focus stealing:** `focusable: false` and never call `.focus()`/`.show()`-with-focus; use `showInactive()`.
- **Click-through by default:** `setIgnoreMouseEvents(true, { forward: true })`. The renderer listens for `mousemove` and toggles interactivity only when the cursor is over the popup's bounds, then reverts on leave.
- **Dismissal:** when interactive (hover), a small `×` icon appears top-corner; clicking it or anywhere on the body dismisses immediately. Otherwise the window auto-dismisses after the visible duration.
- **Queueing:** if a new dhikr is due while one is on screen, the current popup is replaced (cancel fade, swap text, restart fade-in).
- **Animation:** 400ms ease-out fade-in, hold `visibleDurationSeconds`, 400ms ease-in fade-out, then `window.destroy()` (or hide if pre-warmed).
- **Position:** placed on the display containing the cursor (active display) at one of seven anchors:
  `top-left`, `top-center`, `top-right` (default), `center`, `bottom-left`, `bottom-center`, `bottom-right`. Margins: 24px from screen edges.
- **Sizing:** width = `min(textWidth + 64px, maxWidth)`, where `maxWidth = 520px`. Height = content (line-wraps allowed up to ~4 lines, then horizontal padding remains constant).
- **Content:** single Arabic line/paragraph in IBM Plex Sans Arabic, RTL, large size (configurable; default 22px), centered. No source citation, no chrome, no buttons except the on-hover `×`.

### 6.4 Adhkar Library

- Flat array of strings (or `{ id, text }` for stable references).
- Ships with ~40 curated, short, general adhkar in Arabic (e.g., الباقيات الصالحات, الاستغفار, الصلاة على النبي ﷺ, التحميد, التهليل).
- Editable in Settings: add, edit, delete, reorder is not required.
- Import / Export as JSON (`{ "adhkar": ["..."] }`) and plain `.txt` (one dhikr per line).
- Validation: trim whitespace, reject empty entries, dedupe on add, max length 280 chars per entry.

### 6.5 Settings Window

- Single `BrowserWindow`, ~880×600, resizable down to 720×520.
- Layout: **left sidebar tabs**, content panel on right. Sidebar items:
  1. **General** — interval, auto-start, respect fullscreen apps, pause state.
  2. **Appearance** — theme (System / Light / Dark), popup position, visible duration, font size, optional soft chime.
  3. **Supplications** — list with inline edit, add, delete; import/export buttons.
  4. **About** — app name, version, font credit, "Built with Electron".
- Header strip shows current status: `Next dhikr in MM:SS` or `Paused until …`.

---

## 7. Data Model

`%APPDATA%/Tumaninah/data.json`

```json
{
  "version": 1,
  "settings": {
    "intervalMinutes": 60,
    "autoStart": true,
    "respectFullscreen": false,
    "theme": "system",
    "popupPosition": "top-right",
    "visibleDurationSeconds": 7,
    "fontSizePx": 22,
    "soundEnabled": false,
    "pausedUntil": null
  },
  "adhkar": [
    { "id": "uuid", "text": "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ" }
  ]
}
```

- `theme`: `"system" | "light" | "dark"`.
- `popupPosition`: one of the seven anchors above.
- `respectFullscreen`: when `true`, suppress popups while a fullscreen app is detected; **default `false`** (the app fires regardless, per the user's explicit request).
- `pausedUntil`: ISO timestamp or `null`. Reads ignore future fires until past this point.
- Atomic writes: write to `data.json.tmp` then rename. Debounced 250ms.

---

## 8. UI / UX Specification

### 8.1 Theme Tokens (CSS variables)

| Token              | Light                  | Dark                   |
| ------------------ | ---------------------- | ---------------------- |
| `--bg`             | `#FAFAF7`              | `#0E0E10`              |
| `--surface`        | `#FFFFFF`              | `#16161A`              |
| `--text`           | `#1A1A1A`              | `#ECECEC`              |
| `--text-muted`     | `#6B6B6B`              | `#A0A0A0`              |
| `--accent`         | `#0F766E` (teal-700)   | `#5EEAD4` (teal-300)   |
| `--border`         | `rgba(0,0,0,0.08)`     | `rgba(255,255,255,0.08)` |
| `--popup-bg`       | `rgba(255,255,255,0.92)` | `rgba(20,20,22,0.88)` |

Popup uses `backdrop-filter: blur(18px)` where supported, soft shadow `0 10px 40px rgba(0,0,0,0.18)`, 16px radius.

### 8.2 Typography

- Family: `"IBM Plex Sans Arabic"`, fallback `"Segoe UI", system-ui`.
- Popup: 22px (configurable 16–36), weight 500, line-height 1.7, letter-spacing 0.
- Settings: 14px body, 13px sidebar, 20px page titles.
- Numerals: Arabic-Indic for the in-popup text only if user content contains them; UI uses Western numerals.

### 8.3 Settings — General Tab

- Interval — number input + stepper, suffix "minutes", range 5–240.
- Auto-start with Windows — toggle.
- Respect fullscreen apps — toggle, helper text: "When on, pauses dhikr while a fullscreen app is detected."
- Pause state — chip showing current state with `Resume` button when paused.

### 8.4 Settings — Appearance Tab

- Theme — segmented control: System / Light / Dark.
- Position — 3×3 grid picker (center cell active, 7 valid anchors, 2 dead cells `middle-left`/`middle-right` disabled).
- Visible duration — slider 3–15 seconds.
- Font size — slider 16–36 px with live preview row showing a sample dhikr.
- Soft chime — toggle (off by default). When toggled on, plays a single 200ms bundled `chime.wav` at popup fade-in start.

### 8.5 Settings — Supplications Tab

- Toolbar: `+ Add`, `Import…`, `Export…`, count badge `N adhkar`.
- List: virtualized if `N > 100`. Each row = text (RTL), inline pencil to edit (turns into a textarea), trash to delete.
- Add row appears at top with a textarea + Save/Cancel.
- Empty state: centered illustration-free message in muted text, single `Add your first dhikr` button.

### 8.6 Settings — About

- App name in Arabic + Latin, version, link-style buttons: `Open data folder`, `Reset to defaults` (confirm dialog).

---

## 9. Animations & Motion

- All transitions ≤ 400ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`.
- Popup: opacity + 4px translate-y on enter/exit; no scale.
- Settings: tab switch = 120ms fade. Hover states 80ms. No bouncing, no spring overshoot.

---

## 10. System Integration

### 10.1 Auto-start

- Use `app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true, args: ["--hidden"] })`.
- Honor `settings.autoStart`; default `true`. When the app starts with `--hidden`, no window is shown; tray only.

### 10.2 Fullscreen detection (Windows)

- Use `node-active-window` or `win-fullscreen` (whichever is lighter) polled every 5s only when `respectFullscreen === true`; otherwise the check is skipped entirely.
- If a fullscreen foreground process is detected at fire time, skip that fire (do not requeue; next fire is on normal interval).

### 10.3 Power & sleep

- On `powerMonitor.resume`, reschedule next fire to `now + intervalMinutes` (do not fire immediately).
- On `powerMonitor.suspend`, no action.

### 10.4 Single instance

- `app.requestSingleInstanceLock()`. Second launch focuses the Settings window or surfaces the tray icon.

---

## 11. Distribution & Packaging

- **Installer:** electron-builder, NSIS, per-user (no admin), output `Tumaninah-Setup-x.y.z.exe`.
- **Signing:** out of scope for v1; document SmartScreen warning in README.
- **Icons:** `icon.ico` (multi-size 16/32/48/64/128/256), tray PNGs at 16/20/24/32 with `@2x`.
- **App ID:** `com.tumaninah.app`.
- **No auto-update channel.** "Check for updates" link in About opens the release page in browser.
- **Asar:** enabled; `data.json` lives outside the bundle in `%APPDATA%`.

---

## 12. File Structure

```
tumaninah/
├─ src/
│  ├─ main/
│  │  ├─ index.ts              # app lifecycle
│  │  ├─ tray.ts
│  │  ├─ scheduler.ts
│  │  ├─ store.ts              # JSON read/write, atomic
│  │  ├─ ipc.ts                # typed channels
│  │  ├─ notification-window.ts
│  │  ├─ settings-window.ts
│  │  ├─ autostart.ts
│  │  └─ fullscreen.ts
│  ├─ preload/
│  │  └─ index.ts              # contextBridge API
│  ├─ renderer/
│  │  ├─ settings/             # React app
│  │  │  ├─ App.tsx
│  │  │  ├─ pages/{General,Appearance,Supplications,About}.tsx
│  │  │  └─ components/
│  │  └─ notification/         # React app
│  │     └─ Popup.tsx
│  ├─ shared/
│  │  ├─ types.ts              # Settings, Dhikr, IPC contracts
│  │  └─ defaults.ts           # seed adhkar (~40), default settings
│  └─ assets/
│     ├─ fonts/IBMPlexSansArabic-*.woff2
│     ├─ icons/
│     └─ sounds/chime.wav
├─ electron-builder.yml
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

---

## 13. Acceptance Criteria

1. Launching the installer installs per-user without admin prompt; first run shows tray icon, no window.
2. On a clean install, tray tooltip reads `Next dhikr in 59:59…` and a popup appears within 60 minutes.
3. The popup:
   - Appears in the top-right of the active display, sized to the dhikr text up to 520px wide.
   - Fades in (400ms), holds (7s), fades out (400ms).
   - Does **not** steal focus from the active app (verified by typing into another app continuously across a fire).
   - Passes clicks through to apps beneath when the cursor is outside the popup.
   - When the cursor moves onto the popup, a `×` appears; clicking it dismisses; moving the cursor away restores click-through.
   - Sits above maximized and fullscreen-borderless windows.
4. Changing interval to 5 minutes immediately reschedules the next fire.
5. Quitting from tray fully exits the process (no orphan main process).
6. Restarting Windows auto-launches the app silently into tray (when auto-start is on).
7. Editing the adhkar list persists to `%APPDATA%/Tumaninah/data.json` within 500ms.
8. Switching theme to Dark updates Settings UI and the next popup instantly without restart.
9. Selecting `Pause for 1 hour` suppresses all fires for 60 minutes; tray tooltip shows `Paused until HH:MM`.
10. `Show next dhikr now` triggers a popup immediately without resetting the next scheduled fire.
11. Idle CPU < 1% on a typical laptop; RSS memory < 180MB with Settings closed.
12. No native Windows toast is ever emitted by the app.

---

## 14. Out of Scope (v1)

- Localization beyond Arabic.
- Translations, transliteration, audio recitation of the dhikr text.
- Prayer times, Hijri date, Qibla.
- Cloud sync, accounts, telemetry.
- macOS / Linux builds.
- Auto-update.
- Categories, tags, favorites, weighted selection.
- Multiple simultaneous popups across displays.

---

## 15. Open Questions

- Final tray icon style (filled mark vs. outlined crescent) — to be designed.
- Whether to pre-warm one hidden notification window for faster fade-in vs. creating per-fire — bench both; pick the one with lower jank at fade start.
- Exact seed adhkar list — to be curated from a trusted source before v1.
