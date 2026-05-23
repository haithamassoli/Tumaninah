import type { SchedulerStatus, Settings } from "../../../shared/types";
import { Field, GhostButton, SectionLede, SectionTitle, Stepper, Toggle } from "../components/primitives";

export function General({
  settings,
  patch,
  status,
}: {
  settings: Settings;
  patch: (p: Partial<Settings>) => Promise<void>;
  status: SchedulerStatus | null;
}): JSX.Element {
  const paused = status?.pausedUntil ? Date.parse(status.pausedUntil) > Date.now() : false;
  const pauseLabel = paused && status?.pausedUntil
    ? `Paused until ${new Date(status.pausedUntil).toLocaleString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        weekday: "short",
      })}`
    : "Running";

  return (
    <section>
      <SectionTitle>General</SectionTitle>
      <SectionLede>
        How often Tumaninah whispers a dhikr, and how it behaves around your work.
      </SectionLede>

      <div className="divide-y divide-border">
        <Field
          label="Interval"
          hint="Minutes between dhikr fires. Changes take effect from now."
          htmlFor="interval"
        >
          <Stepper
            id="interval"
            value={settings.intervalMinutes}
            min={5}
            max={240}
            step={5}
            suffix="min"
            onChange={(v) => void patch({ intervalMinutes: v })}
          />
        </Field>

        <Field
          label="Auto-start with Windows"
          hint="Launches silently into the tray when you sign in."
          htmlFor="autostart"
        >
          <Toggle
            id="autostart"
            checked={settings.autoStart}
            onChange={(v) => void patch({ autoStart: v })}
          />
        </Field>

        <Field
          label="Respect fullscreen apps"
          hint="When on, Tumaninah stays quiet while a fullscreen app is in the foreground."
          htmlFor="respect"
        >
          <Toggle
            id="respect"
            checked={settings.respectFullscreen}
            onChange={(v) => void patch({ respectFullscreen: v })}
          />
        </Field>

        <Field label="Pause" hint="Current scheduler state.">
          <div className="flex items-center gap-3">
            <span
              className={[
                "inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sidebar",
                paused ? "text-text-muted" : "text-text",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  paused ? "bg-text-muted" : "bg-accent",
                ].join(" ")}
              />
              {pauseLabel}
            </span>
            {paused && (
              <GhostButton tone="accent" onClick={() => void window.tumaninah.scheduler.resume()}>
                Resume
              </GhostButton>
            )}
          </div>
        </Field>
      </div>
    </section>
  );
}
