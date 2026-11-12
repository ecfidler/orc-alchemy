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
 * With `look="section"`, the legend is a section title in Inter caps on a
 * rule; a fieldset in a section shows its legend as a small label instead.
 * With `look="block"`, the group is a part of a section, such as a part the
 * user added: a rule on its left and a plain bold legend, also in a section.
 * `action` is a small control at the end of the legend row, after the
 * rule, for example a link button that removes the section. It is not a
 * part of the group's name, so give it its own name.
 */
export function Fieldset({
  legend,
  name,
  errors = [],
  look = "plain",
  action,
  className,
  children,
}: {
  legend: string;
  name?: string;
  errors?: string[];
  look?: "plain" | "section" | "block";
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const errorsId = useId();
  // With a name, the legend is only shown, so it does not name the group.
  const legendNode = name === undefined ? <BaseFieldset.Legend className="ui-fieldset-legend">{legend}</BaseFieldset.Legend> : <div className="ui-fieldset-legend">{legend}</div>;
  return (
    <BaseFieldset.Root
      data-look={look}
      className={className ? `ui-fieldset ${className}` : "ui-fieldset"}
      aria-label={name}
      aria-describedby={errors.length > 0 ? errorsId : undefined}
    >
      {action === undefined ? (
        legendNode
      ) : (
        <div className="ui-fieldset-head">
          {legendNode}
          <span className="ui-fieldset-action">{action}</span>
        </div>
      )}
      {children}
      <FieldErrors id={errorsId} label={name ?? legend} errors={errors} />
    </BaseFieldset.Root>
  );
}

/**
 * A label above its control, in Inter caps: a `<label>` around both, so
 * the label names the control and a click on it goes to the control. A
 * control with its own `aria-label` keeps that name; then put the visible
 * label's words in it. `className` is for layout and spacing.
 */
export function FieldLabel({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={className ? `ui-field-label ${className}` : "ui-field-label"}>
      <span className="ui-label">{label}</span>
      {children}
    </label>
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
