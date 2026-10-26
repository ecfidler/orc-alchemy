import { Field as BaseField } from "@base-ui/react/field";
import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import type { ReactNode } from "react";

/**
 * A group of controls under a legend, with Base UI Fieldset inside. The
 * legend names the group. `label` names it instead when the visible legend
 * is not the right name for it.
 */
export function Fieldset({ legend, label, className, children }: { legend: ReactNode; label?: string; className?: string; children?: ReactNode }) {
  return (
    <BaseFieldset.Root
      className={className ? `ui-fieldset ${className}` : "ui-fieldset"}
      {...(label === undefined ? {} : { "aria-label": label, "aria-labelledby": undefined })}
    >
      <BaseFieldset.Legend className="ui-fieldset-legend">{legend}</BaseFieldset.Legend>
      {children}
    </BaseFieldset.Root>
  );
}

/**
 * A field: its controls, then its errors, with Base UI Field inside. The
 * errors are a list named "Problems: {label}", shown only when there are
 * some, and the field is invalid while it has them. A Base UI control in
 * the field gets the list as its description.
 */
export function Field({ label, errors, className, children }: { label: string; errors: string[]; className?: string; children?: ReactNode }) {
  return (
    <BaseField.Root invalid={errors.length > 0} className={className}>
      {children}
      {errors.length > 0 && (
        <BaseField.Error match render={<ul aria-label={`Problems: ${label}`} className="ui-field-errors" />}>
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </BaseField.Error>
      )}
    </BaseField.Root>
  );
}
