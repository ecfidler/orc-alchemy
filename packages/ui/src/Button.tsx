import { Button as BaseButton } from "@base-ui/react/button";
import { type ComponentProps, cloneElement, type ReactElement, type ReactNode } from "react";
import { PixelIcon, type PixelIconName } from "./Icon.tsx";

export type ButtonVariant = "solid" | "ghost" | "link" | "plain";
export type ButtonSize = "small" | "normal" | "large";

export type ButtonProps = Omit<ComponentProps<typeof BaseButton>, "className" | "render" | "type" | "nativeButton" | "focusableWhenDisabled"> & {
  /**
   * "ghost" (the default) is an outlined button, "solid" is filled with ink, "link" looks like a link. "plain" looks
   * like the text around it, and its text is underlined under a mouse, for example a name in a list that opens more.
   */
  variant?: ButtonVariant;
  /** "small" fits in a row of fields, "large" is for the main actions of a page. */
  size?: ButtonSize;
  /** "button" (the default) or "submit". */
  type?: "button" | "submit";
  /** Layout and spacing classes, for example width, padding or alignment. Colors and borders come from the variant. */
  className?: string;
  /** The full width of its column, with the text on the left, for example a button that adds a row under a list. */
  wide?: boolean;
  /** A pixel icon before the text. It is decoration: the text names the button. */
  icon?: PixelIconName;
};

/**
 * A button, with Base UI Button inside. A ghost button with `aria-current`
 * set shows as solid while it is current. For a button that is on or off,
 * use Toggle.
 */
export function Button({ variant = "ghost", size = "normal", type = "button", className, wide = false, icon, children, ...props }: ButtonProps) {
  return (
    <BaseButton
      {...props}
      type={type}
      data-variant={variant}
      data-size={variant === "link" || variant === "plain" ? undefined : size}
      data-wide={wide && variant !== "link" && variant !== "plain" ? "" : undefined}
      className={className ? `ui-button ${className}` : "ui-button"}
    >
      {icon && <PixelIcon name={icon} />}
      {children}
    </BaseButton>
  );
}

/**
 * A square button that shows only an X, for example to remove a row. It
 * has no text, so `aria-label` names it, and the name also shows as its
 * tooltip.
 */
export function XButton({
  "aria-label": ariaLabel,
  onClick,
  disabled,
  size = "normal",
  className,
}: {
  "aria-label": string;
  onClick?: () => void;
  disabled?: boolean;
  /** "normal" (the default) is 30px square, "small" is 24px square, for example in a token. */
  size?: "normal" | "small";
  /** Layout classes, for example alignment in a grid. */
  className?: string;
}) {
  return (
    <BaseButton
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      data-size={size === "small" ? "small" : undefined}
      className={className ? `ui-x-button ${className}` : "ui-x-button"}
    />
  );
}

type ButtonLinkProps = { className?: string; "data-variant"?: ButtonVariant; "data-size"?: ButtonSize };

/**
 * A link with the look of a button. `render` is the link element, for
 * example the router's link; this gives it its class (replacing any class
 * on it) and its text. It stays a link. `className` and `icon` are as on
 * Button.
 */
export function ButtonLink({
  variant = "ghost",
  size = "normal",
  className,
  icon,
  render,
  children,
}: {
  variant?: Exclude<ButtonVariant, "link" | "plain">;
  size?: ButtonSize;
  className?: string;
  icon?: PixelIconName;
  render: ReactElement<ButtonLinkProps>;
  children: ReactNode;
}) {
  return cloneElement(
    render,
    { className: className ? `ui-button ${className}` : "ui-button", "data-variant": variant, "data-size": size },
    icon && <PixelIcon name={icon} />,
    children,
  );
}
