import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./Button.tsx";

type DialogBase = {
  open: boolean;
  /**
   * Gets false from Cancel, the X, Escape and a click outside. The dialog
   * stays open until the owner sets `open` to false, so the owner can ask
   * first, for example about changes that are not saved.
   */
  onOpenChange: (open: boolean) => void;
  /** The heading. It names the dialog. When a wide dialog has its own `header`, the title does not show and only names the dialog. */
  title: string;
  /** The body. It scrolls when it is taller than the dialog. */
  children: ReactNode;
  /**
   * The element that gets the focus when the dialog closes. By default, the
   * element that had the focus before it opened. A function runs at the
   * close, so it can find an element that changed while the dialog was
   * open. Return null for the default.
   */
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null);
  /**
   * The element that gets the focus when the dialog opens, in place of the
   * first control of the body. A function runs at the open. Return null, or
   * leave the ref empty, for the default, which includes the focus on a
   * control that the body shows later.
   */
  initialFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null);
};

/** The props of a wide dialog only. */
type WideBase = {
  /** Up to 1100px wide, for content in two panes. */
  size: "wide";
  /**
   * True: the dialog is the height of the window less its margin, and the
   * body has no padding and no scroll of its own. The body is a flex column,
   * so the owner lays out its parts and sets which of them scroll, for
   * example two panes that scroll apart.
   */
  fill?: boolean;
};

export type DialogProps = DialogBase &
  (
    | ({
        /**
         * Not set or "normal": up to 720px wide, with the title row and a
         * footer. "narrow": the same, up to 520px wide, for a short form or
         * list. At 600px and less, each fills the screen.
         */
        size?: "normal" | "narrow";
        header?: never;
        fill?: never;
      } & (
        | {
            /** True or not set: the footer with Cancel and the `actions`. */
            footer?: true;
            /** The buttons after Cancel, at the end of the footer, for example a solid Save button. */
            actions?: ReactNode;
          }
        | {
            /** False: no footer, and an X named "Close" at the end of the title row closes the dialog, for content to read. */
            footer: false;
            actions?: never;
          }
      ))
    | (WideBase & {
        /** The content of the header row, in place of the title. The owner puts its own heading in it. */
        header?: ReactNode;
        /** True or not set: the footer with Cancel and the `actions`. */
        footer?: true;
        /** The buttons after Cancel, at the end of the footer. */
        actions?: ReactNode;
      })
    | (WideBase & {
        header?: ReactNode;
        /** False: no footer, and an X named "Close" at the end of the header row closes the dialog. */
        footer: false;
        /** No footer, so no actions. */
        actions?: never;
      })
  );

/** The controls that can take the focus. */
const FOCUSABLE = [
  "input:not([type='hidden']):not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "a[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Gives the focus to the first control of the body when the body shows its
 * controls after the dialog opens, for example after it reads data. When
 * the body has a control at the open, Base UI focuses it, and also keeps
 * the element to give the focus back to at the close. The focus moves only
 * while it is not in the body yet, so a control that the user picked keeps
 * it, and only when `ownFocus()` is false: an element that the owner set
 * as the initial focus keeps it.
 */
function useLateControlFocus(open: boolean, body: HTMLElement | null, ownFocus: () => boolean) {
  useEffect(() => {
    if (!open || body === null || body.querySelector(FOCUSABLE) !== null) return;
    const observer = new MutationObserver(() => {
      const first = body.querySelector<HTMLElement>(FOCUSABLE);
      if (first === null) return;
      observer.disconnect();
      if (!ownFocus() && !body.contains(document.activeElement)) first.focus();
    });
    observer.observe(body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, body, ownFocus]);
}

/**
 * A modal dialog, with Base UI Dialog inside: a title row, a body that
 * scrolls, and a footer with Cancel and the owner's `actions`. It is up to
 * 720px wide, and at 600px and less it fills the screen. The focus goes to
 * the first control of the body when it opens, or when that control shows,
 * if the body shows it later. `initialFocus` gives it to another element.
 * Cancel, Escape and a click outside call `onOpenChange(false)`.
 *
 * With `size="narrow"` it is up to 520px wide. With `size="wide"` it is up
 * to 1100px wide. The owner can then give its
 * own `header` in place of the title, and `footer={false}` removes the
 * footer and puts an X in the header row; a dialog of another size takes
 * `footer={false}` too, for content to read. The X also calls
 * `onOpenChange(false)`. `fill` gives it the height of the window less its
 * margin, and a body with no padding and no scroll, which the owner lays out.
 *
 * A ListModal, an AlertDialog or another Dialog that a part of the body
 * opens shows above this dialog. Escape and a click outside then close only
 * that one, and the focus comes back into this dialog.
 */
export function Dialog({ open, onOpenChange, title, children, actions, finalFocus, initialFocus, size, header, footer = true, fill = false }: DialogProps) {
  // A state, not a ref: the portal mounts the body after this component, and the effect must run again then.
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  // True when the owner's initial focus gave an element at the open. That element wins over the late focus of the body;
  // with no element (null, or an empty ref), the late focus works as by default.
  const ownFocused = useRef(false);
  const ownFocus = useCallback(() => ownFocused.current, []);
  // At the close the mark goes, so the next open starts with the default.
  useEffect(() => {
    if (!open) ownFocused.current = false;
  }, [open]);
  useLateControlFocus(open, body, ownFocus);
  const wide = size === "wide";
  const ownHeader = wide && header !== undefined;
  const withX = !footer;
  // Base UI gives the focus to the first control of the popup, and in a dialog with an X, that is the X. So this function gives it to the owner's
  // element, else to the first control of the body. When neither is there, it does as Base UI does: the popup on a touch screen, else the first control.
  const initial =
    initialFocus === undefined && !withX
      ? undefined
      : (type: string) => {
          const own = (typeof initialFocus === "function" ? initialFocus() : initialFocus?.current) ?? null;
          ownFocused.current = own !== null;
          return own ?? popup.current?.querySelector(".ui-modal-body")?.querySelector<HTMLElement>(FOCUSABLE) ?? (type === "touch" ? popup.current : true);
        };
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="ui-list-backdrop" />
        <BaseDialog.Popup
          ref={popup}
          className="ui-modal"
          data-size={size === "wide" || size === "narrow" ? size : undefined}
          data-fill={wide && fill ? "" : undefined}
          aria-label={ownHeader ? title : undefined}
          initialFocus={initial}
          finalFocus={typeof finalFocus === "function" ? () => finalFocus() : (finalFocus ?? true)}
        >
          <div className="ui-modal-head" data-x={withX ? "" : undefined}>
            {ownHeader ? <div className="ui-modal-own-head">{header}</div> : <BaseDialog.Title className="ui-list-title">{title}</BaseDialog.Title>}
            {withX && <BaseDialog.Close aria-label="Close" title="Close" className="ui-x-button ui-modal-x" />}
          </div>
          <div ref={setBody} className="ui-modal-body">
            {children}
          </div>
          {footer && (
            <div className="ui-modal-foot">
              <BaseDialog.Close render={<Button icon="x" />}>Cancel</BaseDialog.Close>
              {actions}
            </div>
          )}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
