import { useEffect, useState } from "react";

export function App(): JSX.Element {
  const [pong, setPong] = useState<string | null>(null);

  useEffect(() => {
    void window.tumaninah?.settings
      .get()
      .then(() => setPong("pong"))
      .catch(() => setPong(null));
  }, []);

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-10 py-14">
        <header className="flex items-baseline justify-between border-b border-border pb-8">
          <div>
            <p className="text-sidebar uppercase tracking-[0.18em] text-text-muted">
              Tumaninah · v0.1
            </p>
            <h1 className="mt-2 font-arabic text-[2.5rem] font-medium leading-none">
              طمأنينة
            </h1>
          </div>
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          />
        </header>

        <section className="mt-12 space-y-6">
          <p className="text-title-page text-text">
            Foundation ready.
          </p>
          <p className="max-w-prose text-body text-text-muted">
            Milestone 1 scaffolds Electron, Vite, React, Tailwind, and the
            theme tokens defined in the PRD. Tray, scheduler, and the
            notification popup arrive in M3 and M4.
          </p>

          <dl className="mt-10 grid grid-cols-2 gap-x-10 gap-y-4 text-body">
            <Row label="IPC bridge" value={pong === "pong" ? "connected" : "—"} />
            <Row label="Direction" value="RTL" />
            <Row label="Font" value="IBM Plex Sans Arabic" />
            <Row label="Theme" value="system" />
          </dl>
        </section>

        <footer className="mt-auto pt-10 text-sidebar text-text-muted">
          <span className="font-arabic">سُبْحَانَ اللَّهِ وَبِحَمْدِهِ</span>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text">{value}</dd>
    </>
  );
}
