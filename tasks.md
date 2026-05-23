# Tumaninah — Milestones & Tasks

## M1 — Project Foundation
Electron + TypeScript + Vite + React scaffold, RTL setup, Tailwind with theme tokens, IBM Plex Sans Arabic bundled, strict TS, secure preload, single-instance lock.

- [x] Initialize repo with `package.json`, `.gitignore`, `.editorconfig`, `.nvmrc`.
- [x] Install latest Electron, `electron-builder`, `electron-vite`, TypeScript, React.
- [x] Configure `tsconfig.json` with `strict: true`, separate configs for `main`, `preload`, `renderer`.
- [x] Configure `electron-vite.config.ts` with three entry points (main, preload, renderer).
- [x] Add Tailwind CSS with `dir="rtl"` on `<html>` and CSS variables for theme tokens (per PRD §8.1).
- [x] Add `postcss.config.js` and Tailwind preset extending the token variables.
- [~] Bundle IBM Plex Sans Arabic woff2 files in `src/assets/fonts/` and register via `@font-face`. *(@font-face declarations + drop-in folder ready at `src/renderer/assets/fonts/`; .woff2 files still need to be vendored — see README there.)*
- [x] Create `src/preload/index.ts` with `contextBridge` exposing a typed API; enable `contextIsolation`, `sandbox`, disable `nodeIntegration`.
- [x] Create `src/main/index.ts` with `app.whenReady`, `app.requestSingleInstanceLock`, no window on boot.
- [x] Add `--hidden` CLI flag parsing for silent autostart.
- [x] Add `npm run dev` and `npm run build` scripts and confirm a hot-reloading window can be opened manually.

## M2 — Core Infrastructure
Typed IPC layer, JSON store at `%APPDATA%/Tumaninah/data.json` with atomic writes, settings + adhkar data model, defaults seeded on first run.

- [x] Define shared types in `src/shared/types.ts`: `Settings`, `Dhikr`, `AppData`, `PopupPosition`, `Theme`.
- [x] Define IPC channel contract in `src/shared/ipc.ts` (channel names + request/response types).
- [x] Create `src/shared/defaults.ts` with `DEFAULT_SETTINGS` and `SEED_ADHKAR` (~40 curated entries).
- [x] Implement `src/main/store.ts`: `load()`, `save()`, atomic write via tmp + rename, debounced 250ms.
- [x] Implement migration: read `version` field; if missing, write `version: 1`.
- [x] On first run, write `data.json` with defaults if it does not exist.
- [x] Implement `src/main/ipc.ts` registering all channels (`settings:get/set`, `adhkar:list/add/update/delete/import/export`, `scheduler:status/pause/resume/fireNow`, `notification:dismiss`).
- [x] Expose the typed API via preload `contextBridge`.
- [x] Add input validation in main handlers: trim, dedupe, max 280 chars per dhikr, reject empty.
- [x] Unit-test the store: round-trip, atomic write does not corrupt on crash mid-write.

## M3 — Scheduler & System Tray
Fixed-interval scheduler, random selection without immediate repeat, pause states, tray with dynamic tooltip and full context menu.

- [x] Implement `src/main/scheduler.ts` with a single `setTimeout` chain and `nextFireAt` state.
- [x] Random dhikr selection that avoids the immediately previous one when `adhkar.length > 1`.
- [x] `pause(durationMs | until)` and `resume()` writing `pausedUntil` to settings.
- [x] `fireNow()` shows the popup without resetting `nextFireAt`. *(Invokes `onFire` callback; actual popup wired in M4.)*
- [x] Reschedule on any settings change that affects timing.
- [x] Skip a fire when `pausedUntil` is in the future and reschedule the next one normally.
- [~] Create `src/main/tray.ts` with custom monochrome icon (Win11 theme-aware). *(Placeholder programmatic dot icon; real Win11 theme-aware PNGs land in M7.)*
- [x] Tray tooltip updates every second: `Tumaninah — Next dhikr in MM:SS` or `Paused until HH:MM`.
- [x] Tray context menu: `Open Settings`, `Show next dhikr now`, `Pause` submenu (`30 minutes`, `1 hour`, `Until tomorrow 6:00 AM`, `Resume`), separator, `Quit`.
- [x] `Resume` item visible only while paused.
- [~] Tray left-click toggles the Settings window. *(Left-click opens Settings; toggle-to-close lands with M5 Settings window lifecycle.)*
- [x] Wire `powerMonitor.resume` → reschedule next fire to `now + intervalMinutes`.

## M4 — Notification Popup (Critical)
Frameless transparent always-on-top window, no focus stealing, click-through with hover-to-interact dismiss, fade animation, 7-anchor positioning, replacement on collision.

- [x] Implement `src/main/notification-window.ts` with all `BrowserWindow` flags per PRD §6.3.
- [x] Call `setAlwaysOnTop(true, "screen-saver")`, `setVisibleOnAllWorkspaces(true)`, `setIgnoreMouseEvents(true, { forward: true })`.
- [x] Use `showInactive()` exclusively; never call `.focus()` or focused `.show()`.
- [x] Compute target display via `screen.getDisplayNearestPoint(cursor)`.
- [x] Position math for all 7 anchors with 24px screen-edge margin.
- [x] Sizing: measure text in the renderer, post measurement back via IPC, resize window to `min(textWidth + 64, 520)` × content height.
- [x] Build `src/renderer/notification/Popup.tsx` with text-only content, IBM Plex Sans Arabic, RTL.
- [x] Apply popup styling: `--popup-bg`, `backdrop-filter: blur(18px)`, 16px radius, soft shadow.
- [x] Fade in 400ms ease-out + 4px translate-y; hold `visibleDurationSeconds`; fade out 400ms.
- [x] Hover detection in the renderer toggles `setIgnoreMouseEvents(false)` on enter and `true` on leave.
- [x] Render `×` icon in top-corner (left in RTL) only while interactive; click dismisses immediately.
- [x] Click anywhere on the popup body while interactive also dismisses.
- [x] Replacement behavior: if a new dhikr is requested while one is on screen, cancel the current fade, swap text, restart fade-in.
- [~] Verify the popup sits above maximized and fullscreen-borderless windows. *(Flags set per PRD; manual smoke-test on Windows pending — covered by AC3f in M9.)*
- [x] Decide pre-warmed vs. per-fire window after benchmarking fade-start jank. *(Pre-warmed single window: created on first fire, hidden between presentations. Eliminates load-cost flicker; replacement handled by generation token + key restart.)*

## M5 — Settings UI
Settings window with sidebar tabs, status header, live theme switching, sliders, supplications manager with import/export.

- [x] Create `src/main/settings-window.ts`: `BrowserWindow` 880×600, min 720×520, hidden on boot, opens on demand.
- [x] Build `src/renderer/settings/App.tsx` layout with sidebar + content panel.
- [x] Status header strip showing `Next dhikr in MM:SS` or `Paused until …`, polling tray-equivalent state via IPC.
- [x] Routing between four tabs: General, Appearance, Supplications, About.
- [x] **General tab**: interval number+stepper (range 5–240), `Auto-start with Windows` toggle, `Respect fullscreen apps` toggle with helper text, pause chip with `Resume` action.
- [x] **Appearance tab**: theme segmented control (System/Light/Dark), 3×3 position picker (7 valid, 2 disabled cells), duration slider 3–15s, font size slider 16–36px with live preview row, soft chime toggle.
- [~] **Supplications tab**: virtualized list when N > 100; rows show RTL text, pencil to edit inline (textarea), trash to delete; toolbar with `+ Add`, `Import…`, `Export…`, count badge; empty state with `Add your first dhikr`. *(All UI in place. Virtualization deferred — N>100 unlikely pre-import; can wire react-window if needed.)*
- [x] Import: accept `.json` (`{ "adhkar": ["..."] }`) and `.txt` (one per line); validate and merge.
- [x] Export: save current adhkar to user-chosen `.json` or `.txt`.
- [x] **About tab**: app name (Arabic + Latin), version, font credit, `Open data folder` (opens `%APPDATA%/Tumaninah`), `Reset to defaults` with confirm dialog.
- [x] Live theme switching: theme changes apply instantly to Settings UI without restart and to the next popup.
- [x] Subscribe to settings changes via IPC push so the Settings window updates when changed elsewhere (e.g., from tray pause).

## M6 — System Integration
Auto-start with Windows, optional fullscreen detection, power events, reset-to-defaults flow.

- [ ] Implement `src/main/autostart.ts` using `app.setLoginItemSettings({ openAtLogin, openAsHidden: true, args: ["--hidden"] })`.
- [ ] Bind autostart to `settings.autoStart`; default `true` on first run.
- [ ] When launched with `--hidden`, do not open Settings; tray only.
- [ ] Implement `src/main/fullscreen.ts`: poll every 5s **only when** `respectFullscreen === true`.
- [ ] Pick the lighter dependency between `node-active-window` and `win-fullscreen`; document choice.
- [ ] On fire, if a fullscreen foreground process is detected and `respectFullscreen` is on, skip that fire without requeueing.
- [ ] Hook `powerMonitor.resume` to scheduler reschedule (already wired in M3; verify end-to-end).
- [ ] Hook `powerMonitor.suspend` as a no-op for now (documented).
- [ ] `Reset to defaults` overwrites `data.json` with defaults and reloads main state + open Settings tab.

## M7 — Polish & Theming
Final visual pass, motion unification, edge cases, icons.

- [ ] Verify all `--bg`, `--surface`, `--text`, `--text-muted`, `--accent`, `--border`, `--popup-bg` tokens across both themes.
- [ ] Unify motion timing to `cubic-bezier(0.22, 1, 0.36, 1)` with ≤ 400ms durations everywhere.
- [ ] Settings tab switch: 120ms fade.
- [ ] Hover states: 80ms.
- [ ] Empty state for adhkar list.
- [ ] Test long-text wrap in popup: up to 4 lines, then constant padding.
- [ ] Produce tray PNGs at 16/20/24/32 + `@2x`, both light and dark variants.
- [ ] Produce app `icon.ico` (16/32/48/64/128/256).
- [ ] Confirm Arabic-Indic numerals appear in popup only when source text contains them; UI stays Western.

## M8 — Packaging & Distribution
electron-builder NSIS per-user installer, app metadata, README.

- [ ] Create `electron-builder.yml` with `appId: com.tumaninah.app`, `productName: Tumaninah`, NSIS target.
- [ ] Configure NSIS as per-user (`perMachine: false`), `oneClick: false`, allow install dir choice.
- [ ] Enable `asar: true`; keep `data.json` outside the asar in `%APPDATA%`.
- [ ] Set up Windows icon, file associations: none.
- [ ] Output naming: `Tumaninah-Setup-${version}.exe`.
- [ ] Write `README.md`: install instructions, SmartScreen note, data folder path, support link.
- [ ] Add `npm run dist` building a signed-less installer.
- [ ] Sanity-test installer on a fresh Windows VM: install, launch via Start Menu, uninstall removes app but keeps `%APPDATA%/Tumaninah`.

## M9 — QA & Acceptance
Validate all 12 acceptance criteria, performance check, real-app behavior tests.

- [ ] AC1: Clean installer runs per-user, no admin prompt, tray icon appears, no window.
- [ ] AC2: Tray tooltip counts down from 59:59 on a fresh install; first popup appears within 60 min.
- [ ] AC3a: Popup appears top-right on active display, sized to text up to 520px.
- [ ] AC3b: Fade timings — 400ms in, 7s hold, 400ms out.
- [ ] AC3c: Focus is not stolen — type continuously in Notepad/VS Code across a fire and confirm no missed keys.
- [ ] AC3d: Clicks pass through to apps beneath when cursor is outside popup bounds.
- [ ] AC3e: On hover, `×` appears; click dismisses; leaving restores click-through.
- [ ] AC3f: Popup sits above maximized windows and fullscreen-borderless apps (browser, video player, IDE).
- [ ] AC4: Changing interval to 5 minutes reschedules the next fire to ~5 minutes from change.
- [ ] AC5: Quitting from tray exits cleanly — no orphan process in Task Manager.
- [ ] AC6: After Windows restart, app auto-launches silently into tray.
- [ ] AC7: Editing the adhkar list persists to `data.json` within 500ms (verify via file mtime).
- [ ] AC8: Switching theme to Dark instantly updates Settings and next popup without restart.
- [ ] AC9: `Pause for 1 hour` suppresses fires for 60 minutes; tooltip shows `Paused until HH:MM`.
- [ ] AC10: `Show next dhikr now` triggers a popup without resetting `nextFireAt`.
- [ ] AC11: Idle CPU < 1% and RSS < 180MB with Settings closed (measure with Task Manager + Process Explorer).
- [ ] AC12: Confirm zero native Windows toasts are emitted by the app during any flow.
- [ ] Regression sweep on a fresh Windows 11 VM.
