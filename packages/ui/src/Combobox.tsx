import { Combobox as BaseCombobox } from "@base-ui/react/combobox";
import { useState } from "react";
import type { SelectOption } from "./Select.tsx";

type Item<T> = { value: T; label: string };

export type ComboboxProps<T> = {
  options: readonly SelectOption<T>[];
  /** Gets the value of the option the user picks. The field then clears. */
  onPick: (value: T) => void;
  /** The text in the empty field, for example "Add an item…". */
  placeholder?: string;
  "aria-label"?: string;
  /** Layout classes, for example width. */
  className?: string;
};

/**
 * A text field that filters a long list as the user types, for an action
 * such as "add this", with Base UI Combobox inside. Its role is combobox. A
 * pick calls `onPick` and clears the field; the field keeps no value. Put it
 * in a label, or give it an `aria-label`.
 */
export function Combobox<T>({ options, onPick, placeholder, "aria-label": ariaLabel, className }: ComboboxProps<T>) {
  const [text, setText] = useState("");
  const items: Item<T>[] = options.map(([value, label]) => ({ value, label }));
  return (
    <BaseCombobox.Root<Item<T>>
      items={items}
      value={null}
      onValueChange={(item) => {
        if (item === null) return;
        setText("");
        onPick(item.value);
      }}
      inputValue={text}
      onInputValueChange={setText}
      itemToStringLabel={(item) => item.label}
    >
      <BaseCombobox.Input placeholder={placeholder} aria-label={ariaLabel} className={className ? `ui-combobox ${className}` : "ui-combobox"} />
      <BaseCombobox.Portal>
        <BaseCombobox.Positioner sideOffset={2} className="ui-select-positioner">
          <BaseCombobox.Popup className="ui-select-popup">
            <BaseCombobox.Empty className="ui-select-empty">No match.</BaseCombobox.Empty>
            <BaseCombobox.List>
              {(item: Item<T>) => (
                <BaseCombobox.Item key={String(item.value)} value={item} className="ui-select-item">
                  {item.label}
                </BaseCombobox.Item>
              )}
            </BaseCombobox.List>
          </BaseCombobox.Popup>
        </BaseCombobox.Positioner>
      </BaseCombobox.Portal>
    </BaseCombobox.Root>
  );
}
