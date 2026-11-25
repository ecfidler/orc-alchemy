import { type FocusEvent, type PointerEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button.tsx";

/** The time in ms that a status text shows, when the pointer and the focus are not on the toast. */
export const TOAST_DURATION = 6000;
/**
 * The time in ms of the fade at the end. With `prefers-reduced-motion: reduce` there is no fade, and the text stays for
 * this time. It must be the same as the time of the `ui-toast-out` animation in toast.css.
 */
const FADE_OUT_MS = 200;

/** A note of the toast: its text and its one action, for example "Dismiss". */
export interface ToastNote {
  text: ReactNode;
  /** `label` is the text of the button; `name` is its accessible name when the label alone does not say what it acts on. */
  action: { label: string; name?: string; onClick: () => void };
}

export interface ToastProps {
  /** The status text: what the last action did. "" shows no status. */
  status: string;
  /** Changes with each new status text, also for the same text, so that it shows again and a screen reader says it again. */
  statusKey: number;
  /** The note above the status, or null. It stays until the owner takes it away, for example after its action. */
  note?: ToastNote | null;
  /** The name of the status region of the note, for example "Concentration note". */
  noteName?: string;
  /** The time in ms that the status shows. */
  duration?: number;
}

type Phase = "open" | "leaving" | "closed";

/**
 * A toast at the bottom centre of the screen, above the safe area. It takes no space in the page, so a text that
 * comes and goes moves nothing. It shows one status text, which hides after `duration`, and one note above it,
 * which stays. The status does not hide while the pointer or the focus is on the toast; the time starts again when
 * they leave. A new `statusKey` replaces the text and starts the time again. The status and the note are polite
 * live regions that are always in the page. The toast is in a portal at the end of the body.
 */
export function Toast({ status, statusKey, note = null, noteName = "Note", duration = TOAST_DURATION }: ToastProps) {
  const root = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const held = hover || focus;
  // The key of the status that the time hid, and how far: "leaving" during the fade, then "closed".
  const [hidden, setHidden] = useState<{ key: number; phase: Exclude<Phase, "open"> } | null>(null);
  const phase: Phase = status === "" ? "closed" : hidden?.key === statusKey ? hidden.phase : "open";

  useEffect(() => {
    if (phase !== "open" || held) return;
    const timer = setTimeout(() => setHidden({ key: statusKey, phase: "leaving" }), duration);
    return () => clearTimeout(timer);
  }, [phase, held, statusKey, duration]);
  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setHidden({ key: statusKey, phase: "closed" }), FADE_OUT_MS);
    return () => clearTimeout(timer);
  }, [phase, statusKey]);

  // The element that had the focus before it came into the toast. After the note's action takes the note away, the
  // focus goes back to it, so it does not fall to the body.
  const cameFrom = useRef<HTMLElement | null>(null);
  const restore = useRef(false);
  useLayoutEffect(() => {
    if (note !== null || !restore.current) return;
    restore.current = false;
    const active = document.activeElement;
    if ((active === null || active === document.body) && cameFrom.current?.isConnected) cameFrom.current.focus();
    if (!root.current?.contains(document.activeElement)) setFocus(false);
  }, [note]);
  // A click on the note's action takes away the element under the pointer, and the browser can then send no
  // pointerleave. When the note goes away, the toast is held only if the pointer is still on it. The test is a hit
  // test at the last point of the pointer, because `:hover` can stay on the parent of the removed element.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (note !== null) return;
    const at = pointer.current;
    // jsdom has no elementFromPoint.
    const under = at && document.elementFromPoint?.(at.x, at.y);
    if (!(under && root.current?.contains(under))) setHover(false);
  }, [note]);

  const track = (event: PointerEvent) => {
    pointer.current = { x: event.clientX, y: event.clientY };
  };
  const hold = (event: PointerEvent) => {
    track(event);
    setHover(true);
    // A pointer that comes back during the fade keeps the text.
    setHidden((last) => (last?.phase === "leaving" ? null : last));
  };
  const onFocus = (event: FocusEvent) => {
    if (!focus && event.relatedTarget instanceof HTMLElement && !root.current?.contains(event.relatedTarget)) cameFrom.current = event.relatedTarget;
    setFocus(true);
  };
  const onBlur = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget))) setFocus(false);
  };

  return createPortal(
    <div
      ref={root}
      className="ui-toast"
      onPointerEnter={hold}
      onPointerMove={track}
      onPointerDown={track}
      onPointerLeave={() => setHover(false)}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* aria-live too: a modal dialog hides the rest of the page from a screen reader, but not a live region. */}
      <div role="status" aria-live="polite" aria-label={noteName} data-toast-note="" className="ui-toast-region">
        {note && (
          <div className="ui-toast-note">
            <div className="ui-toast-note-paper">
              <p className="ui-toast-note-text">{note.text}</p>{" "}
              <Button
                size="small"
                aria-label={note.action.name}
                onClick={() => {
                  restore.current = true;
                  note.action.onClick();
                }}
              >
                {note.action.label}
              </Button>
            </div>
          </div>
        )}
      </div>
      <div role="status" aria-live="polite" data-toast-status="" className="ui-toast-region">
        {phase !== "closed" && (
          // The key makes a new element for each status, so the same text shows again with its fade in.
          <p key={statusKey} className="ui-toast-status" data-leaving={phase === "leaving" ? "" : undefined}>
            {status}
          </p>
        )}
      </div>
    </div>,
    document.body,
  );
}
