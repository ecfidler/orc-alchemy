import { Select as BaseSelect } from "@base-ui/react/select";

/** An option: its value, and the text that shows. */
export type SelectOption<T> = readonly [value: T, label: string];

export type SelectProps<T> = {
  /** The picked value, or null when nothing is picked. A value that is not an option shows as nothing picked. */
  value: T | null;
  options: readonly SelectOption<T>[];
  /** Gets the value of the option the user picks. An option with a null value gives null. */
  onValueChange: (value: T) => void;
  /** The text while nothing is picked. */
  placeholder?: string;
  "aria-label"?: string;
  disabled?: boolean;
  /** Layout classes, for example width. */
  className?: string;
};

/**
 * A pick of one value from a list, with Base UI Select inside. Its role is
 * combobox, and its text is the picked option. The list opens below it.
 * Put it in a label, or give it an `aria-label`.
 */
export function Select<T>({ value, options, onValueChange, placeholder, "aria-label": ariaLabel, disabled, className }: SelectProps<T>) {
  // Base UI shows a value that is not an option as its raw text.
  const known = options.some(([option]) => Object.is(option, value));
  return (
    <BaseSelect.Root<T>
      value={known ? value : null}
      // Base UI gives only the value of a picked item, so it is a T.
      onValueChange={(next) => onValueChange(next as T)}
      items={options.map(([value, label]) => ({ value, label }))}
      disabled={disabled}
    >
      <BaseSelect.Trigger aria-label={ariaLabel} className={className ? `ui-select ${className}` : "ui-select"}>
        <BaseSelect.Value placeholder={placeholder} />
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner alignItemWithTrigger={false} sideOffset={2} className="ui-select-positioner">
          <BaseSelect.Popup className="ui-select-popup">
            <BaseSelect.List>
              {options.map(([value, label], i) => (
                <BaseSelect.Item key={i} value={value} className="ui-select-item">
                  <BaseSelect.ItemText>{label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
