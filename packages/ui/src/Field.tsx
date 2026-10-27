import { Field as BaseField } from "@base-ui/react/field";
import { Fieldset as BaseFieldset } from "@base-ui/react/fieldset";
import { useId, type ReactNode } from "react";

const errorItems = (errors: string[]) => errors.map((error, i) => <li key={i}>{error}</li>);

/**
 * A list of errors named "Problems: {label}", or nothing when there are
 * none. Use it alone for errors that belong to no field or group, such as
 * the errors of a whole form; Field and Fieldset show their own.
 */
export function FieldErrors({ label, errors, id }: { label: string; errors: string[]; id?: string }) {
  if (errors.length === 0) return null;
  return (
    <ul id={id} aria-label={`Problems: ${label}`} className="ui-field-errors">
      {errorItems(errors)}
    </ul>
  );
}

/**
 * A group of controls under a visible legend, with Base UI Fieldset inside.
 * The legend names the group; `name` names it instead when the legend is
 * not the right name. `errors` are the group's errors: a list named
 * "Problems: {name or legend}" at the end of the group, which describes
 * the group. The errors belong to the group, not to the controls in it.
 */
export function Fieldset({
  legend,
  name,
  errors = [],
  className,
  children,
}: {
  legend: string;
  name?: string;
  errors?: string[];
  className?: string;
  children?: ReactNode;
}) {
  const errorsId = useId();
  return (
    <BaseFieldset.Root
      className={className ? `ui-fieldset ${className}` : "ui-fieldset"}
      aria-label={name}
      aria-describedby={errors.length > 0 ? errorsId : undefined}
    >
      {/* With a name, the legend is only shown, so it does not name the group. */}
      {name === undefined ? <BaseFieldset.Legend className="ui-fieldset-legend">{legend}</BaseFieldset.Legend> : <div className="ui-fieldset-legend">{legend}</div>}
      {children}
      <FieldErrors id={errorsId} label={name ?? legend} errors={errors} />
    </BaseFieldset.Root>
  );
}

/**
 * One field: its control, then its errors, with Base UI Field inside. The
 * errors are a list named "Problems: {label}", and the field is invalid
 * while it has some. A Base UI control in the field gets the list as its
 * description. Put one control in a field; a group's errors go on its
 * Fieldset.
 */
export function Field({ label, errors, children }: { label: string; errors: string[]; children: ReactNode }) {
  return (
    <BaseField.Root invalid={errors.length > 0}>
      {children}
      {errors.length > 0 && (
        <BaseField.Error match render={<ul aria-label={`Problems: ${label}`} className="ui-field-errors" />}>
          {errorItems(errors)}
        </BaseField.Error>
      )}
    </BaseField.Root>
  );
}
