import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentProps } from "react";

export type ToggleProps = Omit<ComponentProps<typeof BaseToggle<string>>, "className" | "render" | "nativeButton"> & {
  /** Layout and spacing classes, as on Button. */
  className?: string;
};

/**
 * A button that is on or off, with Base UI Toggle inside. It has the ghost
 * button look, and is solid while it is pressed. On its own it takes
 * `pressed` and `onPressedChange`. In a ToggleGroup, give it a `value`; the
 * group's `value` then sets whether it is pressed.
 */
export function Toggle({ className, ...props }: ToggleProps) {
  return <BaseToggle {...props} data-variant="ghost" data-size="normal" className={className ? `ui-button ${className}` : "ui-button"} />;
}

export type ToggleGroupProps = Omit<
  ComponentProps<typeof BaseToggleGroup<string>>,
  "className" | "render" | "defaultValue" | "value" | "aria-label" | "aria-labelledby"
> & {
  /** The values of the pressed toggles. The owner changes it from each toggle's `onPressedChange`. */
  value: readonly string[];
  /** Layout classes, for example a grid. */
  className?: string;
} & (
    | { /** The group's name. */ "aria-label": string }
    | { /** The id of the element that names the group, for example its heading. */ "aria-labelledby": string }
  );

/**
 * A named group of toggles, with Base UI ToggleGroup inside. The group is
 * one tab stop, on its first toggle. Left and Right, Home and End move
 * between its toggles, and Space or Enter presses one. Only one toggle is
 * pressed unless `multiple` is set.
 */
export function ToggleGroup(props: ToggleGroupProps) {
  return <BaseToggleGroup {...props} />;
}
