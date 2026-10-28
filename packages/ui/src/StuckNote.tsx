import type { ReactNode } from "react";

/**
 * A tilted yellow note above a box, for something the user must act on.
 * `children` is the box. The note takes its own space above the box and
 * overlaps only the box's top edge: it sets the box's top padding to 10px,
 * so it never covers the box's content. The note stays yellow in dark mode.
 * A button or link in `note` is its action.
 */
export function StuckNote({ note, children }: { note: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-stuck">
      {/* The outer part casts the shadow; the inner part is clipped for the folded corner, which would clip a shadow too. */}
      <div role="note" className="ui-stuck-note">
        <div className="ui-stuck-note-paper">{note}</div>
      </div>
      {children}
    </div>
  );
}
