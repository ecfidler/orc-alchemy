// The plug-in seam of the homebrew builder (HomebrewBuilder.tsx): what a
// type's form gets, and what it gives the frame. It is in its own file so a
// form and the frame do not import each other. It also holds the toolkit
// the forms share: the old app's lists, a record editor, and the controls.
// The pickers are in picker-fields.tsx, and the feature list in feature-fields.tsx.
import { Button, Checkbox, Field, FieldLabel, Fieldset, NumberToggle, PixelIcon, Select, type SelectOption, TextArea, TextInput } from "@orc-alchemy/ui";
import { type ComponentType, type ReactNode, useId } from "react";
import { type BuilderChoices, type Choice, useBuilderChoices } from "../../engine/builder-choices.ts";
import { nameToKw, tag } from "../../engine/content.ts";
import type { ContentType, Engine, ValidationProblem } from "../../engine/engine.ts";
import { ABILITY_NAMES, ordinal, ABILITIES as SHEET_ABILITIES } from "../../engine/sheet-text.ts";
import { useHomebrew } from "../../state/homebrew.ts";

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

export const DAMAGE_TYPES = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];
export const CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhausted",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
];

/** A stored number, or null for a number field when the value is not one. */
export const numberOrNull = (value: unknown) => (typeof value === "number" ? value : null);

/** A key as a title, such as "very-rare" to "Very Rare". */
export const title = (key: string) =>
  key
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
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

/** The abilities: each its key and its name. */
export const ABILITIES = SHEET_ABILITIES.map((key) => [key, ABILITY_NAMES[key]]);
/** An ability's key as the old app stores it, such as :orcpub.dnd.e5.character/con. */
export const abilityKey = (ability: string) => `orcpub.dnd.e5.character/${ability}`;
export const SKILLS: Choice[] = [
  "Acrobatics",
  "Animal Handling",
  "Arcana",
  "Athletics",
  "Deception",
  "History",
  "Insight",
  "Intimidation",
  "Investigation",
  "Medicine",
  "Nature",
  "Perception",
  "Performance",
  "Persuasion",
  "Religion",
  "Sleight of Hand",
  "Stealth",
  "Survival",
].map((name) => ({ key: nameToKw(name), name }));
// The old tool lists (equipment.cljc), keyed as common/name-to-kw keys them.
export const MUSICAL_INSTRUMENTS = named(["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"]);
export const ARTISANS_TOOLS = named([
  "Alchemist's Supplies",
  "Brewer's Supplies",
  "Calligrapher's Supplies",
  "Carpenter's Tools",
  "Cartographer's Tools",
  "Cobbler's Tools",
  "Cook's Utensils",
  "Glassblower's Tools",
  "Jeweler's Tools",
  "Leatherworker's Tools",
  "Mason's Tools",
  "Painter's Supplies",
  "Potter's Tools",
  "Smith's Tools",
  "Tinker's Tools",
  "Weaver's Tools",
  "Woodcarver's Tools",
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
      <Select
        aria-label={name}
        value={placeholder === undefined ? orFirst(value, options) : value}
        options={all}
        onValueChange={(v) => onSelect(v ?? undefined)}
      />
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
      <PixelIcon name="plus" />
      {children}
    </Button>
  );
}

/**
 * A group of checkboxes, one for each item, as a section of the form, in
 * one row that wraps: the look of a short fixed list
 * (docs/design/homebrew-forms.md, "Checkboxes that stay"). look "block"
 * is a part of a section that the user added, with a rule on its left.
 * children go after the boxes, such as one more checkbox on its own line.
 */
export function Checks({
  legend,
  items,
  checked,
  onToggle,
  action,
  look = "section",
  children,
}: {
  legend: string;
  items: Choice[];
  checked: (key: string) => boolean;
  onToggle: (key: string) => void;
  /** A control on the section rule, such as the Remove link of a modifier (modifiers.tsx). */
  action?: ReactNode;
  look?: "section" | "block";
  children?: ReactNode;
}) {
  return (
    <Fieldset legend={legend} look={look} action={action}>
      <div className="flex flex-wrap gap-x-[18px] gap-y-1">
        {items.map(({ key, name }) => (
          <Checkbox key={key} label={name} checked={checked(key)} onCheckedChange={() => onToggle(key)} className="items-start [&>.ui-check]:mt-[4px]" />
        ))}
      </div>
      {children}
    </Fieldset>
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
        <NumberToggle
          aria-labelledby={id}
          values={[null, ...values]}
          value={numberOrNull(read(edit.get(...path)))}
          onValueChange={(n) => edit.set(path, n === null ? undefined : write(n))}
        />
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
