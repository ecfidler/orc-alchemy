import { NumberField as BaseNumberField } from "@base-ui/react/number-field";

export type NumberFieldProps = {
  /** The number, or null for an empty field. */
  value: number | null;
  /** Gets the whole number in the field after each change, or null when the field is empty. */
  onValueChange: (value: number | null) => void;
  /** The lower limit of the arrow keys. A typed number below it still reaches onValueChange. */
  min?: number;
  /** The upper limit of the arrow keys. A typed number above it still reaches onValueChange. */
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
      // "|| 0" turns -0 into 0.
      onValueChange={(next) => onValueChange(next === null ? null : Math.trunc(next) || 0)}
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
