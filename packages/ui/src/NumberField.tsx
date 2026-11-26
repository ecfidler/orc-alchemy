import { NumberField as BaseNumberField } from "@base-ui/react/number-field";
import { type KeyboardEvent, type Ref, useRef } from "react";

export type NumberFieldProps = {
  /** The number, or null for an empty field. */
  value: number | null;
  /** Gets the whole number in the field after each change, or null when the field is empty. */
  onValueChange: (value: number | null) => void;
  /**
   * Gets the whole number when the player is done with it: at the loss of the focus after a typed change, at Enter
   * (the focus stays in the field), and at each step of the Up and Down arrow keys. A typed number outside `min` and
   * `max` still reaches it.
   */
  onValueCommitted?: (value: number | null) => void;
  /**
   * True: the Up and Down arrow keys step from `value`, and a typed number that is not committed yet goes. A step
   * outside `min` and `max` does nothing. Use it with `onValueCommitted`, which gets the step.
   */
  stepFromValue?: boolean;
  /** The lower limit of the arrow keys. A typed number below it still reaches onValueChange. */
  min?: number;
  /** The upper limit of the arrow keys. A typed number above it still reaches onValueChange. */
  max?: number;
  /** True: the field takes no input and no focus, and has the disabled look. */
  disabled?: boolean;
  /** The name, when the field is not in a label. */
  "aria-label"?: string;
  /** A ref to the input element, for example to move the focus to it. */
  inputRef?: Ref<HTMLInputElement>;
  /** Layout classes, for example a width. */
  className?: string;
};

/** A number as a whole number: "|| 0" turns -0 into 0. */
const whole = (n: number | null) => (n === null ? null : Math.trunc(n) || 0);

/**
 * A field for a whole number, with Base UI NumberField inside. Its role is
 * textbox. The Up and Down arrow keys change the number by 1. It shows the
 * number with no grouping, for example 1000, not 1,000. A disabled field
 * has the muted text and the border of a disabled control.
 */
export function NumberField({
  value,
  onValueChange,
  onValueCommitted,
  stepFromValue = false,
  min,
  max,
  disabled = false,
  "aria-label": ariaLabel,
  inputRef,
  className,
}: NumberFieldProps) {
  // True while a typed number goes: the loss of the focus that drops it does not report it.
  const dropping = useRef(false);
  // True while the field has a typed number that is not committed.
  const typed = useRef(false);

  // Base UI commits a typed number only at the loss of the focus: Enter, and an arrow key that drops the typed
  // number, take the focus away and give it back.
  const refocus = (input: HTMLInputElement) => {
    input.blur();
    input.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (onValueCommitted === undefined) return;
    const input = event.currentTarget;
    if (event.key === "Enter") {
      refocus(input);
      return;
    }
    if (!stepFromValue || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    // Base UI does not step after preventDefault.
    event.preventDefault();
    if (typed.current) {
      dropping.current = true;
      refocus(input);
      dropping.current = false;
    }
    if (value === null) return;
    const next = value + (event.key === "ArrowUp" ? 1 : -1);
    if ((min === undefined || next >= min) && (max === undefined || next <= max)) onValueCommitted(next);
  };

  return (
    <BaseNumberField.Root
      value={value}
      onValueChange={(next, details) => {
        if (dropping.current) return;
        typed.current = details.reason === "input-change" || details.reason === "input-clear" || details.reason === "input-paste";
        onValueChange(whole(next));
      }}
      onValueCommitted={(next) => {
        typed.current = false;
        if (!dropping.current) onValueCommitted?.(whole(next));
      }}
      min={min}
      max={max}
      allowOutOfRange
      disabled={disabled}
      format={{ useGrouping: false }}
      className="ui-number"
    >
      <BaseNumberField.Input
        ref={inputRef}
        aria-label={ariaLabel}
        onKeyDownCapture={onKeyDown}
        className={className ? `ui-number-input ${className}` : "ui-number-input"}
      />
    </BaseNumberField.Root>
  );
}
