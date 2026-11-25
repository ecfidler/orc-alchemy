import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentProps } from "react";

export type ToggleProps = Omit<ComponentProps<typeof BaseToggle<string>>, "className" | "render" | "nativeButton"> & {
  /**
   * "ghost" (the default) has the ghost button look, and is solid while it is pressed. "bare" has no look of its own,
   * pressed or not: the owner draws it all with `className`, as on a bare Button.
   */
  variant?: "ghost" | "bare";
  /** Layout and spacing classes, as on Button. With "bare", the classes that draw it. */
  className?: string;
};

/**
 * A button that is on or off, with Base UI Toggle inside. By default it has
 * the ghost button look, and is solid while it is pressed. With
 * `variant="bare"` it has no look of its own. On its own it takes
 * `pressed` and `onPressedChange`. In a ToggleGroup, give it a `value`; the
 * group's `value` then sets whether it is pressed.
 */
export function Toggle({ variant = "ghost", className, ...props }: ToggleProps) {
  return (
    <BaseToggle
      {...props}
      data-variant={variant}
      data-size={variant === "bare" ? undefined : "normal"}
      className={className ? `ui-button ${className}` : "ui-button"}
    />
  );
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
    | { /** The group's name. */ "aria-label": string; "aria-labelledby"?: never }
    | { /** The id of the element that names the group, for example its heading. */ "aria-labelledby": string; "aria-label"?: never }
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
