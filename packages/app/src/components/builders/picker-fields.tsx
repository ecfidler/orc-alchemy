// The pickers of the homebrew forms: a picker of a map, of a set, and of a proficiency choice.
import { type ListItem, Picker } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import type { Choice } from "../../engine/builder-choices.ts";
import { asSet, setItems, tag, untag } from "../../engine/content.ts";
import { type Edit, type ItemRecord, numbers, type Path, range, Section, SelectField } from "./fields.tsx";

/** One option of a picker group: a Choice, with the small heading of its run in the list. */
export type PickItem = Choice & { group?: string };

/** The add button and the list of a picker group. */
export interface PickerOptions {
  /** The add button's text after the "+", such as "Add a skill". */
  add: string;
  /** A search field in the list. docs/design/homebrew-forms.md, "Picker", gives one to a list of more than about 20 options. */
  search?: boolean;
  /** MapPicker only: a stored key that is no option, such as one of a pack that is not enabled, shows as a token named by its key (withOthers). For a SetPicker, give it withOthers items. */
  others?: boolean;
}

/**
 * The items, then an item for each of the stored keys that is no item,
 * named by its key. Thus a stored value that no list has shows as a token,
 * and stays until the user removes it.
 */
export function withOthers(items: PickItem[], keys: string[]): PickItem[] {
  const known = new Set(items.map((item) => item.key));
  const others = [...new Set(keys)].filter((key) => !known.has(key));
  return [...items, ...others.map((key) => ({ key, name: key }))];
}

/** The footer text of a form's picker list: the number of picks on the form. */
export const pickedText = (n: number) => `${n} on the form`;
const listItems = (items: PickItem[], value: (item: PickItem) => string = (item) => item.key): ListItem<string>[] =>
  items.map((item) => ({ value: value(item), label: item.name, group: item.group }));

/**
 * A picker of the map at path, as {:path {:key true}}, as the old
 * checkboxes stored it: a pick stores true, and a removed token stores
 * false, as the old second click. With removeKey, a removed token removes
 * the key, and a key with a truthy value shows as a token, as the old
 * checkboxes of the background builder did. Only the picked or removed key
 * changes, so a key that is no option keeps its value; with picker.others
 * it also shows as a token.
 */
export function MapPicker({
  edit,
  path,
  items,
  picker,
  removeKey = false,
}: {
  edit: Edit;
  path: Path;
  items: PickItem[];
  picker: PickerOptions;
  removeKey?: boolean;
}) {
  const map = (edit.get(...path) ?? {}) as ItemRecord;
  const value = Object.keys(map)
    .filter((key) => (removeKey ? Boolean(map[key]) : map[key] === true))
    .map(untag);
  return (
    <Picker
      label={picker.add}
      options={listItems(picker.others ? withOthers(items, value) : items)}
      value={value}
      search={picker.search}
      pickedText={pickedText}
      onValueChange={(next) => {
        const added = next.filter((key) => !value.includes(key)).map((key): [Path, unknown] => [[...path, key], true]);
        const removed = value.filter((key) => !next.includes(key)).map((key): [Path, unknown] => [[...path, key], removeKey ? undefined : false]);
        edit.setAll([...added, ...removed]);
      }}
    />
  );
}

/**
 * A picker of the set at path, such as ["languages"] or
 * ["spellcasting", "spell-list", intKey(1)], as the old checkboxes stored
 * it: a pick adds the item's stored value at the end, and a removed token
 * takes it out. stored is the value the set holds for an item, such as its
 * keyword. A stored value that is no option stays in the set.
 */
export function SetPicker({
  edit,
  path,
  items,
  picker,
  stored = (item) => tag(item.key),
}: {
  edit: Edit;
  path: Path;
  items: PickItem[];
  picker: PickerOptions;
  stored?: (item: PickItem) => string;
}) {
  return (
    <Picker
      label={picker.add}
      options={listItems(items, stored)}
      value={setItems(edit.get(...path)) as string[]}
      search={picker.search}
      pickedText={pickedText}
      onValueChange={(next) => edit.set(path, asSet(next))}
    />
  );
}

/**
 * A proficiency choice in :profs: a "Choose n" select, then a picker for
 * the options, as {:skill-options {:choose 2 :options {:arcana true}}}.
 * Choose shows 1 until it is set. A pick stores true, and a removed token
 * stores false, as the old checkboxes' second click.
 */
export function ChoicePicker({
  edit,
  legend,
  field,
  items,
  picker,
  action,
}: {
  edit: Edit;
  legend: string;
  field: string;
  items: PickItem[];
  picker: PickerOptions;
  action?: ReactNode;
}) {
  return (
    <Section legend={legend} action={action}>
      <div className="grid gap-[10px]">
        <SelectField
          label="Choose"
          name={`${legend}: choose`}
          value={edit.get("profs", field, "choose")}
          options={numbers(range(1, 6))}
          onSelect={(n) => edit.set(["profs", field, "choose"], n)}
          className="justify-self-start"
        />
        <MapPicker edit={edit} path={["profs", field, "options"]} items={items} picker={picker} />
      </div>
    </Section>
  );
}
