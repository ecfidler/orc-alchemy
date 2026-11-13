import type { ReactNode } from "react";

/**
 * A flat yellow line of text, in the flow of a form, for something the user
 * can act on there, such as a suggestion. It is not tilted and has no
 * shadow. `action` adds a link button at the end of the line: `label` is
 * its text, and `name` is its accessible name when the label alone does not
 * say what it acts on. The name must hold the label's words.
 */
export function NoteLine({ children, action }: { children: ReactNode; action?: { label: string; name?: string; onClick: () => void } }) {
  return (
    <p className="ui-note-line">
      {children}
      {action && (
        <>
          {" "}
          <button type="button" className="ui-note-line-action" aria-label={action.name} onClick={action.onClick}>
            {action.label}
          </button>
        </>
      )}
    </p>
  );
}
