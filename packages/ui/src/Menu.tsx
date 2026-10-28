import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ButtonSize } from "./Button.tsx";
import type { SelectOption } from "./Select.tsx";

export type MenuProps<T> = {
  /** The text of the button that opens the menu. It names the menu. */
  label: string;
  items: readonly SelectOption<T>[];
  /** Gets the value of the item the user picks. */
  onPick: (value: T) => void;
  size?: ButtonSize;
};

/**
 * A button that opens a list of actions, with Base UI Menu inside. The
 * button has the ghost look. A pick calls `onPick` and closes the menu.
 */
export function Menu<T>({ label, items, onPick, size = "small" }: MenuProps<T>) {
  return (
    <BaseMenu.Root>
      {/* The button classes, not render={<Button />}: Button gives no ref, which Base UI needs. */}
      <BaseMenu.Trigger data-variant="ghost" data-size={size} className="ui-button">
        {label}
      </BaseMenu.Trigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={2} align="start" className="ui-select-positioner">
          <BaseMenu.Popup className="ui-select-popup">
            {items.map(([value, text], i) => (
              <BaseMenu.Item key={i} onClick={() => onPick(value)} className="ui-select-item">
                {text}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
