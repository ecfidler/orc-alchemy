import type { ReactNode } from "react";

const KIND = { act: "Act", failed: "Failed", info: "Info" } as const;

/** The alert notes at the top of the page column, in the order given. */
export function AlertNotes({ children }: { children: ReactNode }) {
  return <div className="ui-alert-notes">{children}</div>;
}

/**
 * A flat note the width of the page column. The tone gives the meaning:
 * "act" (yellow) when the user must act, "failed" (red) when something
 * failed, "info" (blue) for information. Only an "info" note can be
 * dismissed. A button or link in the message is its action.
 */
export function AlertNote(
  props: { children: ReactNode } & ({ tone: "act" | "failed" } | { tone: "info"; onDismiss?: () => void }),
) {
  const { tone, children } = props;
  return (
    <div className="ui-alert-note" data-tone={tone} role={tone === "info" ? "status" : "alert"}>
      <span className="ui-alert-note-kind">{KIND[tone]}</span>
      <span className="ui-alert-note-message">{children}</span>
      {props.tone === "info" && props.onDismiss && (
        <button type="button" className="ui-alert-note-dismiss" aria-label="Dismiss" onClick={props.onDismiss}>
          ×
        </button>
      )}
    </div>
  );
}
