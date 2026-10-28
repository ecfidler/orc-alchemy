import { Radio as BaseRadio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type { ReactNode } from "react";

export type RadioGroupProps = {
  /** The value of the chosen radio, or undefined while none is chosen. */
  value: string | undefined;
  onValueChange: (value: string) => void;
  /** Layout classes, for example a stack. */
  className?: string;
  children?: ReactNode;
} & (
  | { /** The group's name. */ "aria-label": string; "aria-labelledby"?: never }
  | { /** The id of the element that names the group, for example its heading. */ "aria-labelledby": string; "aria-label"?: never }
);

/**
 * A named group of radios, with Base UI RadioGroup inside. One radio is
 * chosen at a time. The group is one tab stop, and the arrow keys move
 * the choice.
 */
export function RadioGroup({ value, onValueChange, className, children, ...name }: RadioGroupProps) {
  return (
    <BaseRadioGroup<string | null> {...name} value={value ?? null} onValueChange={(next) => next !== null && onValueChange(next)} className={className}>
      {children}
    </BaseRadioGroup>
  );
}

/** One radio of a RadioGroup, with a round mark and its visible label after it. */
export function Radio({ value, label, className }: { value: string; label: ReactNode; className?: string }) {
  return (
    <label className={className ? `ui-check-label ${className}` : "ui-check-label"}>
      <BaseRadio.Root value={value} className="ui-radio">
        <BaseRadio.Indicator className="ui-radio-mark" />
      </BaseRadio.Root>
      {label}
    </label>
  );
}
