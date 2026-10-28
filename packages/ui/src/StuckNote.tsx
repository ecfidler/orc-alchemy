import type { ReactNode } from "react";

/**
 * A tilted yellow note above a box, for something the user must act on.
 * `children` is the box. The note takes its own space above the box and
 * overlaps only the box's top edge: it never covers the box's content when
 * the box has at least 8px of top padding inside its border, as the
 * package's boxes have. The note stays yellow in dark mode. A button in
 * `note` is its action.
 */
export function StuckNote({ note, children }: { note: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-stuck">
      <div role="note" className="ui-stuck-note">
        {note}
      </div>
      {children}
    </div>
  );
}
