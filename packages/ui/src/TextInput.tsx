import { Input } from "@base-ui/react/input";

type TextProps = {
  value: string;
  /** Gets the whole text after each change. */
  onValueChange: (value: string) => void;
  /** The name, when the control is not in a label, or when the label is not the right name. */
  "aria-label"?: string;
  /** Layout classes, for example a width. */
  className?: string;
};

export type TextInputProps = TextProps & {
  /** "normal" (the default) is up to 26rem wide, "short" up to 7rem, "full" the full width. */
  width?: "normal" | "short" | "full";
};

/**
 * A boxed one-line text field, with Base UI Input inside: a 1px ink border
 * on the raised paper. Its role is textbox. In a Field, the field's errors
 * describe it.
 */
export function TextInput({ value, onValueChange, "aria-label": ariaLabel, width = "normal", className }: TextInputProps) {
  return (
    <Input
      type="text"
      value={value}
      onValueChange={(next) => onValueChange(next)}
      aria-label={ariaLabel}
      data-width={width}
      className={className ? `ui-input ${className}` : "ui-input"}
    />
  );
}

export type TextAreaProps = TextProps & {
  /** The height in lines. The user can make it taller. */
  rows?: number;
};

/** A boxed text area of the full width, as TextInput. It stays a native textarea. */
export function TextArea({ value, onValueChange, "aria-label": ariaLabel, rows = 4, className }: TextAreaProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aria-label={ariaLabel}
      rows={rows}
      className={className ? `ui-textarea ${className}` : "ui-textarea"}
    />
  );
}
