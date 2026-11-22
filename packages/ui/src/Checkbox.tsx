import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { type ReactNode, useId } from "react";

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Layout classes for the label, or for the box when there is no label. */
  className?: string;
  /**
   * -1 takes the box out of the Tab order, for a box that a key on another control also changes, for example Space
   * on a row of a list. A screen reader and a mouse still reach the box.
   */
  tabIndex?: -1;
} & (
  | {
      /** The visible label, after the box. A click on it checks the box too. */
      label: ReactNode;
      /** The box's accessible name, when the label is not the right name. The label stays visible. It is not a form field name. */
      name?: string;
      "aria-label"?: never;
    }
  | { /** The name, when no visible label is next to the box, for example in a table row. */ "aria-label": string; label?: never; name?: never }
);

/**
 * A checkbox with a square mark, with Base UI Checkbox inside. It is
 * controlled: `checked` is the state, and `onCheckedChange` gets the new one.
 */
export function Checkbox({ checked, onCheckedChange, disabled, className, tabIndex, label, name, "aria-label": ariaLabel }: CheckboxProps) {
  const id = useId();
  // Root sets its own tabIndex after the props, so render sets it on the box.
  const own = name !== undefined || tabIndex !== undefined;
  const box = (
    <BaseCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next)}
      disabled={disabled}
      aria-label={name ?? ariaLabel}
      // In a label, Base UI names the box by the label. A box labelled by itself takes its own aria-label instead.
      // Root's id prop goes to its hidden input, so render sets the id of the box itself.
      aria-labelledby={name === undefined ? undefined : id}
      render={own ? (props) => <span {...props} id={name === undefined ? props.id : id} tabIndex={tabIndex ?? props.tabIndex} /> : undefined}
      className={label === undefined && className ? `ui-check ${className}` : "ui-check"}
    >
      <BaseCheckbox.Indicator className="ui-check-mark" />
    </BaseCheckbox.Root>
  );
  if (label === undefined) return box;
  return (
    <label className={className ? `ui-check-label ${className}` : "ui-check-label"}>
      {box}
      {label}
    </label>
  );
}
