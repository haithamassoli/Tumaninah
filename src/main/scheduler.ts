import type { Dhikr, SchedulerStatus } from "../shared/types";
import type { Store } from "./store";

export type FireReason = "scheduled" | "manual";
export type FireHandler = (dhikr: Dhikr, reason: FireReason) => void;
export type StatusListener = (status: SchedulerStatus) => void;

export interface SchedulerOptions {
  /** Override `Date.now` and `setTimeout` for tests. */
  now?: () => number;
  setTimeoutFn?: (cb: () => void, ms: number) => NodeJS.Timeout;
  clearTimeoutFn?: (h: NodeJS.Timeout) => void;
}

/**
 * Single-timer scheduler. Picks a random dhikr each interval, avoiding the
 * immediately previous one. Pause skips fires without dropping the rhythm.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private nextFireAt: number | null = null;
  private lastDhikrId: string | null = null;
  private readonly listeners = new Set<StatusListener>();
  private readonly now: () => number;
  private readonly setT: (cb: () => void, ms: number) => NodeJS.Timeout;
  private readonly clearT: (h: NodeJS.Timeout) => void;
  private started = false;

  constructor(
    private readonly store: Store,
    private readonly onFire: FireHandler,
    opts: SchedulerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.setT = opts.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearT = opts.clearTimeoutFn ?? ((h) => clearTimeout(h));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.scheduleNext();
  }

  stop(): void {
    this.started = false;
    this.clearTimer();
    this.nextFireAt = null;
    this.emit();
  }

  getStatus(): SchedulerStatus {
    return {
      nextFireAt: this.nextFireAt,
      pausedUntil: this.store.getSettings().pausedUntil,
    };
  }

  onStatusChange(fn: StatusListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  pauseUntil(iso: string): SchedulerStatus {
    this.store.setSettings({ pausedUntil: iso });
    this.scheduleNext();
    return this.getStatus();
  }

  resume(): SchedulerStatus {
    this.store.setSettings({ pausedUntil: null });
    this.scheduleNext();
    return this.getStatus();
  }

  /** Fire immediately without disturbing the scheduled next fire. */
  fireNow(): SchedulerStatus {
    const dhikr = this.pickRandom();
    if (dhikr) {
      this.lastDhikrId = dhikr.id;
      this.onFire(dhikr, "manual");
    }
    return this.getStatus();
  }

  /** Call after any settings change that may affect timing. */
  rescheduleFromNow(): void {
    if (!this.started) return;
    this.scheduleNext();
  }

  private scheduleNext(): void {
    this.clearTimer();
    const settings = this.store.getSettings();
    const intervalMs = Math.max(1, settings.intervalMinutes) * 60_000;
    const nowMs = this.now();
    const pausedUntilMs =
      settings.pausedUntil && Number.isFinite(Date.parse(settings.pausedUntil))
        ? Date.parse(settings.pausedUntil)
        : 0;

    // If paused beyond the next normal fire, target the pause-end + interval.
    const baseTarget = nowMs + intervalMs;
    const target = pausedUntilMs > baseTarget ? pausedUntilMs + intervalMs : baseTarget;

    this.nextFireAt = target;
    const delay = Math.max(0, target - nowMs);
    this.timer = this.setT(() => this.onTick(), delay);
    this.emit();
  }

  private onTick(): void {
    this.timer = null;
    if (!this.started) return;

    const settings = this.store.getSettings();
    const pausedUntilMs =
      settings.pausedUntil && Number.isFinite(Date.parse(settings.pausedUntil))
        ? Date.parse(settings.pausedUntil)
        : 0;
    if (pausedUntilMs > this.now()) {
      // Still paused — skip this fire and requeue.
      this.scheduleNext();
      return;
    }

    const dhikr = this.pickRandom();
    if (dhikr) {
      this.lastDhikrId = dhikr.id;
      this.onFire(dhikr, "scheduled");
    }
    this.scheduleNext();
  }

  private pickRandom(): Dhikr | null {
    const list = this.store.getAdhkar();
    if (list.length === 0) return null;
    if (list.length === 1) return list[0] ?? null;
    const pool = list.filter((d) => d.id !== this.lastDhikrId);
    const source = pool.length > 0 ? pool : list;
    const idx = Math.floor(Math.random() * source.length);
    return source[idx] ?? null;
  }

  private clearTimer(): void {
    if (this.timer) {
      this.clearT(this.timer);
      this.timer = null;
    }
  }

  private emit(): void {
    const status = this.getStatus();
    for (const fn of this.listeners) fn(status);
  }
}
