import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { type ReactNode, type RefObject, useEffect, useState } from "react";

export type DialogProps = {
  open: boolean;
  /**
   * Gets false from Cancel, Escape and a click outside. The dialog stays
   * open until the owner sets `open` to false, so the owner can ask first,
   * for example about changes that are not saved.
   */
  onOpenChange: (open: boolean) => void;
  /** The heading. It names the dialog. */
  title: string;
  /** The body. It scrolls when it is taller than the dialog. */
  children: ReactNode;
  /** The buttons after Cancel, at the end of the footer, for example a solid Save button. */
  actions?: ReactNode;
  /**
   * The element that gets the focus when the dialog closes. By default, the
   * element that had the focus before it opened. A function runs at the
   * close, so it can find an element that changed while the dialog was
   * open. Return null for the default.
   */
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null);
};

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
 * it.
 */
function useLateControlFocus(open: boolean, body: HTMLElement | null) {
  useEffect(() => {
    if (!open || body === null || body.querySelector(FOCUSABLE) !== null) return;
    const observer = new MutationObserver(() => {
      const first = body.querySelector<HTMLElement>(FOCUSABLE);
      if (first === null) return;
      observer.disconnect();
      if (!body.contains(document.activeElement)) first.focus();
    });
    observer.observe(body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, body]);
}

/**
 * A modal dialog, with Base UI Dialog inside: a title row, a body that
 * scrolls, and a footer with Cancel and the owner's `actions`. It is up to
 * 720px wide, and at 600px and less it fills the screen. The focus goes to
 * the first control of the body when it opens, or when that control shows,
 * if the body shows it later. Cancel, Escape and a click outside call
 * `onOpenChange(false)`.
 *
 * A ListModal, an AlertDialog or another Dialog that a part of the body
 * opens shows above this dialog. Escape and a click outside then close only
 * that one, and the focus comes back into this dialog.
 */
export function Dialog({ open, onOpenChange, title, children, actions, finalFocus }: DialogProps) {
  // A state, not a ref: the portal mounts the body after this component, and the effect must run again then.
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  useLateControlFocus(open, body);
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="ui-list-backdrop" />
        <BaseDialog.Popup className="ui-modal" finalFocus={typeof finalFocus === "function" ? () => finalFocus() : (finalFocus ?? true)}>
          <div className="ui-modal-head">
            <BaseDialog.Title className="ui-list-title">{title}</BaseDialog.Title>
          </div>
          <div ref={setBody} className="ui-modal-body">
            {children}
          </div>
          <div className="ui-modal-foot">
            {/* The button classes, not render={<Button />}: Button gives no ref, which Base UI needs. */}
            <BaseDialog.Close data-variant="ghost" data-size="normal" className="ui-button">
              Cancel
            </BaseDialog.Close>
            {actions}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
