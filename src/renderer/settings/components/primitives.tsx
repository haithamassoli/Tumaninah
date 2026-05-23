import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="grid grid-cols-[1fr,auto] items-start gap-x-10 gap-y-1 py-5 border-b border-border last:border-b-0">
      <div className="flex flex-col gap-1">
        <label
          htmlFor={htmlFor}
          className="text-body font-medium tracking-tight text-text"
        >
          {label}
        </label>
        {hint && (
          <p className="text-sidebar text-text-muted leading-relaxed max-w-[44ch]">
            {hint}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end min-h-[28px]">{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h2 className="text-title-page font-medium tracking-tight text-text mb-2">
      {children}
    </h2>
  );
}

export function SectionLede({ children }: { children: ReactNode }): JSX.Element {
  return (
    <p className="text-body text-text-muted max-w-[52ch] mb-10 leading-relaxed">
      {children}
    </p>
  );
}

export function Toggle({
  checked,
  onChange,
  id,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id?: string;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full",
        "transition-colors duration-120 ease-soft-out",
        "border border-border",
        checked
          ? "bg-[color-mix(in_srgb,var(--accent)_88%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--text)_8%,transparent)]",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-[16px] w-[16px] rounded-full bg-surface shadow-sm",
          "transition-transform duration-120 ease-soft-out",
          checked ? "translate-x-[19px]" : "translate-x-[3px]",
        ].join(" ")}
      />
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  id?: string;
}): JSX.Element {
  const clamp = (n: number): number => Math.max(min, Math.min(max, n));
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1 py-1">
      <StepBtn label="−" onClick={() => onChange(clamp(value - step))} />
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
        className="w-12 bg-transparent text-center text-body tabular-nums text-text focus:outline-none focus:ring-1 focus:ring-accent rounded"
      />
      {suffix && (
        <span className="pl-1 pr-2 text-sidebar text-text-muted">{suffix}</span>
      )}
      <StepBtn label="+" onClick={() => onChange(clamp(value + step))} />
    </div>
  );
}

function StepBtn({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-6 w-6 rounded text-text-muted hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-text transition-colors duration-80 ease-soft-out"
    >
      {label}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}): JSX.Element {
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={[
              "px-3 py-1.5 text-sidebar rounded-[5px] transition-colors duration-120 ease-soft-out",
              active
                ? "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-text"
                : "text-text-muted hover:text-text",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  id,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  id?: string;
  suffix?: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tm-slider w-48"
      />
      <span className="text-sidebar tabular-nums text-text-muted w-16 text-end">
        {value}
        {suffix ? ` ${suffix}` : ""}
      </span>
    </div>
  );
}

export function GhostButton({
  children,
  onClick,
  type = "button",
  tone = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "default" | "danger" | "accent";
  disabled?: boolean;
}): JSX.Element {
  const toneClass =
    tone === "danger"
      ? "text-[color-mix(in_srgb,#c44_70%,var(--text))] hover:bg-[color-mix(in_srgb,#c44_10%,transparent)]"
      : tone === "accent"
        ? "text-accent hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
        : "text-text hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sidebar font-medium",
        "transition-colors duration-80 ease-soft-out disabled:opacity-50 disabled:pointer-events-none",
        toneClass,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
