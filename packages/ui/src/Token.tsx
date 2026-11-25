import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Button, XButton } from "./Button.tsx";
import { useRefocus } from "./refocus.ts";
import { SmallPopup, type SmallPopupProps } from "./SmallPopup.tsx";

/** The look of a token: "plain" (the default), "dashed" for a token that the app adds by itself, "bubble" for the use bubble fill. */
type TokenLook = "plain" | "dashed" | "bubble";

/** The props of every token. */
type TokenBaseProps = {
  /** The text of the token. A long text wraps inside the token. */
  label: string;
  /** Gets a click on the X. Leave it out for a token with no X. */
  onRemove?: () => void;
  /** The name in the X's name "Remove {name}", when it is not `label`, for example "Row 4" for a token that shows "4". */
  name?: string;
  /** The X's whole name, when "Remove" is not the right word, for example "Put back Pears". */
  removeName?: string;
  /** A short note after the text, in small muted type, for example "added by the app". It is a part of the token's text. */
  note?: string;
  /** "dashed": a dashed border. "bubble": the use bubble fill and border. */
  look?: TokenLook;
  /** With it, the token is a group with this name, for a token that holds more than one control. */
  groupName?: string;
  /** "small": 13px semibold sans text, for a row of status tokens in a box. */
  size?: "normal" | "small";
  /** Marks the token, for example as a pick that the user changed: a thicker border, a yellow bar on the left and semibold text. Say so in a name too. */
  marked?: boolean;
  /** A small control after the text, for example a NumberToggle with `size="small"`. Give it its own name. */
  children?: ReactNode;
  /** Layout classes. */
  className?: string;
};

/** The text is a plain text. */
type PlainLabel = { onOpen?: never; openName?: never; openHint?: never; popup?: never; popupOnHover?: never };

/** The text is a button that calls `onOpen`. */
type OpenLabel = {
  /** The text is a button that calls it, for example to open a list that changes the pick. */
  onOpen: () => void;
  /** The name of the text's button, when it is not `label`, for example "Change basket Pears". */
  openName?: string;
  /** A short word after the text in the button, in small muted type, for example "Change". It is not a part of the button's name. */
  openHint?: string;
  popup?: never;
  popupOnHover?: never;
};

/** The text is a button that opens a SmallPopup under the token. */
type PopupLabel = {
  /** The title and the controls or the text of the SmallPopup. The owner controls `open`. */
  popup: Omit<SmallPopupProps, "trigger" | "anchor" | "takeFocus">;
  /** The name of the text's button, when it is not `label`. */
  openName?: string;
  /**
   * A mouse over the token opens the popup too, and the mouse leaving the
   * token closes it, unless a click opened it. A click on the text while the
   * mouse holds it open keeps it open, and so does a press on another
   * control of the token. The popup that the mouse opens takes no focus. A
   * touch does not open it.
   */
  popupOnHover?: boolean;
  onOpen?: never;
  openHint?: never;
};

/**
 * The props of a token. The text has one of three modes: a plain text, a
 * button with `onOpen` (and `openHint`), or a button with `popup` (and
 * `popupOnHover`). Props of two modes together are a type error.
 */
export type TokenProps = TokenBaseProps & (PlainLabel | OpenLabel | PopupLabel);

/**
 * One pick: a small box with its text and an X. The X is named
 * "Remove {label}", and removes the pick. With `onOpen`, the text is a
 * button, for example for a slot that holds one value: the button opens a
 * list for a new value, and the X puts the first value back. With `popup`,
 * the text is a button that opens a SmallPopup under the token. Put tokens in
 * Tokens, or put one token alone in a cell.
 */
export function Token({
  label,
  onRemove,
  name,
  removeName,
  onOpen,
  openName,
  openHint,
  popup,
  popupOnHover,
  note,
  look,
  groupName,
  size,
  marked,
  children,
  className,
}: TokenProps) {
  const token = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const hover = Boolean(popup && popupOnHover);
  const hoverOnly = hover && hovered && !popup?.open;
  const onOpenChange: SmallPopupProps["onOpenChange"] = (next, reason) => {
    if (!next && hoverOnly) {
      // A click on the text makes the popup that the mouse opened an open by the click.
      if (reason === "trigger-press") return popup?.onOpenChange(true, reason);
      // A press in the token, for example on its circles, is outside the popup: the popup stays while the mouse is there.
      if (reason === "outside-press") return;
    }
    if (!next) setHovered(false);
    popup?.onOpenChange(next, reason);
  };
  return (
    <span
      ref={token}
      onPointerEnter={hover ? (event) => event.pointerType !== "touch" && setHovered(true) : undefined}
      onPointerLeave={hover ? () => setHovered(false) : undefined}
      className={className ? `ui-token ${className}` : "ui-token"}
      data-marked={marked ? "" : undefined}
      data-look={look === "plain" ? undefined : look}
      data-size={size === "small" ? "small" : undefined}
      role={groupName ? "group" : undefined}
      aria-label={groupName}
    >
      {popup ? (
        <SmallPopup
          {...popup}
          open={popup.open || hoverOnly}
          onOpenChange={onOpenChange}
          takeFocus={!hoverOnly}
          anchor={token}
          trigger={
            <Button variant="bare" className="ui-token-label ui-token-open" aria-label={openName}>
              {label}
            </Button>
          }
        />
      ) : onOpen ? (
        <button type="button" className="ui-token-label ui-token-open" aria-label={openName} onClick={onOpen}>
          {label}
          {openHint && (
            <span className="ui-token-hint" aria-hidden="true">
              {openHint}
            </span>
          )}
        </button>
      ) : (
        <span className="ui-token-label">{label}</span>
      )}
      {note && <span className="ui-token-note">{note}</span>}
      {children}
      {onRemove && <XButton size="small" aria-label={removeName ?? `Remove ${name ?? label}`} onClick={onRemove} />}
    </span>
  );
}

/**
 * The tokens of a group on one line that wraps. When an X removes its
 * token, the focus goes to the X of the next token, or of the last one, or
 * to the first button after the tokens when none is left. When the X goes
 * and its token stays, the focus goes to the token's text button. Other
 * children, for example an add menu, sit at the end of the line.
 */
export function Tokens({ children, className }: { children?: ReactNode; className?: string }) {
  const line = useRef<HTMLDivElement>(null);
  const x = ".ui-token > .ui-x-button";
  // The token of the X that was clicked. This runs before useRefocus, so a token that stays keeps the focus.
  const clickedToken = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const token = clickedToken.current;
    clickedToken.current = null;
    const active = document.activeElement;
    if (!token?.isConnected || token.querySelector(".ui-x-button") || (active && active !== document.body)) return;
    token.querySelector<HTMLElement>(".ui-token-open")?.focus();
  });
  const refocus = useRefocus(line, x, () => {
    const own = [...(line.current?.querySelectorAll<HTMLElement>("button") ?? [])].find((b) => !b.closest(".ui-token"));
    const after = line.current?.nextElementSibling;
    return own ?? (after?.matches("button") ? (after as HTMLElement) : after?.querySelector<HTMLElement>("button"));
  });
  return (
    <div
      ref={line}
      className={className ? `ui-tokens ${className}` : "ui-tokens"}
      onClickCapture={(e) => {
        const target = e.target instanceof Element ? e.target : null;
        clickedToken.current = target?.closest(x) ? target.closest(".ui-token") : null;
        refocus(e.target);
      }}
    >
      {children}
    </div>
  );
}
