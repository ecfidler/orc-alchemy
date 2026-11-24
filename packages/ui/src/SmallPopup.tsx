import { Popover as BasePopover } from "@base-ui/react/popover";
import { type ReactElement, type ReactNode, type RefObject, useRef } from "react";

export type SmallPopupProps = {
  open: boolean;
  /** Gets true from a click on the trigger, and false from a second click on it, Escape and a click outside. */
  onOpenChange: (open: boolean) => void;
  /** The title at the top. It names the popup. */
  title: string;
  /**
   * The button that opens the popup, as a package `Button` element (it
   * takes a ref). Its name says what it opens. The popup gives it
   * `aria-expanded`.
   */
  trigger: ReactElement;
  /** The element that the popup opens under, for example the box that holds the trigger. By default, the trigger. */
  anchor?: RefObject<HTMLElement | null>;
  /**
   * When set, the popup has the width and the left edge of this element,
   * for example the panel that holds the box on a narrow page. It still
   * opens under `anchor`.
   */
  widthOf?: RefObject<HTMLElement | null> | null;
  /** The controls. The first field (else the first control) gets the focus at the open. */
  children: ReactNode;
};

/** The first field of the popup, else its first control. */
const FIRST = ["input:not([type='hidden']):not([disabled])", "textarea:not([disabled])", "select:not([disabled])", "button:not([disabled])"];

/**
 * A small popup under a box, with Base UI Popover inside: a title and its
 * controls, and no close button. The trigger opens it; a second click on
 * the trigger, Escape and a click outside close it. At the open, the focus
 * goes to the first field of the popup; at the close, it goes back to the
 * trigger. It is not modal: the page stays live. The owner closes it after
 * an action by setting `open` to false.
 */
export function SmallPopup({ open, onOpenChange, title, trigger, anchor, widthOf, children }: SmallPopupProps) {
  const popup = useRef<HTMLDivElement>(null);
  // With widthOf, a virtual anchor: the bottom of the anchor, and the left edge and width of widthOf.
  const positionAnchor = widthOf
    ? () => {
        const box = anchor?.current;
        const wide = widthOf.current;
        if (!box || !wide) return box ?? null;
        return {
          contextElement: box,
          getBoundingClientRect: () => {
            const b = box.getBoundingClientRect();
            const w = wide.getBoundingClientRect();
            return DOMRect.fromRect({ x: w.left, y: b.top, width: w.width, height: b.height });
          },
        };
      }
    : anchor;
  return (
    <BasePopover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={6} anchor={positionAnchor} collisionPadding={8} className="ui-popup-positioner">
          <BasePopover.Popup
            ref={popup}
            className="ui-popup"
            data-fill={widthOf ? "" : undefined}
            initialFocus={(type) => {
              for (const selector of FIRST) {
                const first = popup.current?.querySelector<HTMLElement>(selector);
                if (first) return first;
              }
              return type === "touch" ? true : null;
            }}
            finalFocus
          >
            <BasePopover.Title className="ui-popup-title">{title}</BasePopover.Title>
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
