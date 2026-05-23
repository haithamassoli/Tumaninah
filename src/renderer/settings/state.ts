import { useEffect, useState } from "react";
import type { Dhikr, SchedulerStatus, Settings, Theme } from "../../shared/types";

const api = (): typeof window.tumaninah => {
  if (!window.tumaninah) throw new Error("Tumaninah IPC bridge unavailable");
  return window.tumaninah;
};

export function useSettings(): {
  settings: Settings | null;
  patch: (p: Partial<Settings>) => Promise<void>;
} {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let alive = true;
    void api()
      .settings.get()
      .then((s) => {
        if (alive) setSettings(s);
      });
    const off = api().settings.onChanged((s) => {
      if (alive) setSettings(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return {
    settings,
    patch: async (p: Partial<Settings>) => {
      const next = await api().settings.set(p);
      setSettings(next);
    },
  };
}

export function useAdhkar(): {
  adhkar: Dhikr[];
  reload: () => Promise<void>;
  add: (text: string) => Promise<Dhikr>;
  update: (id: string, text: string) => Promise<Dhikr>;
  remove: (id: string) => Promise<void>;
} {
  const [adhkar, setAdhkar] = useState<Dhikr[]>([]);

  useEffect(() => {
    let alive = true;
    void api()
      .adhkar.list()
      .then((list) => {
        if (alive) setAdhkar(list);
      });
    const off = api().adhkar.onChanged((list) => {
      if (alive) setAdhkar(list);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return {
    adhkar,
    reload: async () => setAdhkar(await api().adhkar.list()),
    add: async (text) => {
      const d = await api().adhkar.add(text);
      return d;
    },
    update: async (id, text) => api().adhkar.update({ id, text }),
    remove: async (id) => {
      await api().adhkar.delete(id);
    },
  };
}

export function useStatus(): SchedulerStatus | null {
  const [status, setStatus] = useState<SchedulerStatus | null>(null);

  useEffect(() => {
    let alive = true;
    void api()
      .scheduler.status()
      .then((s) => {
        if (alive) setStatus(s);
      });
    const off = api().scheduler.onStatusChanged((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, []);

  return status;
}

/** Tick every second to refresh derived clock UI. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Apply theme attribute to <html>; reacts to system changes when theme="system". */
export function useThemeApplied(theme: Theme | undefined): void {
  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset["theme"] = theme;
  }, [theme]);
}
