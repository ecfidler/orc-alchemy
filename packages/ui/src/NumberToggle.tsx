import { Toggle, ToggleGroup } from "./Toggle.tsx";

export type NumberToggleProps = {
  /** The pressed value. null is "None". */
  value: number | null;
  /** The segments, in order. null shows as "None"; for example `[null, 1, 2, 3]`, or `[1, 2, 3]` for a toggle in a token. */
  values: readonly (number | null)[];
  /** Gets the value of the segment that the user presses. A press on the pressed segment changes nothing. */
  onValueChange: (value: number | null) => void;
  /** "normal" (the default), or "small" for a toggle in a token. */
  size?: "normal" | "small";
  /** Layout classes. */
  className?: string;
} & ({ /** The group's name. */ "aria-label": string; "aria-labelledby"?: never } | { /** The id of the element that names the group. */ "aria-labelledby": string; "aria-label"?: never });

const key = (value: number | null) => (value === null ? "none" : String(value));

/**
 * A segmented toggle for one number from a short list, for example
 * None / 1 / 2 / 3, on ToggleGroup. One segment is always pressed. It is
 * one tab stop: Left and Right, Home and End move between the segments,
 * and Space or Enter presses one.
 */
export function NumberToggle({ value, values, onValueChange, size = "normal", className, ...name }: NumberToggleProps) {
  return (
    <ToggleGroup {...name} value={[key(value)]} data-size={size} className={className ? `ui-number-toggle ${className}` : "ui-number-toggle"}>
      {values.map((v) => (
        <Toggle key={key(v)} value={key(v)} className="ui-segment" onPressedChange={(pressed) => pressed && onValueChange(v)}>
          {v === null ? "None" : String(v)}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
