import { NumberField as BaseNumberField } from "@base-ui/react/number-field";

export type NumberFieldProps = {
  /** The number, or null for an empty field. */
  value: number | null;
  /** Gets the whole number the user typed, or null when the field is empty or has no number. */
  onValueChange: (value: number | null) => void;
  /** The limits of the arrow keys. A typed number outside them still reaches onValueChange. */
  min?: number;
  max?: number;
  /** The name, when the field is not in a label. */
  "aria-label"?: string;
  /** Layout classes, for example a width. */
  className?: string;
};

/**
 * A field for a whole number, with Base UI NumberField inside. Its role is
 * textbox. The Up and Down arrow keys change the number by 1. It shows the
 * number with no grouping, for example 1000, not 1,000.
 */
export function NumberField({ value, onValueChange, min, max, "aria-label": ariaLabel, className }: NumberFieldProps) {
  return (
    <BaseNumberField.Root
      value={value}
      onValueChange={(next) => onValueChange(next === null ? null : Math.trunc(next))}
      min={min}
      max={max}
      allowOutOfRange
      format={{ useGrouping: false }}
      className="ui-number"
    >
      <BaseNumberField.Input aria-label={ariaLabel} className={className ? `ui-number-input ${className}` : "ui-number-input"} />
    </BaseNumberField.Root>
  );
}
