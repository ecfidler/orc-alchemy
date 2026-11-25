import { Menu as BaseMenu } from "@base-ui/react/menu";
import { type ReactNode, type RefObject, useId, useRef } from "react";
import { Button, type ButtonSize } from "./Button.tsx";
import type { PixelIconName } from "./Icon.tsx";

/** An item of the menu of a split button, in up to three columns. */
export type SplitButtonItem<T> = {
  value: T;
  /** The first column: the name of the item. */
  label: string;
  /** The second column, in bold: a short value, for example a change "+2". */
  detail?: string;
  /** The third column, muted, at the end: a short note, for example "2 left". */
  aside?: string;
  disabled?: boolean;
};

/**
 * The props of the menu. With `items` (an array, or null or undefined when the menu has no items now), `menuLabel` is
 * required. Without `items`, the control is a plain Button, and it takes no menu props.
 */
export type SplitButtonMenuProps<T> =
  | {
      /** The name of the arrow part. It is also the title and the name of the menu. */
      menuLabel: string;
      /** The items of the menu. With null or none, there is no arrow part: the control is a plain Button. */
      items: readonly SplitButtonItem<T>[] | null | undefined;
      /** Gets the value of the item the user picks. The menu then closes. */
      onPick?: (value: T) => void;
      /** Disables the arrow part. */
      menuDisabled?: boolean;
      /** A text at the bottom of the menu, under the items. It also describes the menu. */
      menuNote?: ReactNode;
      /**
       * When set, the menu has the width and the left edge of this element, and
       * opens under it, for example the column that holds the control on a narrow
       * page. By default the menu opens under the control, at its end.
       */
      widthOf?: RefObject<HTMLElement | null> | null;
    }
  | { menuLabel?: undefined; items?: undefined; onPick?: undefined; menuDisabled?: undefined; menuNote?: undefined; widthOf?: undefined };

export type SplitButtonProps<T> = SplitButtonMenuProps<T> & {
  /** The text of the main part. It names the main button. */
  children: ReactNode;
  /** A pixel icon before the text of the main part, as on Button. */
  icon?: PixelIconName;
  /** "solid" (the default) or "ghost". The two parts have the same look. */
  variant?: "solid" | "ghost";
  size?: ButtonSize;
  /** The action of the main part. */
  onClick: () => void;
  /** Disables the main part. The arrow part has its own `menuDisabled`. */
  disabled?: boolean;
  /** The id of a text that describes the main part, for example a hint under the control. */
  "aria-describedby"?: string;
  /** The name of the group of the two parts. */
  "aria-label"?: string;
  /** Layout classes for the group, as on Button. */
  className?: string;
};

/**
 * A button with an arrow part that opens a menu: the main part does the
 * usual action, and the menu lists the other choices. The two parts are
 * buttons in a group. A pick calls `onPick` and closes the menu, and the
 * focus goes back to the arrow part. With no items it is a plain Button.
 */
export function SplitButton<T>({
  children,
  icon,
  variant = "solid",
  size = "normal",
  onClick,
  disabled = false,
  "aria-describedby": describedBy,
  "aria-label": ariaLabel,
  menuLabel,
  items,
  onPick,
  menuDisabled = false,
  menuNote,
  widthOf,
  className,
}: SplitButtonProps<T>) {
  const group = useRef<HTMLDivElement>(null);
  const noteId = useId();
  const main = (
    <Button variant={variant} size={size} icon={icon} disabled={disabled} aria-describedby={describedBy} onClick={onClick} className="ui-split-main">
      {children}
    </Button>
  );
  const withClass = (name: string) => (className ? `${name} ${className}` : name);
  if (!items || items.length === 0)
    return (
      <div role="group" aria-label={ariaLabel} className={withClass("ui-split")}>
        {main}
      </div>
    );
  // The column of the details shows only when an item has one.
  const details = items.some((item) => item.detail);
  return (
    <div ref={group} role="group" aria-label={ariaLabel} className={withClass("ui-split")}>
      {main}
      <BaseMenu.Root>
        <BaseMenu.Trigger disabled={menuDisabled} render={<Button variant={variant} size={size} aria-label={menuLabel} className="ui-split-arrow" />} />
        <BaseMenu.Portal>
          <BaseMenu.Positioner
            side="bottom"
            align={widthOf ? "start" : "end"}
            sideOffset={4}
            anchor={widthOf ?? group}
            collisionPadding={8}
            className="ui-select-positioner"
          >
            <BaseMenu.Popup
              aria-label={menuLabel}
              aria-describedby={menuNote ? noteId : undefined}
              className="ui-split-menu"
              data-fill={widthOf ? "" : undefined}
              data-details={details ? "" : undefined}
            >
              <div aria-hidden className="ui-split-menu-title">
                {menuLabel}
              </div>
              {items.map((item, i) => (
                <BaseMenu.Item key={i} disabled={item.disabled} onClick={() => onPick?.(item.value)} className="ui-split-item">
                  <span>{item.label}</span>
                  {details && <span className="ui-split-detail">{item.detail}</span>}
                  <span className="ui-split-aside">{item.aside}</span>
                </BaseMenu.Item>
              ))}
              {menuNote && (
                <div id={noteId} className="ui-split-note">
                  {menuNote}
                </div>
              )}
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </BaseMenu.Root>
    </div>
  );
}
