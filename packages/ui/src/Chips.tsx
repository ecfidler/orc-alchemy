import { Menu } from "./Menu.tsx";
import { Token, Tokens } from "./Token.tsx";

export type ChipsProps = {
  /** The numbers on the chips. They show from low to high. */
  values: readonly number[];
  /** The numbers that the add menu can add. The menu lists those that are not in `values`. */
  options: readonly number[];
  /** Gets the new numbers: an added number goes at the end, and a removed number leaves. */
  onValuesChange: (values: number[]) => void;
  /** The text of the add menu's button after the "+", for example "Add a row". It names the menu. */
  addLabel: string;
  /** The name of a number, for example "Row 4". It names a chip's X ("Remove Row 4") and is the menu item's text. By default it is the number. */
  name?: (value: number) => string;
};

/**
 * Removable number chips, each a Token with the number and an X, and a
 * "+ {addLabel}" Menu after them on the same line. The menu does not show
 * when every option is on a chip.
 */
export function Chips({ values, options, onValuesChange, addLabel, name = String }: ChipsProps) {
  const rest = options.filter((option) => !values.includes(option));
  return (
    <Tokens className="ui-chips">
      {[...values]
        .sort((a, b) => a - b)
        .map((value) => (
          <Token key={value} label={String(value)} name={name(value)} onRemove={() => onValuesChange(values.filter((v) => v !== value))} />
        ))}
      {rest.length > 0 && (
        <Menu label={addLabel} items={rest.map((value) => [value, name(value)] as const)} onPick={(value) => onValuesChange([...values, value])} className="ui-chip-add" />
      )}
    </Tokens>
  );
}
