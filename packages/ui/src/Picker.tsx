import { Button as BaseButton } from "@base-ui/react/button";
import { type CSSProperties, forwardRef, useId, useRef, useState } from "react";
import { PixelIcon } from "./Icon.tsx";
import { type ListItem, ListModal } from "./ListModal.tsx";
import { Token, Tokens } from "./Token.tsx";

export type AddButtonProps = {
  /** The text after the plus icon, for example "Add a part". It names the button. */
  label: string;
  /** The number of options that remain, shown on the right as "15 more". It describes the button. Leave it out to show no count. */
  remaining?: number;
  /**
   * Text after the label, in place of the count: for example the names of
   * the first options. It describes the button. The text is on the line of
   * the label, and "…" cuts it. In a button that is narrower than 520px it
   * is on a second line, and it wraps.
   */
  detail?: string;
  onClick?: () => void;
  /** "dialog" when the button opens a ListModal. */
  "aria-haspopup"?: "dialog";
  "aria-expanded"?: boolean;
  "aria-busy"?: boolean;
  disabled?: boolean;
  /**
   * Why the button takes no more picks, for example "Remove a choice first.".
   * When set, the button is disabled but keeps the focus, the reason shows on
   * the right in place of the count, and it describes the button and is its
   * tooltip (ORC-370).
   */
  blocked?: string;
  /** Layout classes, as on Button. */
  className?: string;
};

/**
 * A wide ghost button that adds to a list: the plus icon and the label on the left, and the
 * number of options that remain on the right, or `detail` after the label.
 * It gives a ref, so a ListModal can give the focus back to it.
 */
export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(function AddButton({ label, remaining, detail, blocked, className, ...props }, ref) {
  const descriptionId = useId();
  const described = blocked !== undefined || detail !== undefined || remaining !== undefined;
  return (
    <BaseButton
      {...props}
      {...(blocked !== undefined && { disabled: true, focusableWhenDisabled: true, title: blocked })}
      ref={ref}
      type="button"
      data-variant="ghost"
      data-size="normal"
      data-wide=""
      data-detail={detail === undefined ? undefined : ""}
      aria-describedby={described ? descriptionId : undefined}
      className={className ? `ui-button ui-add-button ${className}` : "ui-button ui-add-button"}
    >
      <span className="ui-add-label">
        <PixelIcon name="plus" />
        {label}
      </span>
      {blocked !== undefined ? (
        <span id={descriptionId} aria-hidden="true" className="ui-add-count">
          {blocked}
        </span>
      ) : detail !== undefined ? (
        <span id={descriptionId} aria-hidden="true" className="ui-add-detail">
          {detail}
        </span>
      ) : (
        remaining !== undefined && (
          <span id={descriptionId} aria-hidden="true" className="ui-add-count">
            {remaining} more
          </span>
        )
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
  /**
   * The number of token lines that the picker keeps a place for, also with
   * no pick, so that a pick does not move what comes after the token line:
   * the add button, or with `addFirst` what is below the picker. A token
   * line is 28px high. More tokens than fit still wrap to a new line.
   */
  reserve?: number;
  /**
   * Why the picker takes no more picks, for example "Remove a choice first."
   * when it has its maximum. The add button is then disabled, with the reason
   * (AddButton `blocked`). The tokens and their X stay (ORC-370).
   */
  blocked?: string;
  /**
   * True: the add button comes first and the token line under it, so the
   * button stays right under the heading of the picker and the reserved
   * place of the tokens is below it (ORC-371). By default the tokens come
   * first.
   */
  addFirst?: boolean;
  /** Layout classes. */
  className?: string;
};

/**
 * Some values from a long list: the picks as Tokens, in the order of
 * `options` (not of the clicks), then an AddButton with the number of
 * options that remain. The button opens a ListModal that stays open; a
 * picked option leaves its list. An option with `unavailable` is a locked
 * row, and it is not in the count. With `reserve`, the token line keeps its
 * height before the first pick. Values are compared with `Object.is`.
 * For other uses, such as one slot that a caller fills, use ListModal and
 * Token directly.
 */
export function Picker<T>({ label, title, options, value, onValueChange, search, pickedText, reserve, blocked, addFirst = false, className }: PickerProps<T>) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const has = (v: T) => value.some((picked) => Object.is(picked, v));
  // Each token keeps the place of its option in `options` as its key, so the X of a removed token unmounts.
  const picked = options.map((option, at) => ({ option, at })).filter(({ option }) => has(option.value));
  const left = options.filter((option) => !has(option.value));
  const lines = reserve !== undefined && reserve > 0 ? reserve : undefined;
  const addButton = (
    <AddButton
      ref={button}
      label={label}
      remaining={left.filter((option) => option.unavailable === undefined).length}
      blocked={blocked}
      // A pick that is on its way is busy until it shows as a token. When the modal closes first, the add button shows it.
      aria-busy={left.some((option) => option.busy) || undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(true)}
    />
  );
  return (
    <div
      className={className ? `ui-picker ${className}` : "ui-picker"}
      data-reserve={lines === undefined ? undefined : ""}
      style={lines === undefined ? undefined : ({ "--token-lines": lines } as CSSProperties)}
    >
      {addFirst && addButton}
      <Tokens>
        {picked.map(({ option, at }) => (
          <Token key={at} label={option.label} busy={option.busy} onRemove={() => onValueChange(value.filter((v) => !Object.is(v, option.value)))} />
        ))}
      </Tokens>
      {!addFirst && addButton}
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
