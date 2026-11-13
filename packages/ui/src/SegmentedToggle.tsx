import { Toggle, ToggleGroup } from "./Toggle.tsx";

export type SegmentedToggleProps<T extends string> = {
  /** The pressed value, or null when no segment is pressed. */
  value: T | null;
  /** The segments, in order: each its value and its text. */
  options: readonly (readonly [value: T, label: string])[];
  /** Gets the value of the segment that the user presses. A press on the pressed segment changes nothing. */
  onValueChange: (value: T) => void;
  /** "normal" (the default), or "small" for a toggle in a token. */
  size?: "normal" | "small";
  /** Layout classes. */
  className?: string;
} & ({ /** The group's name. */ "aria-label": string; "aria-labelledby"?: never } | { /** The id of the element that names the group. */ "aria-labelledby": string; "aria-label"?: never });

/**
 * A segmented toggle for one value from a short list, for example
 * None / Fixed / Scaled, on ToggleGroup. NumberToggle is built on it. A
 * value that is no option presses no segment. It is one tab stop: Left and
 * Right, Home and End move between the segments, and Space or Enter presses
 * one.
 */
export function SegmentedToggle<T extends string>({ value, options, onValueChange, size = "normal", className, ...name }: SegmentedToggleProps<T>) {
  return (
    <ToggleGroup {...name} value={value === null ? [] : [value]} data-size={size} className={className ? `ui-segmented ${className}` : "ui-segmented"}>
      {options.map(([v, label]) => (
        <Toggle key={v} value={v} className="ui-segment" onPressedChange={(pressed) => pressed && onValueChange(v)}>
          {label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
