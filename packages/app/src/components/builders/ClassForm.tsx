// The class form of the homebrew builder, with the fields of the old app's
// class builder (views.cljs class-builder). Each value is stored as the old
// app's events stored it (events.cljs ::classes/... and the
// reg-option-modifiers, reg-option-selections and reg-option-traits events),
// so an .orcbrew export round-trips: :hit-die and :subclass-level integers,
// :profs {:save {ability-key true}}, :ability-increase-levels a sorted vector
// of integers, :spellcasting a map of :level-factor, :known-mode, :ability,
// :spells-known (the old schedules), :spell-list-kw and, for a custom list,
// :cantrips?, :cantrips-known {level count} and :spell-list {level #{spell}},
// :level-modifiers [{:type :value :level}], :level-selections
// [{:type :level :num}] and :traits [{:name :type :level :description}].
// The skill choices and the three row lists are also the subclass form's.
import type { ReactNode } from "react";
import { useClassChoices, type ClassChoices } from "../../engine/class-choices.ts";
import { tag } from "../../engine/content.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { CONDITIONS, DAMAGE_TYPES, FieldProblems, nameToKey, title, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

/** A select's options: the stored value and its text. */
type Options = [value: unknown, text: string][];

export const ABILITIES = [
  ["str", "Strength"],
  ["dex", "Dexterity"],
  ["con", "Constitution"],
  ["int", "Intelligence"],
  ["wis", "Wisdom"],
  ["cha", "Charisma"],
].map(([key, name]): [string, string] => [tag(`orcpub.dnd.e5.character/${key}`), name]);
const SKILLS = ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"];
/** The old app's tools (equipment.cljc tools). */
const TOOLS = [
  ...["Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre", "Horn", "Pan Flute", "Shawm", "Viol"],
  ...["Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils"],
  ...["Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies", "Potter's Tools", "Smith's Tools", "Tinker's Tools"],
  ...["Weaver's Tools", "Woodcarver's Tools", "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools"],
  ...["Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set", "Water Vehicles", "Land Vehicles"],
];
/** The SRD classes with a spell list (::spells/spell-lists). */
const SPELL_LISTS = ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"];
/** The old app's spells-known schedules (classes.cljc), by the level at which slots start. */
const SCHEDULES: Record<number, Record<number, number>> = {
  1: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 13: 1, 15: 1, 17: 1 },
  2: { 2: 2, 3: 1, 5: 1, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1, 17: 1, 19: 1 },
  3: { 3: 3, 4: 1, 7: 1, 8: 1, 10: 1, 11: 1, 13: 1, 14: 1, 16: 1, 19: 1, 20: 1 },
};
const TRAIT_TYPES: Options = [
  [tag("other"), "Other"],
  [tag("action"), "Action"],
  [tag("b-action"), "Bonus Action"],
  [tag("reaction"), "Reaction"],
];

/** An integer map key, as Transit encodes it: 3 is "~i3". */
export const intKey = (n: number) => `~i${n}`;
const transitSchedule = (factor: number) => Object.fromEntries(Object.entries(SCHEDULES[factor]).map(([level, n]) => [intKey(Number(level)), n]));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numbers = (values: number[]): Options => values.map((n) => [n, String(n)]);
const keywords = (keys: string[], text: (key: string) => string = title): Options => keys.map((key) => [tag(key), text(key)]);
const toolKey = (name: string) => nameToKey(name.replace(/'/g, ""));

/** The map with the value at the path of keys, or without it when the value is undefined. */
export function assocIn(map: ItemRecord, [key, ...rest]: string[], value: unknown): ItemRecord {
  const next = rest.length === 0 ? value : assocIn((map[key] ?? {}) as ItemRecord, rest, value);
  const copy = { ...map, [key]: next };
  if (next === undefined) delete copy[key];
  return copy;
}

/** The value at the path of keys, or undefined. */
export const getIn = (map: ItemRecord, path: string[]): unknown => path.reduce<unknown>((m, key) => (m as ItemRecord | undefined)?.[key], map);

/**
 * A labelled select of options. "-" (placeholder) is an extra first option
 * for no value, which onSelect gets as undefined.
 */
export function Select({ label, value, options, onSelect, placeholder }: { label: string; value: unknown; options: Options; onSelect: (value: unknown) => void; placeholder?: string }) {
  // Each option's value is its stored value as text, so a number or a keyword finds its option.
  const known = options.some(([v]) => v === value);
  return (
    <label className="mr-4 inline-block">
      {label}{" "}
      <select
        value={known ? String(value) : ""}
        onChange={(e) => onSelect(options.find(([v]) => String(v) === e.target.value)?.[0])}
        className="border border-black"
      >
        {(placeholder !== undefined || !known) && <option value="">{placeholder ?? "-"}</option>}
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({ record, onChange, problems, field, label }: FormProps & { field: string; label: string }) {
  return (
    <div>
      <label className="block">
        {label}{" "}
        <input type="text" value={String(record[tag(field)] ?? "")} onChange={(e) => onChange(assocIn(record, [tag(field)], e.target.value))} className="border border-black px-1" />
      </label>
      <FieldProblems problems={problems} field={field} label={label} />
    </div>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="mr-4 inline-block">
      <input type="checkbox" checked={checked} onChange={onToggle} /> {label}
    </label>
  );
}

/** The old skill proficiency or expertise choice: :profs {field {:choose n :options {skill true-or-false}}}. */
export function SkillChoice({ record, onChange, field, legend }: Omit<FormProps, "problems"> & { field: string; legend: string }) {
  const path = [tag("profs"), tag(field)];
  const options = (getIn(record, [...path, tag("options")]) ?? {}) as ItemRecord;
  const choose = getIn(record, [...path, tag("choose")]);
  return (
    <fieldset>
      <legend>{legend}</legend>
      <Select label={`${legend}: choose`} value={choose ?? 1} options={numbers(range(1, 5))} onSelect={(n) => onChange(assocIn(record, [...path, tag("choose")], n))} />
      <div>
        {SKILLS.map((name) => {
          const key = tag(nameToKey(name));
          return (
            <Checkbox
              key={key}
              label={name}
              checked={options[key] === true}
              onToggle={() => {
                // The old toggle stores false for an option turned off. The
                // choose shown, 1, is stored with the first option, as the
                // importer adds it to a choice without one.
                const next = assocIn(record, [...path, tag("options"), key], options[key] !== true);
                onChange(choose === undefined ? assocIn(next, [...path, tag("choose")], 1) : next);
              }}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

/** The rows of a vector field, with a change of one row's key, an added row and a deleted row. */
function useRows(record: ItemRecord, onChange: FormProps["onChange"], field: string) {
  const rows = (record[tag(field)] ?? []) as ItemRecord[];
  return {
    rows,
    set: (index: number, key: string, value: unknown) => onChange(assocIn(record, [tag(field)], rows.map((row, i) => (i === index ? assocIn(row, [tag(key)], value) : row)))),
    replace: (index: number, row: ItemRecord) => onChange(assocIn(record, [tag(field)], rows.map((r, i) => (i === index ? row : r)))),
    add: () => onChange(assocIn(record, [tag(field)], [...rows, {}])),
    remove: (index: number) => onChange(assocIn(record, [tag(field)], rows.filter((_, i) => i !== index))),
  };
}

const button = "border border-black px-2";
const LEVELS = numbers(range(1, 20));

/** The old modifier types (views.cljs modifier-values), by name, with the options of their value. */
function modifierTypes(choices: ClassChoices): [key: string, name: string, values?: Options][] {
  const speeds = range(1, 12).map((n): [number, string] => [n * 10, `${n * 10} ft.`]);
  return [
    ["armor-prof", "Armor Proficiency", keywords(["light", "medium", "heavy", "shields"], (k) => k)],
    ["damage-immunity", "Damage Immunity", keywords(DAMAGE_TYPES, (k) => k)],
    ["damage-resistance", "Damage Resistance", keywords(DAMAGE_TYPES, (k) => k)],
    ["flying-speed", "Flying Speed", speeds],
    ["flying-speed-equals-walking-speed", "Flying Speed Equals Walking Speed"],
    ["num-attacks", "Number of Attacks", numbers(range(2, 4))],
    ["saving-throw-advantage", "Saving Throw Advantage", CONDITIONS.map((c) => [tag(nameToKey(c)), c])],
    ["skill-prof", "Skill Proficiency", SKILLS.map((s) => [tag(nameToKey(s)), s])],
    ["spell", "Spell"],
    ["swimming-speed", "Swimming Speed", speeds],
    ["tool-prof", "Tool Proficiency", TOOLS.map((t) => [tag(toolKey(t)), t])],
    [
      "weapon-prof",
      "Weapon Proficiency",
      [...keywords(["simple", "martial"], (k) => `All ${k}`), ...choices.weapons.map(({ key, name }): [string, string] => [tag(key), name])].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    ],
  ];
}

/** :level-modifiers, each a :type, the :level it unlocks at and a :value. */
export function LevelModifiers({ record, onChange, problems, choices }: FormProps & { choices: ClassChoices }) {
  const { rows, set, replace, add, remove } = useRows(record, onChange, "level-modifiers");
  const types = modifierTypes(choices);
  const spells: Options = choices.spells.map(({ key, name }) => [tag(key), name]);
  return (
    <fieldset>
      <legend>Modifiers</legend>
      {rows.map((row, i) => {
        const n = i + 1;
        const type = types.find(([key]) => tag(key) === row[tag("type")]);
        const value = (row[tag("value")] ?? {}) as ItemRecord;
        const setValue = (key: string, v: unknown) => set(i, "value", assocIn(value, [tag(key)], v));
        return (
          <div key={i} className="mb-2">
            <Select
              label={`Modifier ${n} type`}
              value={row[tag("type")]}
              options={types.map(([key, name]) => [tag(key), name])}
              // A new type drops the value of the old one.
              onSelect={(t) => replace(i, assocIn(assocIn(row, [tag("type")], t), [tag("value")], undefined))}
              placeholder="<select type>"
            />
            <Select label={`Modifier ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => set(i, "level", v)} />
            {type?.[2] && <Select label={`Modifier ${n} value`} value={row[tag("value")]} options={type[2]} onSelect={(v) => set(i, "value", v)} placeholder="<select value>" />}
            {type?.[0] === "spell" && (
              <>
                <Select label={`Modifier ${n} spell level`} value={value[tag("level")]} options={numbers(range(0, 9))} onSelect={(v) => setValue("level", v)} />
                <Select label={`Modifier ${n} spellcasting ability`} value={value[tag("ability")]} options={ABILITIES} onSelect={(v) => setValue("ability", v)} placeholder="<select ability>" />
                <Select label={`Modifier ${n} spell`} value={value[tag("key")]} options={spells} onSelect={(v) => setValue("key", v)} placeholder="<select spell>" />
              </>
            )}
            <button type="button" onClick={() => remove(i)} className={button}>
              Delete modifier {n}
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} className={button}>
        Add modifier
      </button>
      <FieldProblems problems={problems} field="level-modifiers" label="Modifiers" />
    </fieldset>
  );
}

/** :level-selections, each a selection :type of the packs, the :level it is given at and the :num to select. */
export function LevelSelections({ record, onChange, problems, choices }: FormProps & { choices: ClassChoices }) {
  const { rows, set, add, remove } = useRows(record, onChange, "level-selections");
  return (
    <fieldset>
      <legend>Selections</legend>
      <p>A selection gives options to pick at a level, such as Martial Maneuvers. Make the selection first; it is then a type here.</p>
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <div key={i} className="mb-2">
            <Select
              label={`Selection ${n} type`}
              value={row[tag("type")]}
              options={choices.selections.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => set(i, "type", v)}
              placeholder="<select type>"
            />
            <Select label={`Selection ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => set(i, "level", v)} />
            <Select label={`Selection ${n} amount`} value={row[tag("num")] ?? 1} options={numbers(range(1, 10))} onSelect={(v) => set(i, "num", v)} />
            <button type="button" onClick={() => remove(i)} className={button}>
              Delete selection {n}
            </button>
          </div>
        );
      })}
      <button type="button" onClick={add} className={button}>
        Add selection
      </button>
      <FieldProblems problems={problems} field="level-selections" label="Selections" />
    </fieldset>
  );
}

/** :traits, each a :name, :type, the :level it is unlocked at and a :description. */
export function Traits({ record, onChange, problems }: FormProps) {
  const { rows, set, add, remove } = useRows(record, onChange, "traits");
  return (
    <fieldset>
      <legend>Features / traits</legend>
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <div key={i} className="mb-3">
            <label className="mr-4 inline-block">
              Feature {n} name{" "}
              <input type="text" value={String(row[tag("name")] ?? "")} onChange={(e) => set(i, "name", e.target.value)} className="border border-black px-1" />
            </label>
            <Select label={`Feature ${n} type`} value={row[tag("type")]} options={TRAIT_TYPES} onSelect={(v) => set(i, "type", v)} />
            <Select label={`Feature ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => set(i, "level", v)} />
            <button type="button" onClick={() => remove(i)} className={button}>
              Delete feature {n}
            </button>
            <label className="block">
              Feature {n} description
              <textarea value={String(row[tag("description")] ?? "")} onChange={(e) => set(i, "description", e.target.value)} className="block w-full border border-black" />
            </label>
          </div>
        );
      })}
      <button type="button" onClick={add} className={button}>
        Add feature / trait
      </button>
      <FieldProblems problems={problems} field="traits" label="Features / traits" />
    </fieldset>
  );
}

/** The lists of the enabled packs and the SRD, or a status line until they load. */
export function WithChoices({ children }: { children: (choices: ClassChoices) => ReactNode }) {
  const homebrew = useHomebrew((state) => state.homebrew);
  const choices = useClassChoices(homebrew);
  return choices === null ? <p role="status">Reading the content lists…</p> : children(choices);
}

/** :spellcasting, as the old "Spellcasting" section edits it. */
function Spellcasting({ record, onChange, problems, choices }: FormProps & { choices: ClassChoices }) {
  const spellcasting = record[tag("spellcasting")] as ItemRecord | undefined;
  /** Sets the value at the path of Transit keys in :spellcasting. */
  const set = (path: string[], value: unknown) => onChange(assocIn(record, [tag("spellcasting"), ...path], value));
  const factor = Number(spellcasting?.[tag("level-factor")] ?? 1);
  const cantrips = spellcasting?.[tag("cantrips?")] === true;
  const cantripsKnown = (spellcasting?.[tag("cantrips-known")] ?? {}) as ItemRecord;
  const extraCantrips = Object.keys(cantripsKnown)
    .map((key) => Number(key.slice(2)))
    .filter((level) => level !== 1)
    .sort((a, b) => a - b);
  const setCantripLevel = (from: number | undefined, to: unknown) => {
    const next = { ...cantripsKnown };
    if (from !== undefined) delete next[intKey(from)];
    if (to !== undefined) next[intKey(to as number)] = 1;
    set([tag("cantrips-known")], next);
  };
  const spellList = (spellcasting?.[tag("spell-list")] ?? {}) as Record<string, { "~#set": string[] } | undefined>;
  const toggleSpell = (level: number, key: string) => {
    const spells = spellList[intKey(level)]?.["~#set"] ?? [];
    set([tag("spell-list"), intKey(level)], { "~#set": spells.includes(key) ? spells.filter((s) => s !== key) : [...spells, key] });
  };
  const maxLevel = factor === 2 ? 5 : factor === 3 ? 4 : 9;

  return (
    <fieldset>
      <legend>Spellcasting</legend>
      <Select
        label="Spell slots"
        value={spellcasting !== undefined}
        options={[
          [false, "No"],
          [true, "Yes"],
        ]}
        onSelect={(yes) =>
          onChange(
            assocIn(
              record,
              [tag("spellcasting")],
              yes
                ? { [tag("level-factor")]: 3, [tag("known-mode")]: tag("schedule"), [tag("ability")]: ABILITIES[5][0], [tag("spells-known")]: transitSchedule(3) }
                : undefined,
            ),
          )
        }
      />
      {spellcasting && (
        <>
          <Select
            label="Spell list"
            value={spellcasting[tag("spell-list-kw")]}
            options={SPELL_LISTS.map((key) => [tag(key), choices.classes.find((c) => c.key === key)?.name ?? title(key)])}
            onSelect={(v) => set([tag("spell-list-kw")], v)}
            placeholder="Custom"
          />
          <Select label="Spellcasting ability" value={spellcasting[tag("ability")]} options={ABILITIES} onSelect={(v) => set([tag("ability")], v)} placeholder="<select ability>" />
          <Select
            label="First spell slots at level"
            value={factor}
            options={numbers([1, 2, 3])}
            onSelect={(v) =>
              onChange(
                assocIn(assocIn(record, [tag("spellcasting"), tag("level-factor")], v), [tag("spellcasting"), tag("spells-known")], transitSchedule(v as number)),
              )
            }
          />
        </>
      )}
      {spellcasting && spellcasting[tag("spell-list-kw")] === undefined && (
        <div>
          <Select
            label="Cantrips"
            value={cantrips}
            options={[
              [false, "No"],
              [true, "Yes"],
            ]}
            onSelect={(v) => set([tag("cantrips?")], v)}
          />
          {cantrips && (
            <>
              <Select label="Cantrips known at level 1" value={cantripsKnown[intKey(1)]} options={numbers(range(0, 5))} onSelect={(v) => set([tag("cantrips-known"), intKey(1)], v)} />
              {extraCantrips.map((level, i) => (
                <div key={level}>
                  <Select label={`Extra cantrip ${i + 1} level`} value={level} options={numbers(range(2, 20))} onSelect={(v) => setCantripLevel(level, v)} />
                  <button type="button" onClick={() => setCantripLevel(level, undefined)} className={button}>
                    Remove extra cantrip {i + 1}
                  </button>
                </div>
              ))}
              <Select label="Add an extra cantrip at level" value={undefined} options={numbers(range(2, 20))} onSelect={(v) => setCantripLevel(undefined, v)} />
            </>
          )}
          {range(cantrips ? 0 : 1, maxLevel).map((level) => {
            const chosen = spellList[intKey(level)]?.["~#set"] ?? [];
            return (
              <fieldset key={level}>
                <legend>{level === 0 ? "Cantrips" : `Level ${level} spells`}</legend>
                {choices.spells
                  .filter((s) => s.level === level)
                  .map(({ key, name }) => (
                    <Checkbox key={key} label={name} checked={chosen.includes(tag(key))} onToggle={() => toggleSpell(level, tag(key))} />
                  ))}
              </fieldset>
            );
          })}
        </div>
      )}
      <FieldProblems problems={problems} field="spellcasting" label="Spellcasting" />
    </fieldset>
  );
}

function ClassForm(props: FormProps) {
  const { record, onChange, problems } = props;
  const set = (field: string, value: unknown) => onChange(assocIn(record, [tag(field)], value));
  const saves = (getIn(record, [tag("profs"), tag("save")]) ?? {}) as ItemRecord;
  const asiLevels = (record[tag("ability-increase-levels")] ?? []) as number[];
  return (
    <WithChoices>
      {(choices) => (
        <div className="space-y-3">
          <TextField {...props} field="name" label="Name" />
          <label className="block">
            Description
            <textarea value={String(record[tag("help")] ?? "")} onChange={(e) => set("help", e.target.value)} className="block w-full border border-black" rows={4} />
          </label>
          <div>
            <Select label="Hit die" value={record[tag("hit-die")]} options={numbers([6, 8, 10, 12])} onSelect={(v) => set("hit-die", v)} />
            <Select label="Pick subclass at level" value={record[tag("subclass-level")]} options={numbers([1, 2, 3])} onSelect={(v) => set("subclass-level", v)} />
          </div>
          <TextField {...props} field="subclass-title" label="Subclass title" />
          <TextField {...props} field="subclass-help" label="Subclass flavor" />
          <fieldset>
            <legend>Saving throws</legend>
            {ABILITIES.map(([key, name]) => (
              <Checkbox
                key={key}
                label={`${name} saving throw`}
                checked={saves[key] === true}
                onToggle={() => onChange(assocIn(record, [tag("profs"), tag("save"), key], saves[key] === true ? undefined : true))}
              />
            ))}
          </fieldset>
          <fieldset>
            <legend>Ability increase levels</legend>
            {range(4, 20).map((level) => (
              <Checkbox
                key={level}
                label={`Ability increase at level ${level}`}
                checked={asiLevels.includes(level)}
                onToggle={() =>
                  set(
                    "ability-increase-levels",
                    (asiLevels.includes(level) ? asiLevels.filter((l) => l !== level) : [...asiLevels, level]).sort((a, b) => a - b),
                  )
                }
              />
            ))}
          </fieldset>
          <Spellcasting {...props} choices={choices} />
          <SkillChoice record={record} onChange={onChange} field="skill-options" legend="Skill proficiency choice" />
          <SkillChoice record={record} onChange={onChange} field="skill-expertise-options" legend="Skill expertise choice" />
          <LevelModifiers {...props} choices={choices} />
          <LevelSelections {...props} choices={choices} />
          <Traits {...props} />
          <FieldProblems problems={problems} field="profs" label="Proficiencies" />
        </div>
      )}
    </WithChoices>
  );
}

export const classBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/classes",
  validator: "class",
  one: "class",
  // The old builder's new class (db.cljs default-class).
  empty: { [tag("hit-die")]: 6, [tag("ability-increase-levels")]: [4, 8, 12, 16, 19], [tag("traits")]: [], [tag("level-modifiers")]: [] },
  fields: ["name", "help", "hit-die", "subclass-level", "subclass-title", "subclass-help", "profs", "ability-increase-levels", "spellcasting", "level-modifiers", "level-selections", "traits"],
  Form: ClassForm,
};
