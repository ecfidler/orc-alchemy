import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { Ref } from "react";
import { Button, type ButtonSize } from "./Button.tsx";
import type { PixelIconName } from "./Icon.tsx";

/**
 * An item of a Menu: its value, its text, and an optional short note in
 * small muted type at the end of its line, for example "new". The note is a
 * part of the item's name.
 */
export type MenuItem<T> = readonly [value: T, text: string, note?: string];

export type MenuProps<T> = {
  /** The text of the button that opens the menu. It names the menu. */
  label: string;
  items: readonly MenuItem<T>[];
  /** Gets the value of the item the user picks. */
  onPick: (value: T) => void;
  size?: ButtonSize;
  /** A pixel icon before the label, as on Button. */
  icon?: PixelIconName;
  /** A ref to the button, for example to give the focus back to it after a dialog that an item opens. */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Layout classes for the button, as on Button. */
  className?: string;
};

/**
 * A button that opens a list of actions, with Base UI Menu inside. The
 * button has the ghost look. A pick calls `onPick` and closes the menu.
 * The third element of an item adds a muted note at the end of its line.
 */
export function Menu<T>({ label, items, onPick, size = "small", icon, buttonRef, className }: MenuProps<T>) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={<Button ref={buttonRef} size={size} icon={icon} className={className} />}>{label}</BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={2} align="start" className="ui-select-positioner">
          <BaseMenu.Popup className="ui-select-popup">
            {items.map(([value, text, note], i) => (
              <BaseMenu.Item key={i} onClick={() => onPick(value)} className="ui-select-item">
                {text}
                {note && <span className="ui-menu-note">{note}</span>}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
