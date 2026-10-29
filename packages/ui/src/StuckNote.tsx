import type { ReactNode } from "react";

/**
 * A tilted yellow note above a box, for something the user must act on.
 * `children` is the box. The note takes its own space above the box and
 * overlaps only the box's top edge: it sets the box's top padding to 10px,
 * so it never covers the box's content. The note stays yellow in dark mode.
 * A button or link in `note` is its action. With no `note` (null, a
 * boolean or ""), the note does not show. The box stays in the same place in
 * the tree, with the same 10px top padding, so a note that comes and goes
 * does not mount the box again, lose its focus or move the page.
 */
export function StuckNote({ note, children }: { note: ReactNode; children: ReactNode }) {
  const shown = note != null && typeof note !== "boolean" && note !== "";
  return (
    <div className="ui-stuck">
      {/* The outer part casts the shadow; the inner part is clipped for the folded corner, which would clip a shadow too. */}
      {shown && (
        <div role="note" className="ui-stuck-note">
          <div className="ui-stuck-note-paper">{note}</div>
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * A count of things the user must do, as a small tilted yellow note, for
 * example on a step button. It is only a mark: give the count in words too,
 * for a screen reader.
 */
export function NoteCount({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="ui-note-count">
      {children}
    </span>
  );
}
