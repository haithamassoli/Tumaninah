import { useState } from "react";
import { About } from "./pages/About";
import { Appearance } from "./pages/Appearance";
import { General } from "./pages/General";
import { Supplications } from "./pages/Supplications";
import { useAdhkar, useNow, useSettings, useStatus, useThemeApplied } from "./state";

type TabId = "general" | "appearance" | "supplications" | "about";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "supplications", label: "Supplications" },
  { id: "about", label: "About" },
];

export function App(): JSX.Element {
  const { settings, patch } = useSettings();
  const { adhkar } = useAdhkar();
  const status = useStatus();
  const now = useNow(1000);
  const [tab, setTab] = useState<TabId>("general");

  useThemeApplied(settings?.theme);

  if (!settings) {
    return <Booting />;
  }

  return (
    <div className="flex h-screen flex-col bg-bg text-text">
      <StatusStrip status={status} now={now} onResume={() => void resume()} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar tab={tab} onChange={setTab} adhkarCount={adhkar.length} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[640px] px-12 py-12">
            {tab === "general" && <General settings={settings} patch={patch} status={status} />}
            {tab === "appearance" && <Appearance settings={settings} patch={patch} />}
            {tab === "supplications" && <Supplications />}
            {tab === "about" && <About />}
          </div>
        </main>
      </div>
    </div>
  );
}

async function resume(): Promise<void> {
  await window.tumaninah.scheduler.resume();
}

function Booting(): JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-bg text-text-muted">
      <span className="text-body">Loading…</span>
    </div>
  );
}

function Sidebar({
  tab,
  onChange,
  adhkarCount,
}: {
  tab: TabId;
  onChange: (t: TabId) => void;
  adhkarCount: number;
}): JSX.Element {
  return (
    <nav className="w-[220px] shrink-0 border-r border-border bg-bg">
      <div className="px-7 pt-10 pb-6">
        <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
          Tumaninah
        </p>
        <h1 className="mt-2 font-arabic text-[1.75rem] font-medium leading-none">
          طمأنينة
        </h1>
      </div>
      <ul className="px-3 pb-10">
        {TABS.map((t, i) => {
          const active = t.id === tab;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onChange(t.id)}
                className={[
                  "group relative flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-start",
                  "transition-colors duration-80 ease-soft-out",
                  active
                    ? "bg-[color-mix(in_srgb,var(--text)_5%,transparent)] text-text"
                    : "text-text-muted hover:text-text",
                ].join(" ")}
              >
                <span className="text-[10px] tabular-nums text-text-muted opacity-70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sidebar tracking-tight flex-1">{t.label}</span>
                {t.id === "supplications" && (
                  <span className="text-[10px] tabular-nums text-text-muted">
                    {adhkarCount}
                  </span>
                )}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-accent"
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function StatusStrip({
  status,
  now,
  onResume,
}: {
  status: import("../../shared/types").SchedulerStatus | null;
  now: number;
  onResume: () => void;
}): JSX.Element {
  const text = formatStatus(status, now);
  const isPaused = status?.pausedUntil
    ? Date.parse(status.pausedUntil) > now
    : false;

  return (
    <div className="flex h-[44px] items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-text-muted">
        <span
          aria-hidden
          className={[
            "h-1.5 w-1.5 rounded-full",
            isPaused ? "bg-text-muted" : "bg-accent",
            isPaused ? "" : "shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
          ].join(" ")}
        />
        <span className="tabular-nums">{text}</span>
      </div>
      <div className="flex items-center gap-2">
        {isPaused && (
          <button
            type="button"
            onClick={onResume}
            className="text-sidebar text-accent hover:underline underline-offset-4 decoration-1"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  );
}

function formatStatus(
  status: import("../../shared/types").SchedulerStatus | null,
  now: number,
): string {
  if (!status) return "Initialising";
  if (status.pausedUntil) {
    const ts = Date.parse(status.pausedUntil);
    if (Number.isFinite(ts) && ts > now) {
      return `Paused until ${formatClock(new Date(ts))}`;
    }
  }
  if (status.nextFireAt) {
    const remaining = Math.max(0, status.nextFireAt - now);
    return `Next dhikr in ${formatMMSS(remaining)}`;
  }
  return "Idle";
}

function formatMMSS(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatClock(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
