import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { NotificationShowPayload } from "../../shared/ipc";

const FADE_MS = 400;
const SHADOW_BLEED_PX = 28;

type Phase = "hidden" | "visible" | "leaving";

export function Popup(): JSX.Element {
  const [payload, setPayload] = useState<NotificationShowPayload | null>(null);
  const [phase, setPhase] = useState<Phase>("hidden");
  const [interactive, setInteractive] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const enterRafRef = useRef<number | null>(null);

  // Subscribe to show payloads from main process.
  useEffect(() => {
    const api = window.tumaninah?.notification;
    if (!api) return;
    return api.onShow((p) => {
      document.documentElement.dataset["theme"] = p.theme;
      setPayload(p);
    });
  }, []);

  // Orchestrate fade-in / hold / fade-out whenever a new dhikr arrives.
  useLayoutEffect(() => {
    if (!payload) return;
    const api = window.tumaninah?.notification;
    if (!api) return;

    clearTimers();

    // Step 1: paint hidden so fade-in can restart (handles replacement).
    setPhase("hidden");

    // Step 2: measure the wrapper (card + shadow bleed) and post back.
    const wrapper = wrapperRef.current;
    if (wrapper) {
      const width = Math.ceil(wrapper.offsetWidth);
      const height = Math.ceil(wrapper.offsetHeight);
      void api.measure({ width, height });
    }

    // Step 3: two RAFs ensures the hidden frame is committed before we flip
    // to visible — otherwise the transition is skipped on text replacement.
    enterRafRef.current = window.requestAnimationFrame(() => {
      enterRafRef.current = window.requestAnimationFrame(() => {
        setPhase("visible");
      });
    });

    // Step 4: hold timer kicks in after fade-in completes, then fade-out.
    const holdMs = payload.visibleDurationSeconds * 1000;
    holdTimerRef.current = window.setTimeout(() => {
      setPhase("leaving");
      exitTimerRef.current = window.setTimeout(() => {
        api.fadeDone({ generation: payload.generation });
        setPhase("hidden");
        setInteractive(false);
      }, FADE_MS);
    }, FADE_MS + holdMs);

    return clearTimers;

    function clearTimers(): void {
      if (holdTimerRef.current !== null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (enterRafRef.current !== null) {
        window.cancelAnimationFrame(enterRafRef.current);
        enterRafRef.current = null;
      }
    }
  }, [payload]);

  // Hover detection via document-level mousemove (works with click-through
  // forward:true). Cursor over the card flips the window to interactive.
  useEffect(() => {
    const api = window.tumaninah?.notification;
    if (!api) return;

    let lastInside = false;

    const onMove = (e: MouseEvent): void => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const inside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (inside !== lastInside) {
        lastInside = inside;
        setInteractive(inside);
        api.hover({ hovering: inside });
      }
    };

    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  function dismissNow(): void {
    if (!payload) return;
    const api = window.tumaninah?.notification;
    if (!api) return;
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setPhase("leaving");
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      void api.dismiss();
      setPhase("hidden");
      setInteractive(false);
    }, FADE_MS);
  }

  const visible = phase === "visible";
  const cardStyle: React.CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(4px)",
    transition: `opacity ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
    willChange: "opacity, transform",
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        display: "inline-block",
        padding: SHADOW_BLEED_PX,
        cursor: interactive ? "pointer" : "default",
      }}
    >
      <div
        ref={cardRef}
        onClick={interactive ? dismissNow : undefined}
        className="relative rounded-popup border border-border bg-popup-bg shadow-popup backdrop-blur-popup"
        style={{
          ...cardStyle,
          maxWidth: 520,
          padding: "28px 32px",
        }}
      >
        {interactive && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismissNow();
            }}
            style={{
              position: "absolute",
              top: 8,
              insetInlineStart: 8,
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              transition: "background-color 80ms cubic-bezier(0.22, 1, 0.36, 1), color 80ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--border)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            ×
          </button>
        )}
        <p
          dir="rtl"
          className="font-arabic text-text"
          style={{
            margin: 0,
            fontSize: payload?.fontSizePx ?? 22,
            lineHeight: 1.7,
            fontWeight: 500,
            textAlign: "center",
            wordBreak: "break-word",
          }}
        >
          {payload?.text ?? ""}
        </p>
      </div>
    </div>
  );
}
