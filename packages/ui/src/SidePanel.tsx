import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";
import { Button } from "./Button.tsx";

export type SidePanelProps = {
  open: boolean;
  /** Gets false from Close, Escape and a click outside. The panel stays open until the owner sets `open` to false. */
  onOpenChange: (open: boolean) => void;
  /** The heading of the panel. It names the panel. */
  title: string;
  /** The body. It scrolls when it is taller than the window. */
  children: ReactNode;
  /**
   * The element that gets the focus when the panel closes. By default, the element that had the focus before it
   * opened, for example the button that opened it.
   */
  finalFocus?: RefObject<HTMLElement | null>;
};

/**
 * A modal panel at the right side of the window, over the page, with Base UI Dialog inside. It is the full height of
 * the window and up to 440px wide; under 720px it is the full width. It has a title row with a Close button, and a
 * body that scrolls. When it opens, the focus goes to the Close button. Close, Escape and a click outside call
 * `onOpenChange(false)`, and at the close the focus goes back to the element that opened it. A ListModal, an
 * AlertDialog or a Dialog that the body opens shows above it, as in a Dialog.
 */
export function SidePanel({ open, onOpenChange, title, children, finalFocus }: SidePanelProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="ui-list-backdrop" />
        <BaseDialog.Popup className="ui-side-panel" finalFocus={finalFocus ?? true}>
          <div className="ui-side-panel-head">
            <BaseDialog.Title className="ui-side-panel-title">{title}</BaseDialog.Title>
            <BaseDialog.Close render={<Button icon="x" />}>Close</BaseDialog.Close>
          </div>
          <div className="ui-side-panel-body">{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}
