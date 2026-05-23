import { useState } from "react";
import { GhostButton, SectionLede, SectionTitle } from "../components/primitives";

const VERSION = "0.1.0";

export function About(): JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  const doReset = async (): Promise<void> => {
    setResetting(true);
    try {
      await window.tumaninah.data.resetDefaults();
      setConfirming(false);
    } finally {
      setResetting(false);
    }
  };

  return (
    <section>
      <SectionTitle>About</SectionTitle>
      <SectionLede>The app, the type, the resting place of your data.</SectionLede>

      <div className="space-y-10">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
            App
          </p>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="font-arabic text-3xl font-medium" dir="rtl" lang="ar">
              طمأنينة
            </span>
            <span className="text-title-page text-text">Tumaninah</span>
            <span className="text-sidebar tabular-nums text-text-muted">
              v{VERSION}
            </span>
          </div>
          <p className="mt-3 text-body text-text-muted max-w-[52ch] leading-relaxed">
            Quiet Islamic adhkar reminders for Windows — tray-resident, frameless,
            focus-respecting.
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Typography
          </p>
          <p className="mt-2 text-body text-text">
            IBM Plex Sans Arabic — designed by Mike Abbink, Bold Monday & IBM.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-muted">
            Data
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <GhostButton onClick={() => void window.tumaninah.data.openFolder()}>
              Open data folder
            </GhostButton>
            {!confirming ? (
              <GhostButton tone="danger" onClick={() => setConfirming(true)}>
                Reset to defaults…
              </GhostButton>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
                <span className="text-sidebar text-text">
                  Reset settings and adhkar?
                </span>
                <GhostButton tone="danger" disabled={resetting} onClick={() => void doReset()}>
                  {resetting ? "Resetting…" : "Yes, reset"}
                </GhostButton>
                <GhostButton onClick={() => setConfirming(false)} disabled={resetting}>
                  Cancel
                </GhostButton>
              </div>
            )}
          </div>
          <p className="text-sidebar text-text-muted max-w-[52ch] leading-relaxed">
            Reset overwrites your data.json with the bundled seed adhkar and default
            settings. There is no undo.
          </p>
        </div>

        <p className="text-sidebar text-text-muted pt-4 border-t border-border">
          Built with Electron. No telemetry, no accounts, no cloud.
        </p>
      </div>
    </section>
  );
}
