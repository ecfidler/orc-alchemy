import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, forwardRef } from "react";

export type ListRowProps = Omit<ComponentProps<typeof BaseButton>, "className" | "render" | "type" | "nativeButton" | "focusableWhenDisabled"> & {
  /** Layout and spacing classes, for example the padding of the row. Colors and borders come from the row. */
  className?: string;
};

/**
 * A row of a list as a button: flat, the full width, with a hairline under
 * it. It is a grid of two columns: the content, then an optional part at the
 * end, for example a mark or tags. Under a mouse or the keyboard focus it has
 * the panel fill. With `aria-current` it has the ink fill and paper text, and
 * its focus ring is paper, as a ghost button turns solid. The rows of
 * ListModal are ListRows. It gives a ref.
 */
export const ListRow = forwardRef<HTMLButtonElement, ListRowProps>(function ListRow({ className, ...props }, ref) {
  return <BaseButton {...props} ref={ref} type="button" className={className ? `ui-list-row ${className}` : "ui-list-row"} />;
});
