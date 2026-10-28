// The plug-in seam of the homebrew builder (HomebrewBuilder.tsx): what a
// type's form gets, and what it gives the frame. It is in its own file so a
// form and the frame do not import each other. It also holds the toolkit
// the forms share: the old app's lists, a record editor, and the controls.
import { Button, Checkbox, Field, Fieldset, Select as UiSelect, type SelectOption } from "@orc-alchemy/ui";
import type { ComponentType, ReactNode } from "react";
import { useBuilderChoices, type BuilderChoices, type Choice } from "../../engine/builder-choices.ts";
import { nameToKw, tag } from "../../engine/content.ts";
import type { ContentType, Engine, ValidationProblem } from "../../engine/engine.ts";
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
const GAMING_SETS = named(["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set"]);
export const VEHICLES = named(["Water Vehicles", "Land Vehicles"]);
/** The old tools (equipment.cljc tools). */
export const TOOLS: Choice[] = [...MUSICAL_INSTRUMENTS, ...ARTISANS_TOOLS, ...MISC_TOOLS, ...GAMING_SETS, ...VEHICLES];

/** A select's options: the stored value and its text. */
export type Options = [value: unknown, text: string][];

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

const getIn = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[typeof k === "number" ? k : transitKey(k)], value);

/** The value with the path set, or without its last key when the value is undefined; a missing map or vector is created. */
function setIn(value: unknown, [k, ...rest]: Path, v: unknown): unknown {
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

/** Reads and changes a record by paths. */
export interface Edit {
  get: (...path: Path) => unknown;
  set: (path: Path, value: unknown) => void;
  /** As the old toggle events: a missing or false value becomes true, and true becomes false. */
  toggle: (path: Path) => void;
}

export function editor(record: ItemRecord, onChange: (record: ItemRecord) => void): Edit {
  const get = (...path: Path) => getIn(record, path);
  const set = (path: Path, value: unknown) => onChange(setIn(record, path, value) as ItemRecord);
  return { get, set, toggle: (path) => set(path, get(...path) !== true) };
}

/**
 * A labelled select, with the package Select inside. A number or a keyword
 * finds its option by its stored value. placeholder is an extra first option
 * for no value, which onSelect gets as undefined. Without one, a value that
 * is not an option shows the first option, as the old dropdowns did.
 */
export function Select({ label, value, options, onSelect, placeholder }: { label: string; value: unknown; options: Options; onSelect: (value: unknown) => void; placeholder?: string }) {
  const known = options.some(([v]) => v === value);
  const all: SelectOption<unknown>[] = placeholder === undefined ? options : [[null, placeholder], ...options];
  return (
    <label className="mr-4 inline-block">
      {label}{" "}
      <UiSelect value={known ? value : placeholder === undefined ? (options[0]?.[0] ?? null) : null} options={all} onValueChange={(v) => onSelect(v ?? undefined)} />
    </label>
  );
}

/** A group of checkboxes, one for each item. */
export function Checks({ legend, items, checked, onToggle }: { legend: string; items: Choice[]; checked: (key: string) => boolean; onToggle: (key: string) => void }) {
  return (
    <Fieldset legend={legend}>
      {items.map(({ key, name }) => (
        <Checkbox key={key} label={name} checked={checked(key)} onCheckedChange={() => onToggle(key)} className="mr-4" />
      ))}
    </Fieldset>
  );
}

/** A text field of the record, with its problems. */
export function TextField({ edit, problems, field, label }: { edit: Edit; problems: Problem[]; field: string; label: string }) {
  return (
    <Field label={label} errors={fieldErrors(problems, field, label)}>
      <label className="block">
        {label}{" "}
        <input type="text" value={String(edit.get(field) ?? "")} onChange={(e) => edit.set([field], e.target.value)} className="border border-black px-1" />
      </label>
    </Field>
  );
}

/** A text area of the record's field, such as :description or :help. */
export function TextArea({ edit, field, label }: { edit: Edit; field: string; label: string }) {
  return (
    <label className="block">
      {label}
      <textarea value={String(edit.get(field) ?? "")} onChange={(e) => edit.set([field], e.target.value)} className="block w-full border border-black" rows={4} />
    </label>
  );
}

/** A proficiency choice in :profs, as {:skill-options {:choose 2 :options {:arcana true}}}. Choose shows 1 until it is set. */
export function ProficiencyChoice({ edit, legend, field, items }: { edit: Edit; legend: string; field: string; items: Choice[] }) {
  return (
    <Fieldset legend={legend}>
      <Select label={`${legend}: choose`} value={edit.get("profs", field, "choose")} options={numbers(range(1, 6))} onSelect={(n) => edit.set(["profs", field, "choose"], n)} />
      <Checks legend={`${legend}: options`} items={items} checked={(key) => edit.get("profs", field, "options", key) === true} onToggle={(key) => edit.toggle(["profs", field, "options", key])} />
    </Fieldset>
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
    <Fieldset legend="Features / traits" errors={fieldErrors(problems, "traits", "Features / traits")}>
      {traits.map((trait, i) => {
        const n = i + 1;
        return (
          <div key={i} className="mb-3">
            <label className="mr-4 inline-block">
              Feature {n} name{" "}
              <input type="text" value={String(trait[tag("name")] ?? "")} onChange={(e) => edit.set(["traits", i, "name"], e.target.value)} className="border border-black px-1" />
            </label>
            <Select label={`Feature ${n} type`} value={trait[tag("type")]} options={TRAIT_TYPES} onSelect={(v) => edit.set(["traits", i, "type"], v)} />
            {levels && <Select label={`Feature ${n} level`} value={trait[tag("level")]} options={numbers(range(1, 21))} onSelect={(v) => edit.set(["traits", i, "level"], v)} placeholder="-" />}
            <Button onClick={() => edit.set(["traits"], traits.filter((_, j) => j !== i))} size="small">
              Delete feature {n}
            </Button>
            <label className="block">
              Feature {n} description
              <textarea value={String(trait[tag("description")] ?? "")} onChange={(e) => edit.set(["traits", i, "description"], e.target.value)} className="block w-full border border-black" />
            </label>
          </div>
        );
      })}
      <Button onClick={() => edit.set(["traits"], [...traits, {}])} size="small">
        Add feature / trait
      </Button>
    </Fieldset>
  );
}

/** The lists of the SRD and the enabled packs, or a status line until they load. */
export function WithChoices({ children }: { children: (choices: BuilderChoices) => ReactNode }) {
  const homebrew = useHomebrew((state) => state.homebrew);
  const choices = useBuilderChoices(homebrew);
  return choices === null ? <p role="status">Reading the content lists…</p> : children(choices);
}

/**
 * Checkboxes of one number at path, as the old toggle-value events: a click
 * stores the box's number, and a second click on it removes the key.
 */
export function ValueChecks({ edit, legend, path, values, name }: { edit: Edit; legend: string; path: Path; values: number[]; name: (n: number) => string }) {
  const value = edit.get(...path);
  return (
    <Checks
      legend={legend}
      items={values.map((n) => ({ key: String(n), name: name(n) }))}
      checked={(key) => value === Number(key)}
      onToggle={(key) => edit.set(path, value === Number(key) ? undefined : Number(key))}
    />
  );
}

/** A name and a :description, as the old language, invocation and boon builders have them. */
export function NameDescriptionForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <div className="space-y-3">
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      <TextArea edit={edit} field="description" label="Description" />
    </div>
  );
}
