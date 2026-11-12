// The kinds of modifier that the homebrew forms share, with their lists, so
// that a form does not import them from another form. Each kind stores its
// values as the old app's checkbox events stored them (events.cljs): a map
// of true values, where a removed pick stores false; one number, which None
// removes; or a proficiency choice in :profs. The controls are those of
// docs/design/homebrew-forms.md, "Controls".
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import {
  ARTISANS_TOOLS,
  ChoicePicker,
  Checks,
  CONDITIONS,
  DAMAGE_TYPES,
  GAMING_SETS,
  MapPicker,
  MISC_TOOLS,
  MUSICAL_INSTRUMENTS,
  nameToKw,
  NumberChoice,
  Section,
  title,
  VEHICLES,
  type Edit,
  type Path,
  type PickerOptions,
  type PickItem,
} from "./fields.tsx";
import type { Modifier, ModifierView } from "./modifiers.tsx";

const choices = (keys: string[], name: (key: string) => string): Choice[] => keys.map((key) => ({ key, name: name(key) }));

/** The weapons, with "All simple" and "All martial" first. */
export const weaponChoices = (lists: BuilderChoices): Choice[] => [
  { key: "simple", name: "All simple weapons" },
  { key: "martial", name: "All martial weapons" },
  ...lists.weapons,
];
/** Short names, for a checkbox row. */
export const ARMOR_CHOICES = choices(["light", "medium", "heavy", "shields"], (a) => (a === "shields" ? "Shields" : `${title(a)} armor`));
export const RESISTANCE_CHOICES = choices(["traps", ...DAMAGE_TYPES], (d) => (d === "traps" ? "Damage from traps" : title(d)));
export const IMMUNITY_CHOICES = choices(DAMAGE_TYPES, title);
export const SAVING_THROW_CHOICES = CONDITIONS.map((name) => ({ key: nameToKw(name), name }));
/** The old tools in the order of fields.tsx TOOLS, with a heading for each kind. */
export const TOOL_ITEMS: PickItem[] = [
  ...MUSICAL_INSTRUMENTS.map((t) => ({ ...t, group: "Musical instruments" })),
  ...ARTISANS_TOOLS.map((t) => ({ ...t, group: "Artisan's tools" })),
  ...MISC_TOOLS.map((t) => ({ ...t, group: "Other tools" })),
  ...GAMING_SETS.map((t) => ({ ...t, group: "Gaming sets" })),
  ...VEHICLES.map((t) => ({ ...t, group: "Vehicles" })),
];

/** The section of a picker of the map at path, for a modifier's render. */
export const mapPicker =
  (edit: Edit, path: Path, items: PickItem[], picker: PickerOptions) =>
  ({ name, action }: ModifierView) => (
    <Section legend={name} action={action}>
      <MapPicker edit={edit} path={path} items={items} picker={picker} />
    </Section>
  );

/** A modifier of the map at :props prop, as {:prop {:key true}}, with a picker of the items. */
export const propModifier = (edit: Edit, prop: string, name: string, example: string, items: PickItem[], picker: PickerOptions): Modifier => ({
  id: prop,
  name,
  example,
  paths: [["props", prop]],
  render: mapPicker(edit, ["props", prop], items, picker),
});

/** The armor proficiencies at :props :armor-prof, as a checkbox row: a short fixed list. */
export const armorModifier = (edit: Edit): Modifier => ({
  id: "armor-prof",
  name: "Armor Proficiency",
  example: "Light, medium or heavy armor, shields",
  paths: [["props", "armor-prof"]],
  render: ({ name, action }) => (
    <Checks legend={name} action={action} row items={ARMOR_CHOICES} checked={(key) => edit.get("props", "armor-prof", key) === true} onToggle={(key) => edit.toggle(["props", "armor-prof", key])} />
  ),
});

/** The tool proficiencies in :profs :tool as a modifier. */
export const toolModifier = (edit: Edit): Modifier => ({
  id: "tool",
  name: "Tool Proficiency",
  example: "Smith's tools, thieves' tools …",
  paths: [["profs", "tool"]],
  render: mapPicker(edit, ["profs", "tool"], TOOL_ITEMS, { add: "Add a tool", search: true }),
});

/** A proficiency choice in :profs field as a modifier: "Choose n", then a picker of the options. */
export const choiceModifier = (edit: Edit, field: string, name: string, example: string, items: PickItem[], picker: PickerOptions): Modifier => ({
  id: field,
  name,
  example,
  paths: [["profs", field]],
  render: ({ name, action }) => <ChoicePicker edit={edit} legend={name} action={action} field={field} items={items} picker={picker} />,
});

/** A modifier of one number at :props prop, as a None / n toggle. line is the text after the toggle. */
export const valueModifier = (edit: Edit, prop: string, name: string, example: string, values: number[], line: string): Modifier => ({
  id: prop,
  name,
  example,
  paths: [["props", prop]],
  render: ({ name, action }) => <NumberChoice edit={edit} legend={name} action={action} path={["props", prop]} values={values} line={line} />,
});

/** The Hit Points modifier of the feat and subrace forms: +1 or +2 at :props :max-hp-bonus. */
export const hitPointsModifier = (edit: Edit): Modifier =>
  valueModifier(edit, "max-hp-bonus", "Hit Points", "+1 or +2 hit point maximum for each level", [1, 2], "More hit points for each of your levels");
