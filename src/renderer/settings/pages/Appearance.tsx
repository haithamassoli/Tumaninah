import type { PopupPosition, Settings, Theme } from "../../../shared/types";
import {
  Field,
  SectionLede,
  SectionTitle,
  Segmented,
  Slider,
  Toggle,
} from "../components/primitives";

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const POSITION_GRID: ReadonlyArray<PopupPosition | null> = [
  "top-left",
  "top-center",
  "top-right",
  null, // middle-left disabled
  "center",
  null, // middle-right disabled
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

export function Appearance({
  settings,
  patch,
}: {
  settings: Settings;
  patch: (p: Partial<Settings>) => Promise<void>;
}): JSX.Element {
  return (
    <section>
      <SectionTitle>Appearance</SectionTitle>
      <SectionLede>
        Theme, where popups land, how long they linger, and how loudly the type carries.
      </SectionLede>

      <div className="divide-y divide-border">
        <Field label="Theme" hint="Applies instantly to Settings and the next popup.">
          <Segmented
            value={settings.theme}
            options={THEME_OPTIONS}
            onChange={(v) => void patch({ theme: v })}
          />
        </Field>

        <Field
          label="Popup position"
          hint="Anchor on the display containing your cursor. Two middle cells are reserved."
        >
          <PositionPicker
            value={settings.popupPosition}
            onChange={(v) => void patch({ popupPosition: v })}
          />
        </Field>

        <Field label="Visible duration" hint="How long the popup stays after fade-in.">
          <Slider
            value={settings.visibleDurationSeconds}
            min={3}
            max={15}
            step={1}
            suffix="sec"
            onChange={(v) => void patch({ visibleDurationSeconds: v })}
          />
        </Field>

        <Field label="Font size" hint="Sample renders with your current adhkar typography.">
          <Slider
            value={settings.fontSizePx}
            min={16}
            max={36}
            step={1}
            suffix="px"
            onChange={(v) => void patch({ fontSizePx: v })}
          />
        </Field>

        <div className="border-t border-border pt-6 mt-2">
          <FontPreview sizePx={settings.fontSizePx} />
        </div>

        <Field
          label="Soft chime"
          hint="A brief tone at fade-in. Off by default — the quiet is the point."
          htmlFor="chime"
        >
          <Toggle
            id="chime"
            checked={settings.soundEnabled}
            onChange={(v) => void patch({ soundEnabled: v })}
          />
        </Field>
      </div>
    </section>
  );
}

function PositionPicker({
  value,
  onChange,
}: {
  value: PopupPosition;
  onChange: (v: PopupPosition) => void;
}): JSX.Element {
  return (
    <div
      className="grid grid-cols-3 gap-1.5 rounded-md border border-border bg-surface p-1.5"
      style={{ width: 132, height: 92 }}
      role="radiogroup"
      aria-label="Popup anchor position"
    >
      {POSITION_GRID.map((pos, i) => {
        if (pos === null) {
          return (
            <div
              key={i}
              aria-hidden
              className="rounded-[3px] bg-[color-mix(in_srgb,var(--text)_4%,transparent)]"
            />
          );
        }
        const active = pos === value;
        return (
          <button
            key={pos}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={pos}
            onClick={() => onChange(pos)}
            className={[
              "group relative flex items-center justify-center rounded-[3px] border transition-colors duration-120 ease-soft-out",
              active
                ? "border-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
                : "border-border hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)]",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "h-1 w-1 rounded-full",
                active ? "bg-accent" : "bg-text-muted opacity-50",
              ].join(" ")}
            />
          </button>
        );
      })}
    </div>
  );
}

function FontPreview({ sizePx }: { sizePx: number }): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-surface px-6 py-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-3">
        Preview
      </p>
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic text-text"
        style={{ fontSize: sizePx, lineHeight: 1.7, fontWeight: 500 }}
      >
        سُبْحَانَ اللَّهِ وَبِحَمْدِهِ
      </p>
    </div>
  );
}
