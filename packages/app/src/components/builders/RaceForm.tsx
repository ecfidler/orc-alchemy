// The race form of the homebrew builder, with the fields of the old app's
// race builder (views.cljs race-builder). Each value is stored as the old
// app's events stored it (events.cljs ::races/...), so an .orcbrew export
// round-trips: :size a keyword, :speed and :darkvision integers, :help the
// description, :abilities a map of namespaced ability keyword to bonus,
// :languages a set of language names, the checkboxes in :props as
// {:weapon-prof {:dart true}} (a second click stores false), the flying and
// swimming speeds in :props as integers, the tool proficiencies and the
// proficiency choices in :profs, :spells a vector of {:level unlock-level
// :value {:level :ability :key}}, and :traits a vector of :name, :type and
// :description maps. The subrace form (SubraceForm.tsx) uses the parts
// exported here.
import type { ReactNode } from "react";
import { tag } from "../../engine/content.ts";
import { useRaceChoices, type Choice, type RaceChoices } from "../../engine/race-choices.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { CONDITIONS, DAMAGE_TYPES, FieldProblems, nameToKey, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

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
export const SIZES = ["small", "medium", "large"];
export const SKILLS: Choice[] = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation",
  "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
].map((name) => ({ key: nameToKey(name), name }));
/** The old tools (equipment.cljc tools), keyed as common/name-to-kw keys them. */
export const TOOLS: Choice[] = [
  "Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol", "Alchemist's Supplies",
  "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils",
  "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies", "Potter's Tools",
  "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools", "Disguise Kit", "Forgery Kit", "Herbalism Kit",
  "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools", "Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set",
  "Water Vehicles", "Land Vehicles",
].map((name) => ({ key: nameToKey(name.replace(/'/g, "")), name }));
const TRAIT_TYPES = [
  ["other", "Other"],
  ["action", "Action"],
  ["b-action", "Bonus Action"],
  ["reaction", "Reaction"],
];

/** A path of untagged keys and vector indexes into a record. */
type Path = (string | number)[];

const getIn = (value: unknown, path: Path): unknown =>
  path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[typeof k === "number" ? k : tag(k)], value);

/** The value with the path set, or without its last key when the value is undefined; a missing map or vector is created. */
function setIn(value: unknown, [k, ...rest]: Path, v: unknown): unknown {
  if (typeof k === "number") {
    const next = [...((value as unknown[] | undefined) ?? [])];
    next[k] = rest.length > 0 ? setIn(next[k], rest, v) : v;
    return next;
  }
  const next = { ...((value as ItemRecord | undefined) ?? {}) };
  next[tag(k)] = rest.length > 0 ? setIn(next[tag(k)], rest, v) : v;
  if (next[tag(k)] === undefined) delete next[tag(k)];
  return next;
}

/** Reads and changes a record by paths of untagged keys. */
export interface Edit {
  get: (...path: Path) => unknown;
  set: (path: Path, value: unknown) => void;
  /** As the old toggle events: a missing or false value becomes true, and true becomes false. */
  toggle: (path: Path) => void;
}

export function edit(record: ItemRecord, onChange: (record: ItemRecord) => void): Edit {
  const get = (...path: Path) => getIn(record, path);
  const set = (path: Path, value: unknown) => onChange(setIn(record, path, value) as ItemRecord);
  return { get, set, toggle: (path) => set(path, get(...path) !== true) };
}

/** A select of value and text pairs. A value that is not an option shows the first one, as the old dropdowns did. */
export function Select({ label, value, options, onChange }: { label: string; value: unknown; options: (string | number)[][]; onChange: (value: string) => void }) {
  return (
    <label className="mr-4 inline-block">
      {label}{" "}
      <select value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className="border border-black">
        {options.map(([v, t]) => (
          <option key={v} value={v} disabled={v === "" && t.toString().startsWith("<")}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}

export const numbers = (values: number[]) => values.map((n) => [n, n]);
export const range = (from: number, to: number, step = 1) => Array.from({ length: Math.ceil((to - from) / step) }, (_, i) => from + i * step);
const bonus = (n: number) => `${n > 0 ? "+" : ""}${n}`;
export const BONUSES = range(-2, 3).map((n) => [n, bonus(n)]);

/** A group of checkboxes, one for each item. */
export function Checks({ legend, items, checked, onToggle }: { legend: string; items: Choice[]; checked: (key: string) => boolean; onToggle: (key: string) => void }) {
  return (
    <fieldset>
      <legend className="font-bold">{legend}</legend>
      {items.map(({ key, name }) => (
        <label key={key} className="mr-4 inline-block">
          <input type="checkbox" checked={checked(key)} onChange={() => onToggle(key)} /> {name}
        </label>
      ))}
    </fieldset>
  );
}

/** Checkboxes of the map at :props prop, as {:prop {:key true}}. */
export function PropChecks({ e, legend, prop, items }: { e: Edit; legend: string; prop: string; items: Choice[] }) {
  return <Checks legend={legend} items={items} checked={(key) => e.get("props", prop, key) === true} onToggle={(key) => e.toggle(["props", prop, key])} />;
}

const choices = (keys: string[], name: (key: string) => string): Choice[] => keys.map((key) => ({ key, name: name(key) }));

export const weaponChoices = (lists: RaceChoices): Choice[] => [
  { key: "simple", name: "All Simple Weapons" },
  { key: "martial", name: "All Martial Weapons" },
  ...lists.weapons,
];
export const ArmorChecks = ({ e }: { e: Edit }) => (
  <PropChecks e={e} legend="Armor Proficiency" prop="armor-prof" items={choices(["light", "medium", "heavy", "shields"], (a) => `You gain proficiency with ${a}${a === "shields" ? "" : " armor"}`)} />
);
export const ToolChecks = ({ e }: { e: Edit }) => (
  <Checks legend="Tool Proficiency" items={TOOLS} checked={(key) => e.get("profs", "tool", key) === true} onToggle={(key) => e.toggle(["profs", "tool", key])} />
);
export const ResistanceChecks = ({ e }: { e: Edit }) => (
  <PropChecks
    e={e}
    legend="Damage Resistances"
    prop="damage-resistance"
    items={choices(["traps", ...DAMAGE_TYPES], (d) => (d === "traps" ? "Resistance to damage from traps" : `Resistance to ${d} damage`))}
  />
);
export const ImmunityChecks = ({ e }: { e: Edit }) => (
  <PropChecks e={e} legend="Damage Immunities" prop="damage-immunity" items={choices(DAMAGE_TYPES, (d) => `Immunity to ${d} damage`)} />
);
export const SkillChecks = ({ e }: { e: Edit }) => <PropChecks e={e} legend="Skill Proficiencies" prop="skill-prof" items={SKILLS} />;
export const savingThrowChoices = CONDITIONS.map((name) => ({ key: nameToKey(name), name: `You have advantage on saving throws against being ${name}` }));

/** A proficiency choice in :profs, as {:skill-options {:choose 2 :options {:arcana true}}}. Choose shows 1 until it is set. */
export function ProficiencyChoice({ e, legend, field, items }: { e: Edit; legend: string; field: string; items: Choice[] }) {
  return (
    <fieldset>
      <legend className="font-bold">{legend}</legend>
      <Select label={`${legend}: choose`} value={e.get("profs", field, "choose")} options={numbers(range(1, 6))} onChange={(v) => e.set(["profs", field, "choose"], Number(v))} />
      <Checks legend={`${legend}: options`} items={items} checked={(key) => e.get("profs", field, "options", key) === true} onToggle={(key) => e.toggle(["profs", field, "options", key])} />
    </fieldset>
  );
}

/**
 * The spells, as the old option-spells: one row for each, and a blank row
 * that adds a spell when it is set. "Unlock at level" gates the spell by
 * character level; the spell's own level only filters the spell list.
 */
export function Spells({ e, lists }: { e: Edit; lists: RaceChoices }) {
  const spells = (e.get("spells") ?? []) as ItemRecord[];
  const abilities = [["", "<select ability>"], ...ABILITIES.map(([key, name]) => [tag(abilityKey(key)), name])];
  return (
    <fieldset>
      <legend className="font-bold">Spells</legend>
      {[...spells, {}].map((spell, i) => {
        const n = i + 1;
        const level = (getIn(spell, ["value", "level"]) as number | undefined) ?? 0;
        const options = [["", "<select spell>"], ...lists.spells.filter((s) => s.level === level).map((s) => [tag(s.key), s.name])];
        return (
          <div key={i}>
            <Select label={`Spell ${n} unlock at level`} value={getIn(spell, ["level"])} options={[["", "-"], ...numbers(range(1, 21))]} onChange={(v) => e.set(["spells", i, "level"], v === "" ? undefined : Number(v))} />
            <Select label={`Spell ${n} level`} value={getIn(spell, ["value", "level"])} options={numbers(range(0, 10))} onChange={(v) => e.set(["spells", i, "value", "level"], Number(v))} />
            <Select label={`Spell ${n} spellcasting ability`} value={getIn(spell, ["value", "ability"])} options={abilities} onChange={(v) => e.set(["spells", i, "value", "ability"], v)} />
            <Select label={`Spell ${n}`} value={getIn(spell, ["value", "key"])} options={options} onChange={(v) => e.set(["spells", i, "value", "key"], v)} />
            {i < spells.length && (
              <button type="button" onClick={() => e.set(["spells"], spells.filter((_, j) => j !== i))} className="border border-black px-2">
                Delete spell {n}
              </button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

/** The features and traits, each with a name, a type and a description. */
export function Traits({ e }: { e: Edit }) {
  const traits = (e.get("traits") ?? []) as ItemRecord[];
  return (
    <fieldset>
      <legend className="font-bold">Features / traits</legend>
      {traits.map((trait, i) => {
        const n = i + 1;
        return (
          <div key={i} className="mb-3">
            <label className="mr-4 inline-block">
              Feature {n} name{" "}
              <input type="text" value={String(trait[tag("name")] ?? "")} onChange={(ev) => e.set(["traits", i, "name"], ev.target.value)} className="border border-black px-1" />
            </label>
            <Select label={`Feature ${n} type`} value={trait[tag("type")]} options={TRAIT_TYPES.map(([v, t]) => [tag(v), t])} onChange={(v) => e.set(["traits", i, "type"], v)} />
            <button type="button" onClick={() => e.set(["traits"], traits.filter((_, j) => j !== i))} className="border border-black px-2">
              Delete feature {n}
            </button>
            <label className="block">
              Feature {n} description
              <textarea value={String(trait[tag("description")] ?? "")} onChange={(ev) => e.set(["traits", i, "description"], ev.target.value)} className="block w-full border border-black" />
            </label>
          </div>
        );
      })}
      <button type="button" onClick={() => e.set(["traits"], [...traits, {}])} className="border border-black px-2">
        Add feature / trait
      </button>
    </fieldset>
  );
}

/** The Name field, with its problems. */
export function NameField({ e, problems }: { e: Edit; problems: FormProps["problems"] }) {
  return (
    <div>
      <label className="block">
        Name <input type="text" value={String(e.get("name") ?? "")} onChange={(ev) => e.set(["name"], ev.target.value)} className="border border-black px-1" />
      </label>
      <FieldProblems problems={problems} field="name" label="Name" />
    </div>
  );
}

/** The lists the forms need, or a status line until they load. */
export function WithChoices({ children }: { children: (lists: RaceChoices) => ReactNode }) {
  const homebrew = useHomebrew((state) => state.homebrew);
  const lists = useRaceChoices(homebrew);
  return lists === null ? <p role="status">Reading the SRD lists…</p> : children(lists);
}

const LANGUAGES = tag("languages");
const SET = "~#set";

function RaceForm({ record, onChange, problems }: FormProps) {
  const e = edit(record, onChange);
  const languages = ((record[LANGUAGES] as { [SET]?: string[] } | undefined)?.[SET] ?? []) as string[];
  const toggleLanguage = (name: string) =>
    onChange({ ...record, [LANGUAGES]: { [SET]: languages.includes(name) ? languages.filter((l) => l !== name) : [...languages, name] } });
  const speeds = numbers(range(0, 55, 5));
  return (
    <WithChoices>
      {(lists) => (
        <div className="space-y-3">
          <NameField e={e} problems={problems} />
          <label className="block">
            Description
            <textarea value={String(e.get("help") ?? "")} onChange={(ev) => e.set(["help"], ev.target.value)} className="block w-full border border-black" rows={4} />
          </label>
          <div>
            <Select label="Size" value={e.get("size") ?? tag("medium")} options={SIZES.map((s) => [tag(s), s])} onChange={(v) => e.set(["size"], v)} />
            <Select label="Speed" value={e.get("speed")} options={speeds} onChange={(v) => e.set(["speed"], Number(v))} />
            <Select label="Flying speed" value={e.get("props", "flying-speed") ?? 0} options={speeds} onChange={(v) => e.set(["props", "flying-speed"], Number(v))} />
            <Select label="Swimming speed" value={e.get("props", "swimming-speed") ?? 0} options={speeds} onChange={(v) => e.set(["props", "swimming-speed"], Number(v))} />
            <Select label="Darkvision" value={e.get("darkvision")} options={numbers([0, 60, 120])} onChange={(v) => e.set(["darkvision"], Number(v))} />
          </div>
          <Checks
            legend="Armor Class"
            items={[
              { key: "lizardfolk-ac", name: "Without armor your AC becomes 13 + your DEX modifier." },
              { key: "tortle-ac", name: "Your AC is 17, regardless of your DEX modifier or armor." },
            ]}
            checked={(key) => e.get("props", key) === true}
            onToggle={(key) => e.toggle(["props", key])}
          />
          <fieldset>
            <legend className="font-bold">Ability Score Increases</legend>
            {ABILITIES.map(([key, name]) => (
              <Select key={key} label={name} value={e.get("abilities", abilityKey(key)) ?? 0} options={BONUSES} onChange={(v) => e.set(["abilities", abilityKey(key)], Number(v))} />
            ))}
          </fieldset>
          <Checks legend="Languages" items={lists.languages.map(({ name }) => ({ key: name, name }))} checked={(name) => languages.includes(name)} onToggle={toggleLanguage} />
          <PropChecks e={e} legend="Weapon Proficiencies" prop="weapon-prof" items={weaponChoices(lists)} />
          <ArmorChecks e={e} />
          <ToolChecks e={e} />
          <ResistanceChecks e={e} />
          <ImmunityChecks e={e} />
          <SkillChecks e={e} />
          <ProficiencyChoice e={e} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
          <ProficiencyChoice e={e} legend="Language Proficiency Choice" field="language-options" items={lists.languages} />
          <ProficiencyChoice e={e} legend="Weapon Proficiency Choice" field="weapon-proficiency-options" items={lists.weapons} />
          <Spells e={e} lists={lists} />
          <Traits e={e} />
        </div>
      )}
    </WithChoices>
  );
}

export const raceBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/races",
  validator: "race",
  one: "race",
  // The old builder's new race (db.cljs default-race).
  empty: { [tag("size")]: tag("medium"), [tag("speed")]: 30, [LANGUAGES]: { [SET]: [] }, [tag("traits")]: [] },
  fields: ["name"],
  Form: RaceForm,
};
