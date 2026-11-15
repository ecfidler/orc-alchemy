import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";

export type DialogProps = {
  open: boolean;
  /**
   * Gets false from the close button, Escape and a click outside. The
   * dialog stays open until the owner sets `open` to false, so the owner
   * can ask first, for example about changes that are not saved.
   */
  onOpenChange: (open: boolean) => void;
  /** The heading. It names the dialog. */
  title: string;
  /** The body. It scrolls when it is taller than the dialog. */
  children: ReactNode;
  /** The buttons after the close button, at the end of the footer, for example a solid Save button. */
  actions?: ReactNode;
  /** The text of the close button, the first button of the footer. It is "Cancel" by default. */
  close?: string;
  /**
   * The element that gets the focus when the dialog closes. By default, the
   * element that had the focus before it opened. A function runs at the
   * close, so it can find an element that changed while the dialog was
   * open. Return null for the default.
   */
  finalFocus?: RefObject<HTMLElement | null> | (() => HTMLElement | null);
};

/**
 * A modal dialog, with Base UI Dialog inside: a title row, a body that
 * scrolls, and a footer with a close button and the owner's `actions`. It
 * is up to 720px wide, and at 600px and less it fills the screen. The focus
 * goes to the first control of the body when it opens. The close button,
 * Escape and a click outside call `onOpenChange(false)`.
 *
 * A ListModal, an AlertDialog or another Dialog that a part of the body
 * opens shows above this dialog. Escape and a click outside then close only
 * that one, and the focus comes back into this dialog.
 */
export function Dialog({ open, onOpenChange, title, children, actions, close = "Cancel", finalFocus }: DialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="ui-list-backdrop" />
        <BaseDialog.Popup className="ui-modal" finalFocus={typeof finalFocus === "function" ? () => finalFocus() : (finalFocus ?? true)}>
          <div className="ui-modal-head">
            <BaseDialog.Title className="ui-list-title">{title}</BaseDialog.Title>
          </div>
          <div className="ui-modal-body">{children}</div>
          <div className="ui-modal-foot">
            {/* The button classes, not render={<Button />}: Button gives no ref, which Base UI needs. */}
            <BaseDialog.Close data-variant="ghost" data-size="normal" className="ui-button">
              {close}
            </BaseDialog.Close>
            {actions}
          </div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
