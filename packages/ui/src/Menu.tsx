import { Menu as BaseMenu } from "@base-ui/react/menu";
import { type ReactNode, type Ref, useId } from "react";
import { Button, type ButtonSize } from "./Button.tsx";
import type { PixelIconName } from "./Icon.tsx";

/**
 * An item of a Menu: its value, its text, and an optional short note in
 * small muted type at the end of its line, for example "new". The note is a
 * part of the item's name, after a space: "Chain Mail 16".
 */
export type MenuItem<T> = readonly [value: T, text: string, note?: string];

type MenuBase<T> = {
  /** The name of the button that opens the menu. It is also the text of a ghost button. */
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
  /** A ref to the button, for example to give the focus back to it after a dialog that an item opens. */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Layout classes for the button, as on Button. A bare button takes all its look from them. */
  className?: string;
};

/**
 * The props of a Menu. "ghost" (the default) is a ghost button with the label as its text, a size and an optional
 * icon. "bare" has no look of its own: its `className` draws it all, and `children` is its content, for example a box
 * of a page that opens the menu. The label still names it. A prop of the other variant is a type error.
 */
export type MenuProps<T> = MenuBase<T> &
  (
    | {
        variant?: "ghost";
        children?: never;
        size?: ButtonSize;
        /** A pixel icon before the label, as on Button. */
        icon?: PixelIconName;
      }
    | {
        variant: "bare";
        /** The content of the bare button, in place of the label. */
        children: ReactNode;
        size?: never;
        icon?: never;
      }
  );

/**
 * A button that opens a list of actions, with Base UI Menu inside. The
 * button has the ghost look, or none with `variant="bare"`. A pick calls
 * `onPick` and closes the menu. The third element of an item adds a muted
 * note at the end of its line. `title` shows a title over the items, and
 * `checked` makes the items radio items.
 */
export function Menu<T>(props: MenuProps<T>) {
  const { label, items, onPick, title, checked, buttonRef, className } = props;
  const titleId = useId();
  // The space makes the accessible name "Chain Mail 16", not "Chain Mail16". The item is a flex box, so the space does not show.
  const content = (text: string, note: string | undefined) => (
    <>
      {text}
      {note && (
        <>
          {" "}
          <span className="ui-menu-note">{note}</span>
        </>
      )}
    </>
  );
  return (
    <BaseMenu.Root>
      {props.variant === "bare" ? (
        <BaseMenu.Trigger aria-label={label} render={<Button ref={buttonRef} variant="bare" className={className} />}>
          {props.children}
        </BaseMenu.Trigger>
      ) : (
        <BaseMenu.Trigger render={<Button ref={buttonRef} variant="ghost" size={props.size ?? "small"} icon={props.icon} className={className} />}>
          {label}
        </BaseMenu.Trigger>
      )}
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
