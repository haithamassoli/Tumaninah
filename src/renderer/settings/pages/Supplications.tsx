import { useRef, useState } from "react";
import { DHIKR_MAX_LENGTH } from "../../../shared/ipc";
import type { Dhikr } from "../../../shared/types";
import { GhostButton, SectionLede, SectionTitle } from "../components/primitives";
import { useAdhkar } from "../state";

export function Supplications(): JSX.Element {
  const { adhkar, add, update, remove } = useAdhkar();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const onAdd = async (text: string): Promise<void> => {
    try {
      await add(text);
      setAdding(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add dhikr");
    }
  };

  const onImport = async (): Promise<void> => {
    try {
      const result = await window.tumaninah.data.importDialog("merge");
      if (!result) return;
      setImportMsg(
        `Added ${result.added}, skipped ${result.skipped}. Total ${result.total}.`,
      );
      setTimeout(() => setImportMsg(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };

  const onExport = async (format: "json" | "txt"): Promise<void> => {
    try {
      await window.tumaninah.data.exportDialog(format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  return (
    <section>
      <SectionTitle>Supplications</SectionTitle>
      <SectionLede>
        Your adhkar library. Tumaninah picks one at random each interval. No categories — just text.
      </SectionLede>

      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <GhostButton tone="accent" onClick={() => setAdding(true)}>
            + Add dhikr
          </GhostButton>
          <GhostButton onClick={() => void onImport()}>Import…</GhostButton>
          <ExportMenu onExport={onExport} />
        </div>
        <span className="text-sidebar tabular-nums text-text-muted">
          {adhkar.length} {adhkar.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {(error || importMsg) && (
        <div
          className={[
            "mt-3 rounded-md border px-3 py-2 text-sidebar",
            error
              ? "border-[color-mix(in_srgb,#c44_30%,var(--border))] text-[color-mix(in_srgb,#c44_70%,var(--text))]"
              : "border-border text-text-muted",
          ].join(" ")}
        >
          {error ?? importMsg}
        </div>
      )}

      <ul className="mt-2">
        {adding && (
          <Editor
            initial=""
            onCancel={() => {
              setAdding(false);
              setError(null);
            }}
            onSave={onAdd}
          />
        )}

        {adhkar.length === 0 && !adding && (
          <EmptyState onAdd={() => setAdding(true)} />
        )}

        {adhkar.map((d) => (
          <Row
            key={d.id}
            dhikr={d}
            isEditing={editingId === d.id}
            onEdit={() => setEditingId(d.id)}
            onCancel={() => setEditingId(null)}
            onSave={async (text) => {
              try {
                await update(d.id, text);
                setEditingId(null);
                setError(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not update");
              }
            }}
            onDelete={() => void remove(d.id)}
          />
        ))}
      </ul>
    </section>
  );
}

function Row({
  dhikr,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
}: {
  dhikr: Dhikr;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (text: string) => Promise<void>;
  onDelete: () => void;
}): JSX.Element {
  if (isEditing) {
    return <Editor initial={dhikr.text} onCancel={onCancel} onSave={onSave} />;
  }
  return (
    <li className="group flex items-start gap-3 border-b border-border py-3 -mx-2 px-2 rounded-md hover:bg-[color-mix(in_srgb,var(--text)_3%,transparent)] transition-colors duration-80 ease-soft-out">
      <p
        dir="rtl"
        lang="ar"
        className="font-arabic flex-1 text-text leading-relaxed"
        style={{ fontSize: 18, fontWeight: 500 }}
      >
        {dhikr.text}
      </p>
      <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity duration-80 ease-soft-out">
        <IconBtn onClick={onEdit} label="Edit">
          <PencilIcon />
        </IconBtn>
        <IconBtn onClick={onDelete} label="Delete" tone="danger">
          <TrashIcon />
        </IconBtn>
      </div>
    </li>
  );
}

function Editor({
  initial,
  onCancel,
  onSave,
}: {
  initial: string;
  onCancel: () => void;
  onSave: (text: string) => Promise<void>;
}): JSX.Element {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const tooLong = text.length > DHIKR_MAX_LENGTH;
  const empty = text.trim().length === 0;

  return (
    <li className="border-b border-border py-3">
      <div className="rounded-md border border-accent/40 bg-surface p-3 shadow-sm">
        <textarea
          ref={(el) => {
            ref.current = el;
            if (el && !el.dataset["init"]) {
              el.dataset["init"] = "1";
              el.focus();
              el.setSelectionRange(el.value.length, el.value.length);
            }
          }}
          dir="rtl"
          lang="ar"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب الذكر هنا"
          className="w-full resize-y bg-transparent font-arabic text-text placeholder:text-text-muted focus:outline-none"
          style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.7 }}
        />
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span
            className={[
              "text-[11px] tabular-nums",
              tooLong ? "text-[color-mix(in_srgb,#c44_70%,var(--text))]" : "text-text-muted",
            ].join(" ")}
          >
            {text.length} / {DHIKR_MAX_LENGTH}
          </span>
          <div className="flex items-center gap-2">
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
            <GhostButton
              tone="accent"
              disabled={empty || tooLong}
              onClick={() => void onSave(text)}
            >
              Save
            </GhostButton>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <li className="my-12 flex flex-col items-center gap-4 text-center">
      <p className="font-arabic text-2xl text-text-muted opacity-60">۝</p>
      <p className="text-body text-text-muted max-w-[36ch]">
        No adhkar yet. The popup needs at least one entry to speak.
      </p>
      <GhostButton tone="accent" onClick={onAdd}>
        Add your first dhikr
      </GhostButton>
    </li>
  );
}

function ExportMenu({
  onExport,
}: {
  onExport: (format: "json" | "txt") => Promise<void>;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <GhostButton onClick={() => setOpen((v) => !v)}>Export…</GhostButton>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute left-0 z-20 mt-1 min-w-[140px] rounded-md border border-border bg-surface py-1 shadow-md">
            <MenuItem
              onClick={() => {
                setOpen(false);
                void onExport("json");
              }}
            >
              JSON
            </MenuItem>
            <MenuItem
              onClick={() => {
                setOpen(false);
                void onExport("txt");
              }}
            >
              Plain text
            </MenuItem>
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full px-3 py-1.5 text-start text-sidebar text-text hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)] transition-colors duration-80 ease-soft-out"
    >
      {children}
    </button>
  );
}

function IconBtn({
  onClick,
  label,
  tone = "default",
  children,
}: {
  onClick: () => void;
  label: string;
  tone?: "default" | "danger";
  children: React.ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted",
        "transition-colors duration-80 ease-soft-out",
        tone === "danger"
          ? "hover:bg-[color-mix(in_srgb,#c44_12%,transparent)] hover:text-[color-mix(in_srgb,#c44_70%,var(--text))]"
          : "hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PencilIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4M7 7v4M9 7v4" />
    </svg>
  );
}

