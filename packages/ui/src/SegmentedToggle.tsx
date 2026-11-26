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
  /**
   * The segments fill a grid of equal cells, with 1px ink lines between them, for a row of long labels that goes to
   * two rows on a narrow page. Give the columns in `className`, for example `grid-cols-2 sm:grid-cols-4`.
   */
  fill?: boolean;
  /** Layout classes. */
  className?: string;
} & (
  | { /** The group's name. */ "aria-label": string; "aria-labelledby"?: never }
  | { /** The id of the element that names the group. */ "aria-labelledby": string; "aria-label"?: never }
);

/**
 * A segmented toggle for one value from a short list, for example
 * None / Fixed / Scaled, on ToggleGroup. NumberToggle is built on it. A
 * value that is no option presses no segment. It is one tab stop: Left and
 * Right, Home and End move between the segments, and Space or Enter presses
 * one. With `fill`, the segments are the equal cells of a grid.
 */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onValueChange,
  size = "normal",
  fill = false,
  className,
  ...name
}: SegmentedToggleProps<T>) {
  return (
    <ToggleGroup
      {...name}
      value={value === null ? [] : [value]}
      data-size={size}
      data-fill={fill ? "" : undefined}
      className={className ? `ui-segmented ${className}` : "ui-segmented"}
    >
      {options.map(([v, label]) => (
        <Toggle key={v} value={v} className="ui-segment" onPressedChange={(pressed) => pressed && onValueChange(v)}>
          {label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
