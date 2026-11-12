import { Button as BaseButton } from "@base-ui/react/button";
import { forwardRef, useId, useRef, useState } from "react";
import { ListModal, type ListItem } from "./ListModal.tsx";
import { Token, Tokens } from "./Token.tsx";

export type AddButtonProps = {
  /** The text after the "+", for example "Add a part". It names the button. */
  label: string;
  /** The number of options that remain, shown on the right as "15 more". It describes the button. Leave it out to show no count. */
  remaining?: number;
  onClick?: () => void;
  /** "dialog" when the button opens a ListModal. */
  "aria-haspopup"?: "dialog";
  "aria-expanded"?: boolean;
  disabled?: boolean;
  /** Layout classes, as on Button. */
  className?: string;
};

/**
 * A wide ghost button that adds to a list: "+ {label}" on the left, and the
 * number of options that remain on the right. It gives a ref, so a
 * ListModal can give the focus back to it.
 */
export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(function AddButton({ label, remaining, className, ...props }, ref) {
  const countId = useId();
  return (
    <BaseButton
      {...props}
      ref={ref}
      type="button"
      data-variant="ghost"
      data-size="normal"
      data-wide=""
      aria-describedby={remaining === undefined ? undefined : countId}
      className={className ? `ui-button ui-add-button ${className}` : "ui-button ui-add-button"}
    >
      <span>
        <span aria-hidden="true">+ </span>
        {label}
      </span>
      {remaining !== undefined && (
        <span id={countId} aria-hidden="true" className="ui-add-count">
          {remaining} more
        </span>
      )}
    </BaseButton>
  );
});

export type PickerProps<T> = {
  /** The add button's text after the "+", for example "Add a part". */
  label: string;
  /** The modal's title. It is `label` when it is not set. */
  title?: string;
  /** All the options, in the order of the list. Groups show as small headings in the modal. */
  options: readonly ListItem<T>[];
  /** The picked values. A value that is no option shows no token, and stays in the value. */
  value: readonly T[];
  /** Gets the new value: a pick goes at the end, and a removed value leaves. */
  onValueChange: (value: T[]) => void;
  /** A search field in the modal. docs/design/homebrew-forms.md, "Picker", gives one to a list of more than about 20 options. */
  search?: boolean;
  /** The modal's footer text for the number of picks, as on ListModal. By default it is "3 picked". */
  pickedText?: (picked: number) => string;
  /** Layout classes. */
  className?: string;
};

/**
 * Some values from a long list: the picks as Tokens, in the order of
 * `options` (not of the clicks), then an AddButton with the number of
 * options that remain. The button opens a ListModal that stays open; a
 * picked option leaves its list. Values are compared with `Object.is`.
 * For other uses, such as one slot that a caller fills, use ListModal and
 * Token directly.
 */
export function Picker<T>({ label, title, options, value, onValueChange, search, pickedText, className }: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const has = (v: T) => value.some((picked) => Object.is(picked, v));
  // Each token keeps the place of its option in `options` as its key, so the X of a removed token unmounts.
  const picked = options.map((option, at) => ({ option, at })).filter(({ option }) => has(option.value));
  const left = options.filter((option) => !has(option.value));
  return (
    <div className={className ? `ui-picker ${className}` : "ui-picker"}>
      <Tokens>
        {picked.map(({ option, at }) => (
          <Token key={at} label={option.label} onRemove={() => onValueChange(value.filter((v) => !Object.is(v, option.value)))} />
        ))}
      </Tokens>
      <AddButton ref={button} label={label} remaining={left.length} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} />
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title={title ?? label}
        items={left}
        onPick={(v) => onValueChange([...value, v])}
        stayOpen
        picked={picked.length}
        pickedText={pickedText}
        search={search}
        finalFocus={button}
      />
    </div>
  );
}
