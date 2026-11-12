// The plug-in seam of the homebrew builder (HomebrewBuilder.tsx): what a
// type's form gets, and what it gives the frame. It is in its own file so a
// form and the frame do not import each other. It also holds the toolkit
// the forms share: the old app's lists, a record editor, and the controls.
import { Button, Checkbox, Field, FieldLabel, Fieldset, NumberToggle, Picker, Select, TextArea, TextInput, XButton, type ListItem, type SelectOption } from "@orc-alchemy/ui";
import { useId, type ComponentType, type ReactNode } from "react";
import { useBuilderChoices, type BuilderChoices, type Choice } from "../../engine/builder-choices.ts";
import { asSet, nameToKw, setItems, tag, untag } from "../../engine/content.ts";
import type { ContentType, Engine, ValidationProblem } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { ordinal } from "../CharacterSheet.tsx";

/**
 * One item as the form edits it: verbose Transit-JSON, as a stored pack has
 * its items, so the key "~:name" is the field :name and the value "~:wizard"
 * is the keyword :wizard. The validators take this form and return it.
 */
export type ItemRecord = Record<string, unknown>;

/** A validator's problem, or one that the frame adds, with its own text. */
export type Problem = ValidationProblem | { path: (string | number)[]; text: string };

export interface FormProps {
  record: ItemRecord;
  /** Replaces the record. */
  onChange: (record: ItemRecord) => void;
  /** The problems with the record. Show them with Field and fieldErrors. */
  problems: Problem[];
}

/** One content type that has a form: stored in a pack, or in a store of its own. */
export type BuilderType = BuilderBase & (InPack | OutsidePacks);

interface InPack {
  /** The pack content type the item is stored under. */
  contentType: ContentType;
  save?: never;
  load?: never;
  check?: never;
}

/** A type stored outside packs, such as the custom magic items. The frame shows no option source. */
interface OutsidePacks {
  contentType?: never;
  /**
   * Stores the item as the validator returned it. storedKey is the key of
   * the item that was edited, or undefined for a new item.
   */
  save: (item: object, storedKey?: string) => Promise<void>;
  /** The stored item with the key, or undefined. */
  load: (key: string) => ItemRecord | undefined;
  /** More problems with the item, as validated, that stop its save. storedKey is as for save. */
  check?: (item: object, storedKey?: string) => Problem[];
}

interface BuilderBase {
  /** The validator for the type. */
  validator: keyof Engine["validate"];
  /** The name of one item, such as "spell", for the UI. */
  one: string;
  /** The record of a new item. */
  empty: ItemRecord;
  /**
   * The top-level fields, without the "~:", that Form shows problems for.
   * The frame lists the problems of the other fields at the top.
   */
  fields: string[];
  Form: ComponentType<FormProps>;
}

export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Exhausted", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

/** A stored number, or null for a number field when the value is not one. */
export const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);

/** A key as a title, such as "very-rare" to "Very Rare". */
export const title = (key: string) => key.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
export { nameToKw };
/** The names as choices, each keyed by nameToKw. */
export const named = (names: string[]): Choice[] => names.map((name) => ({ key: nameToKw(name), name }));

/** The text of one problem with the field labelled label. */
export function problemText(label: string, problem: Problem): string {
  if ("text" in problem) return problem.text;
  const { reason, pred } = problem;
  if (reason === "missing") return `${label} is required.`;
  if (reason === "duplicate") return `${label} has two options with the same name.`;
  if (pred.includes("starts-with-letter")) return `${label} must start with a letter.`;
  return `${label} is not valid.`;
}

/** The problems of one top-level field, as text, for its Field. */
export function fieldErrors(problems: Problem[], field: string, label: string): string[] {
  return problems.filter((p) => p.path[0] === field).map((problem) => problemText(label, problem));
}

export const ABILITIES = [
  ["str", "Strength"],
  ["dex", "Dexterity"],
  ["con", "Constitution"],
  ["int", "Intelligence"],
  ["wis", "Wisdom"],
  ["cha", "Charisma"],
];
/** An ability's key as the old app stores it, such as :orcpub.dnd.e5.character/con. */
export const abilityKey = (ability: string) => `orcpub.dnd.e5.character/${ability}`;
export const SKILLS: Choice[] = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation",
  "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
].map((name) => ({ key: nameToKw(name), name }));
// The old tool lists (equipment.cljc), keyed as common/name-to-kw keys them.
export const MUSICAL_INSTRUMENTS = named(["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"]);
export const ARTISANS_TOOLS = named([
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
  "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
  "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools",
]);
export const MISC_TOOLS = named(["Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools"]);
export const GAMING_SETS = named(["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"]);
export const VEHICLES = named(["Water Vehicles", "Land Vehicles"]);
/** The old tools (equipment.cljc tools). */
export const TOOLS: Choice[] = [...MUSICAL_INSTRUMENTS, ...ARTISANS_TOOLS, ...MISC_TOOLS, ...GAMING_SETS, ...VEHICLES];

/** A select's options: the stored value and its text. */
export type Options = [value: unknown, text: string][];

/** The spell levels, with their stored numbers: Cantrip, 1st, 2nd … 9th. */
export const SPELL_LEVELS: Options = Array.from({ length: 10 }, (_, n) => [n, n === 0 ? "Cantrip" : ordinal(n)]);

/** The abilities as their stored keywords, for a select. */
export const ABILITY_OPTIONS: Options = ABILITIES.map(([key, name]) => [tag(abilityKey(key)), name]);
export const TRAIT_TYPES: Options = [
  [tag("other"), "Other"],
  [tag("action"), "Action"],
  [tag("b-action"), "Bonus Action"],
  [tag("reaction"), "Reaction"],
];
export const YES_NO: Options = [
  [false, "No"],
  [true, "Yes"],
];

/** The numbers from from up to, but not including, to. */
export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.ceil((to - from) / step) }, (_, i) => from + i * step);
export const numbers = (values: number[]): Options => values.map((n) => [n, String(n)]);

/**
 * A path into a record: keyword names without the "~:", vector indexes, and
 * keys already Transit-encoded, such as intKey(3).
 */
export type Path = (string | number)[];

const transitKey = (k: string) => (k.startsWith("~") ? k : tag(k));

/** The value at the path, or undefined. */
export const getIn = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[typeof k === "number" ? k : transitKey(k)], value);

/** The value with the path set, or without its last key when the value is undefined; a missing map or vector is created. */
export function setIn(value: unknown, [k, ...rest]: Path, v: unknown): unknown {
  if (typeof k === "number") {
    const next = [...((value as unknown[] | undefined) ?? [])];
    next[k] = rest.length > 0 ? setIn(next[k], rest, v) : v;
    return next;
  }
  const key = transitKey(k);
  const next = { ...((value as ItemRecord | undefined) ?? {}) };
  next[key] = rest.length > 0 ? setIn(next[key], rest, v) : v;
  if (next[key] === undefined) delete next[key];
  return next;
}

/**
 * The value without the key at the path of map keys. A parent map that
 * the removal empties goes too, also when it was empty in the item at the
 * start. A missing key changes nothing.
 */
export function removeIn(value: unknown, [k, ...rest]: Path): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
  const key = typeof k === "number" ? String(k) : transitKey(k);
  const map = value as ItemRecord;
  if (!(key in map)) return value;
  const next = { ...map };
  if (rest.length === 0) delete next[key];
  else {
    const child = removeIn(map[key], rest);
    if (child === map[key]) return value;
    if (child !== null && typeof child === "object" && !Array.isArray(child) && Object.keys(child).length === 0) delete next[key];
    else next[key] = child;
  }
  return next;
}

/** Reads and changes a record by paths. */
export interface Edit {
  get: (...path: Path) => unknown;
  set: (path: Path, value: unknown) => void;
  /** As the old toggle events: a missing or false value becomes true, and true becomes false. */
  toggle: (path: Path) => void;
  /** Sets each path to its value, in one change of the record. */
  setAll: (changes: [Path, unknown][]) => void;
}

export function editor(record: ItemRecord, onChange: (record: ItemRecord) => void): Edit {
  const get = (...path: Path) => getIn(record, path);
  const set = (path: Path, value: unknown) => onChange(setIn(record, path, value) as ItemRecord);
  const setAll = (changes: [Path, unknown][]) => {
    if (changes.length > 0) onChange(changes.reduce<ItemRecord>((r, [path, value]) => setIn(r, path, value) as ItemRecord, record));
  };
  return { get, set, toggle: (path) => set(path, get(...path) !== true), setAll };
}

/** The value when it is an option, and else the first option's value, as the old dropdowns showed. */
export function orFirst<T>(value: unknown, options: readonly SelectOption<T>[]): T | null {
  const option = options.find(([v]) => Object.is(v, value)) ?? options[0];
  return option ? option[0] : null;
}

/**
 * A labelled select, with the package Select inside, and its label above
 * it. A number or a keyword finds its option by its stored value.
 * placeholder is an extra first option for no value, which onSelect gets as
 * undefined. Without one, a value that is not an option shows the first
 * option, as the old dropdowns did. name is the select's name when the
 * visible label is short, such as "Type" for "Feature 1 type"; it must hold
 * the label's words.
 */
export function SelectField({
  label,
  name,
  value,
  options,
  onSelect,
  placeholder,
  className,
}: {
  label: string;
  name?: string;
  value: unknown;
  options: Options;
  onSelect: (value: unknown) => void;
  placeholder?: string;
  className?: string;
}) {
  const all: SelectOption<unknown>[] = placeholder === undefined ? options : [[null, placeholder], ...options];
  return (
    <FieldLabel label={label} className={className}>
      <Select aria-label={name} value={placeholder === undefined ? orFirst(value, options) : value} options={all} onValueChange={(v) => onSelect(v ?? undefined)} />
    </FieldLabel>
  );
}

const ROW_LOOKS = {
  fields: "gap-x-[18px] gap-y-[10px]",
  list: "gap-x-[10px] gap-y-2 border-b border-rule py-2",
  tight: "gap-x-[10px] gap-y-2",
};

/**
 * A row of fields that wrap, aligned at their bottom edge. The row owns the
 * gaps, so a field has no margin. "fields" is a row of a form or a section,
 * "tight" a row of fields that belong together, such as the top row of a
 * Card, and "list" one row of a list, tight with a rule under it.
 */
export function FieldRow({ look = "fields", children }: { look?: keyof typeof ROW_LOOKS; children: ReactNode }) {
  return <div className={`flex flex-wrap items-end ${ROW_LOOKS[look]}`}>{children}</div>;
}

/** The one column of a form: about 720px wide, with space between its fields and sections. */
export function FormColumn({ children }: { children: ReactNode }) {
  return <div className="grid max-w-[720px] gap-[22px]">{children}</div>;
}

/** A line of help text under a section title. */
export function Help({ children }: { children: ReactNode }) {
  return <p className="mb-[6px] text-[14.5px] text-ink-muted">{children}</p>;
}

/** A full-width "Add x" button under a list. The "+" is not a part of its name. */
export function AddButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <Button wide onClick={onClick} className="mt-[10px]">
      <span aria-hidden="true">+</span>
      {children}
    </Button>
  );
}

/** A checkbox name longer than this is a sentence: it takes a whole line of a CheckGrid. */
const SENTENCE = 44;

/** The checkboxes of a group in columns: wide columns for long names, one column for sentences. A sentence among short names takes its own line. */
export function CheckGrid({ names, children }: { names: string[]; children: ReactNode }) {
  const short = names.filter((name) => name.length <= SENTENCE);
  const longest = short.length === 0 ? Infinity : Math.max(0, ...short.map((name) => name.length));
  const columns = longest <= 24 ? "grid-cols-[repeat(auto-fill,minmax(160px,1fr))]" : longest <= SENTENCE ? "grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))]" : "grid-cols-1";
  return <div className={`grid gap-x-[14px] gap-y-[3px] ${columns}`}>{children}</div>;
}

/**
 * A group of checkboxes, one for each item, as a section of the form. name
 * names the group when the legend is not the right name. With row, the
 * boxes are on one line that wraps: the look of a short fixed list
 * (docs/design/homebrew-forms.md, "Checkboxes that stay"). look "block"
 * is a part of a section that the user added, with a rule on its left.
 * children go after the boxes, such as one more checkbox on its own line.
 */
export function Checks({
  legend,
  name,
  items,
  checked,
  onToggle,
  action,
  row = false,
  look = "section",
  children,
}: {
  legend: string;
  name?: string;
  items: Choice[];
  checked: (key: string) => boolean;
  onToggle: (key: string) => void;
  /** A control on the section rule, such as the Remove link of a modifier (modifiers.tsx). */
  action?: ReactNode;
  row?: boolean;
  look?: "section" | "block";
  children?: ReactNode;
}) {
  const boxes = items.map(({ key, name }) => (
    <Checkbox
      key={key}
      label={name}
      checked={checked(key)}
      onCheckedChange={() => onToggle(key)}
      className={`items-start [&>.ui-check]:mt-[4px] ${!row && name.length > SENTENCE ? "col-span-full" : ""}`}
    />
  ));
  return (
    <Fieldset legend={legend} name={name} look={look} action={action}>
      {row ? <div className="flex flex-wrap gap-x-[18px] gap-y-1">{boxes}</div> : <CheckGrid names={items.map((item) => item.name)}>{boxes}</CheckGrid>}
      {children}
    </Fieldset>
  );
}

/** One option of a picker group: a Choice, with the small heading of its run in the list. */
export type PickItem = Choice & { group?: string };

/** The add button and the list of a picker group. */
export interface PickerOptions {
  /** The add button's text after the "+", such as "Add a skill". */
  add: string;
  /** A search field in the list. docs/design/homebrew-forms.md, "Picker", gives one to a list of more than about 20 options. */
  search?: boolean;
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
 * changes, so a key that is no option keeps its value.
 */
export function MapPicker({ edit, path, items, picker, removeKey = false }: { edit: Edit; path: Path; items: PickItem[]; picker: PickerOptions; removeKey?: boolean }) {
  const map = (edit.get(...path) ?? {}) as ItemRecord;
  const value = Object.keys(map)
    .filter((key) => (removeKey ? Boolean(map[key]) : map[key] === true))
    .map(untag);
  return (
    <Picker
      label={picker.add}
      options={listItems(items)}
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
 * A picker of the set at field, as the old checkboxes stored it: a pick
 * adds the item's stored value at the end, and a removed token takes it
 * out. stored is the value the set holds for an item, such as its keyword.
 * A stored value that is no option stays in the set.
 */
export function SetPicker({ edit, field, items, picker, stored = (item) => tag(item.key) }: { edit: Edit; field: string; items: PickItem[]; picker: PickerOptions; stored?: (item: PickItem) => string }) {
  return (
    <Picker
      label={picker.add}
      options={listItems(items, stored)}
      value={setItems(edit.get(field)) as string[]}
      search={picker.search}
      pickedText={pickedText}
      onValueChange={(next) => edit.set([field], asSet(next))}
    />
  );
}

/** A section of a form: its title on a section rule, and the Remove link of a modifier as action. */
export function Section({ legend, action, children }: { legend: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Fieldset legend={legend} look="section" action={action}>
      {children}
    </Fieldset>
  );
}

/**
 * One number at path as a None / 1 / 2 … toggle, as the old toggle-value
 * checkboxes: a number stores it, and None removes the key, as the old
 * second click did. line is the text after the toggle, which names it. A
 * stored number that is no segment presses none, and stays until the user
 * presses one. read and write are for a number inside the stored value:
 * read gets the number from the value at path, and write makes the value
 * to store for a number.
 */
export function NumberChoice({
  edit,
  legend,
  path,
  values,
  line,
  action,
  read = (stored) => stored,
  write = (n) => n,
}: {
  edit: Edit;
  legend: string;
  path: Path;
  values: number[];
  line: string;
  action?: ReactNode;
  read?: (stored: unknown) => unknown;
  write?: (n: number) => unknown;
}) {
  const id = useId();
  return (
    <Section legend={legend} action={action}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NumberToggle aria-labelledby={id} values={[null, ...values]} value={numberOrNull(read(edit.get(...path)))} onValueChange={(n) => edit.set(path, n === null ? undefined : write(n))} />
        <span id={id}>{line}</span>
      </div>
    </Section>
  );
}

/** A text field of the record, with its problems, and its label above it. */
export function TextField({ edit, problems, field, label }: { edit: Edit; problems: Problem[]; field: string; label: string }) {
  return (
    <Field label={label} errors={fieldErrors(problems, field, label)}>
      <FieldLabel label={label}>
        <TextInput value={String(edit.get(field) ?? "")} onValueChange={(text) => edit.set([field], text)} />
      </FieldLabel>
    </Field>
  );
}

/** A text area of the record's field, such as :description or :help, of the full width. */
export function RecordTextArea({ edit, field, label }: { edit: Edit; field: string; label: string }) {
  return (
    <FieldLabel label={label}>
      <TextArea value={String(edit.get(field) ?? "")} onValueChange={(text) => edit.set([field], text)} />
    </FieldLabel>
  );
}

/** A proficiency choice in :profs, as {:skill-options {:choose 2 :options {:arcana true}}}. Choose shows 1 until it is set. */
export function ProficiencyChoice({ edit, legend, field, items, action }: { edit: Edit; legend: string; field: string; items: Choice[]; action?: ReactNode }) {
  return (
    <Section legend={legend} action={action}>
      <SelectField label="Choose" name={`${legend}: choose`} value={edit.get("profs", field, "choose")} options={numbers(range(1, 6))} onSelect={(n) => edit.set(["profs", field, "choose"], n)} />
      <Checks legend="Options" name={`${legend}: options`} items={items} checked={(key) => edit.get("profs", field, "options", key) === true} onToggle={(key) => edit.toggle(["profs", field, "options", key])} />
    </Section>
  );
}

/**
 * A proficiency choice in :profs as ProficiencyChoice stores it, with a
 * picker for the options: {:skill-options {:choose 2 :options {:arcana true}}}.
 * A removed token stores false, as the old second click.
 */
export function ChoicePicker({ edit, legend, field, items, picker, action }: { edit: Edit; legend: string; field: string; items: PickItem[]; picker: PickerOptions; action?: ReactNode }) {
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

/**
 * One card of a list, such as a feature: its top row of fields with the X
 * button at the end, then its other fields, such as a description.
 */
export function Card({ top, children }: { top: ReactNode; children?: ReactNode }) {
  return (
    <div className="grid gap-2 border border-rule-strong bg-paper-raised px-3 py-[10px] [&+&]:mt-[10px]">
      <FieldRow look="tight">{top}</FieldRow>
      {children}
    </div>
  );
}

/**
 * The features and traits, each with a name, a type and a description, and
 * with levels the level it is unlocked at, as the class and subclass forms
 * have it.
 */
export function Traits({ edit, problems = [], levels = false }: { edit: Edit; problems?: Problem[]; levels?: boolean }) {
  const traits = (edit.get("traits") ?? []) as ItemRecord[];
  return (
    <Fieldset legend="Features / traits" look="section" errors={fieldErrors(problems, "traits", "Features / traits")}>
      {traits.map((trait, i) => {
        const n = i + 1;
        return (
          <Card
            key={i}
            top={
              <>
                <FieldLabel label="Name" className="min-w-[12rem] flex-1">
                  <TextInput aria-label={`Feature ${n} name`} value={String(trait[tag("name")] ?? "")} onValueChange={(text) => edit.set(["traits", i, "name"], text)} width="full" />
                </FieldLabel>
                <SelectField label="Type" name={`Feature ${n} type`} value={trait[tag("type")]} options={TRAIT_TYPES} onSelect={(v) => edit.set(["traits", i, "type"], v)} />
                {levels && (
                  <SelectField label="Level" name={`Feature ${n} level`} value={trait[tag("level")]} options={numbers(range(1, 21))} onSelect={(v) => edit.set(["traits", i, "level"], v)} placeholder="-" />
                )}
                <XButton aria-label={`Delete feature ${n}`} onClick={() => edit.set(["traits"], traits.filter((_, j) => j !== i))} />
              </>
            }
          >
            <FieldLabel label="Description">
              <TextArea aria-label={`Feature ${n} description`} value={String(trait[tag("description")] ?? "")} onValueChange={(text) => edit.set(["traits", i, "description"], text)} rows={3} />
            </FieldLabel>
          </Card>
        );
      })}
      <AddButton onClick={() => edit.set(["traits"], [...traits, {}])}>Add feature / trait</AddButton>
    </Fieldset>
  );
}

/** The lists of the SRD and the enabled packs, or a status line until they load. */
export function WithChoices({ children }: { children: (choices: BuilderChoices) => ReactNode }) {
  const homebrew = useHomebrew((state) => state.homebrew);
  const choices = useBuilderChoices(homebrew);
  return choices === null ? <p role="status">Reading the content lists…</p> : children(choices);
}

/** A name and a :description, as the old language, invocation and boon builders have them. */
export function NameDescriptionForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <FormColumn>
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      <RecordTextArea edit={edit} field="description" label="Description" />
    </FormColumn>
  );
}
