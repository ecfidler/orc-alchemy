import { Button as BaseButton } from "@base-ui/react/button";
import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";

export type ButtonVariant = "solid" | "ghost" | "link";
export type ButtonSize = "small" | "normal" | "large";

export type ButtonProps = Omit<ComponentProps<typeof BaseButton>, "className" | "render" | "type"> & {
  /** "ghost" (the default) is an outlined button, "solid" is filled with ink, "link" looks like a link. */
  variant?: ButtonVariant;
  /** "small" fits in a row of fields, "large" is for the main actions of a page. */
  size?: ButtonSize;
  /** "button" (the default) or "submit". */
  type?: "button" | "submit";
  /** Layout classes only, for example width or alignment. The look comes from the variant. */
  className?: string;
};

/**
 * A button, with Base UI Button inside. A ghost button with `aria-pressed`
 * or `aria-current` set shows as solid while it is pressed or current.
 */
export function Button({ variant = "ghost", size = "normal", type = "button", className, ...props }: ButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      data-variant={variant}
      data-size={variant === "link" ? undefined : size}
      className={className ? `ui-button ${className}` : "ui-button"}
    />
  );
}

type ButtonLinkProps = { className?: string; "data-variant"?: ButtonVariant; "data-size"?: ButtonSize };

/**
 * A link with the look of a button. `render` is the link element, for
 * example the router's link; this gives it its class (replacing any class
 * on it) and its text. It stays a link.
 */
export function ButtonLink({
  variant = "ghost",
  size = "normal",
  render,
  children,
}: {
  variant?: Exclude<ButtonVariant, "link">;
  size?: ButtonSize;
  render: ReactElement<ButtonLinkProps>;
  children: ReactNode;
}) {
  return cloneElement(render, { className: "ui-button", "data-variant": variant, "data-size": size }, children);
}
