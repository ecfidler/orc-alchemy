import { Menu as BaseMenu } from "@base-ui/react/menu";
import { type ReactNode, type Ref, useId } from "react";
import { Button, type ButtonSize } from "./Button.tsx";
import type { PixelIconName } from "./Icon.tsx";

/**
 * An item of a Menu: its value, its text, and an optional short note in
 * small muted type at the end of its line, for example "new". The note is a
 * part of the item's name.
 */
export type MenuItem<T> = readonly [value: T, text: string, note?: string];

export type MenuProps<T> = {
  /** The name of the button that opens the menu. It is also the text of the button, but for a bare button with `children`. */
  label: string;
  items: readonly MenuItem<T>[];
  /** Gets the value of the item the user picks. */
  onPick: (value: T) => void;
  /**
   * The title at the top of the list, in bold. It is also the name of the list. Without it, the list has no title
   * and the label names it.
   */
  title?: string;
  /**
   * The value of the item that is checked, for a menu that picks one of its items. With it, the items are radio
   * items: the checked one is bold, and a screen reader reads its state. Compared with ===; undefined is no radio.
   */
  checked?: T;
  /**
   * "ghost" (the default) is a ghost button. "bare" has no look of its own: its `className` draws it all, and
   * `children` is its content in place of the label, for example a box of a page that opens the menu.
   */
  variant?: "ghost" | "bare";
  /** The content of a bare button. The label still names it. */
  children?: ReactNode;
  size?: ButtonSize;
  /** A pixel icon before the label, as on Button. */
  icon?: PixelIconName;
  /** A ref to the button, for example to give the focus back to it after a dialog that an item opens. */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Layout classes for the button, as on Button. A bare button takes all its look from them. */
  className?: string;
};

/**
 * A button that opens a list of actions, with Base UI Menu inside. The
 * button has the ghost look, or none with `variant="bare"`. A pick calls
 * `onPick` and closes the menu. The third element of an item adds a muted
 * note at the end of its line. `title` shows a title over the items, and
 * `checked` makes the items radio items.
 */
export function Menu<T>({ label, items, onPick, title, checked, variant = "ghost", children, size = "small", icon, buttonRef, className }: MenuProps<T>) {
  const bare = variant === "bare";
  const titleId = useId();
  const content = (text: string, note: string | undefined) => (
    <>
      {text}
      {note && <span className="ui-menu-note">{note}</span>}
    </>
  );
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger
        aria-label={bare && children !== undefined ? label : undefined}
        render={<Button ref={buttonRef} variant={variant} size={size} icon={icon} className={className} />}
      >
        {bare && children !== undefined ? children : label}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={2} align="start" className="ui-select-positioner">
          {/* The title names the list in place of the button. It is hidden, so a screen reader does not read it twice. */}
          <BaseMenu.Popup aria-labelledby={title ? titleId : undefined} className="ui-select-popup">
            {title && (
              <div id={titleId} aria-hidden className="ui-menu-title">
                {title}
              </div>
            )}
            {checked === undefined ? (
              items.map(([value, text, note], i) => (
                <BaseMenu.Item key={i} onClick={() => onPick(value)} className="ui-select-item">
                  {content(text, note)}
                </BaseMenu.Item>
              ))
            ) : (
              <BaseMenu.RadioGroup value={checked}>
                {items.map(([value, text, note], i) => (
                  <BaseMenu.RadioItem key={i} value={value} closeOnClick onClick={() => onPick(value)} className="ui-select-item">
                    {content(text, note)}
                  </BaseMenu.RadioItem>
                ))}
              </BaseMenu.RadioGroup>
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
