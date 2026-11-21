// A word in a small box (docs/design/spells-panel.md, "The spell view" and
// "The list"): the spell view and the rows of the Spells panel use it.
import type { ReactNode } from "react";

/**
 * A word in a small box, in Inter caps, for example "Ritual" or
 * "Concentration". `label` gives it a name for a screen reader in place of
 * its text, for example "Concentration" for a "C". `onInk`: the tag is on
 * the ink fill of a selected row, so its text and box are paper.
 */
export function BoxTag({ children, className = "", label, onInk = false }: { children: ReactNode; className?: string; label?: string; onInk?: boolean }) {
  return (
    <span
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      className={`inline-block border px-[5px] align-[2px] font-sans text-[10px] leading-[1.6] font-semibold tracking-[0.06em] whitespace-nowrap not-italic uppercase ${
        onInk ? "border-paper text-paper" : "border-rule-strong text-ink-muted"
      } ${className}`}
    >
      {children}
    </span>
  );
}
