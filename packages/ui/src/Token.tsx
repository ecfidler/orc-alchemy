import { useRef, type ReactNode } from "react";
import { XButton } from "./Button.tsx";
import { useRefocus } from "./refocus.ts";

export type TokenProps = {
  /** The text of the token. A long text wraps inside the token. */
  label: string;
  /** Gets a click on the X. */
  onRemove: () => void;
  /** The name in the X's name "Remove {name}", when it is not `label`, for example "Row 4" for a token that shows "4". */
  name?: string;
  /** A small control after the text, for example a NumberToggle with `size="small"`. Give it its own name. */
  children?: ReactNode;
  /** Layout classes. */
  className?: string;
};

/**
 * One pick: a small box with its text and an X. The X is named
 * "Remove {label}", and removes the pick. Put tokens in Tokens, or put one
 * token alone in a cell.
 */
export function Token({ label, onRemove, name, children, className }: TokenProps) {
  return (
    <span className={className ? `ui-token ${className}` : "ui-token"}>
      <span className="ui-token-label">{label}</span>
      {children}
      <XButton size="small" aria-label={`Remove ${name ?? label}`} onClick={onRemove} />
    </span>
  );
}

/**
 * The tokens of a group on one line that wraps. When an X removes its
 * token, the focus goes to the X of the next token, or of the last one, or
 * to the first button after the tokens when none is left. Other children,
 * for example an add menu, sit at the end of the line.
 */
export function Tokens({ children, className }: { children?: ReactNode; className?: string }) {
  const line = useRef<HTMLDivElement>(null);
  const x = ".ui-token > .ui-x-button";
  const refocus = useRefocus(line, x, () => {
    const own = [...(line.current?.querySelectorAll<HTMLElement>("button") ?? [])].find((b) => !b.closest(".ui-token"));
    const after = line.current?.nextElementSibling;
    return own ?? (after?.matches("button") ? (after as HTMLElement) : after?.querySelector<HTMLElement>("button"));
  });
  return (
    <div ref={line} className={className ? `ui-tokens ${className}` : "ui-tokens"} onClickCapture={(e) => refocus(e.target)}>
      {children}
    </div>
  );
}
