import { type FocusEvent, useState } from "react";
import { NoteLine } from "./NoteLine.tsx";
import { NumberField } from "./NumberField.tsx";
import { Label } from "./Paper.tsx";

/** The text of the note when an amount field has no number. */
export const AMOUNT_NOTE = "Type a number of 0 or more.";

/**
 * Selects the text of a field when it gets the focus, so that a typed
 * number replaces it. Give it as `onFocus` to an element around the field.
 */
export function selectOnFocus(event: FocusEvent) {
  if (event.target instanceof HTMLInputElement) event.target.select();
}

/**
 * The space of the note of a form: a polite status line with one NoteLine,
 * or empty. It keeps the height of a note, so a popup keeps its size when
 * the note comes or goes.
 */
export function NoteSpace({ note }: { note: string | null }) {
  return (
    <div role="status" className="ui-note-space">
      {note !== null && <NoteLine>{note}</NoteLine>}
    </div>
  );
}

/** The state of an amount field, from useAmount. */
export interface Amount {
  /** The number in the field, or null when it is empty. */
  value: number | null;
  /** Sets the number. It also removes the note. */
  onValueChange: (value: number | null) => void;
  /** AMOUNT_NOTE after a submit with no number of 0 or more, else null. */
  note: string | null;
  /** Gives the amount to `act` when the field has a number of 0 or more. Else it shows the note. */
  submit: (act: (amount: number) => void) => void;
}

/** The state of an amount field: a whole number of 0 or more, empty or `initial` at first. */
export function useAmount(initial: number | null = null): Amount {
  const [value, setValue] = useState<number | null>(initial);
  const [missing, setMissing] = useState(false);
  return {
    value,
    onValueChange: (next) => {
      setValue(next);
      setMissing(false);
    },
    note: missing ? AMOUNT_NOTE : null,
    submit: (act) => {
      if (value !== null && value >= 0) act(value);
      else setMissing(true);
    },
  };
}

export interface AmountFieldProps {
  /** The state, from useAmount. */
  amount: Amount;
  /** The name of the field, "Amount" by default. */
  label?: string;
  /** True: the label shows above the field. False: the label is only the name of the field. */
  showLabel?: boolean;
  /** The upper limit of the arrow keys. */
  max?: number;
  /** Classes for the field, for example its size. */
  className?: string;
}

/**
 * A NumberField for an amount of 0 or more. Its text is selected at the
 * focus, so that a typed number replaces it. Put a NoteSpace with
 * `amount.note` under the form.
 */
export function AmountField({ amount, label = "Amount", showLabel = true, max, className }: AmountFieldProps) {
  const field = (
    <NumberField value={amount.value} onValueChange={amount.onValueChange} min={0} max={max} aria-label={showLabel ? undefined : label} className={className} />
  );
  return showLabel ? (
    <label className="ui-amount-field" onFocus={selectOnFocus}>
      <Label>{label}</Label>
      {field}
    </label>
  ) : (
    <span className="ui-amount-field" onFocus={selectOnFocus}>
      {field}
    </span>
  );
}
