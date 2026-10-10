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
import { asSet, setItems, tag } from "../../engine/content.ts";
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import {
  ABILITIES,
  ABILITY_OPTIONS,
  abilityKey,
  Checks,
  CONDITIONS,
  DAMAGE_TYPES,
  editor,
  nameToKey,
  numbers,
  ProficiencyChoice,
  range,
  Select,
  SKILLS,
  TextField,
  TOOLS,
  Traits,
  WithChoices,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
} from "./fields.tsx";

export const SIZES = ["small", "medium", "large"];
const bonus = (n: number) => `${n > 0 ? "+" : ""}${n}`;
export const BONUSES = range(-2, 3).map((n): [number, string] => [n, bonus(n)]);

/** Checkboxes of the map at :props prop, as {:prop {:key true}}. */
export function PropChecks({ edit, legend, prop, items }: { edit: Edit; legend: string; prop: string; items: Choice[] }) {
  return <Checks legend={legend} items={items} checked={(key) => edit.get("props", prop, key) === true} onToggle={(key) => edit.toggle(["props", prop, key])} />;
}

const choices = (keys: string[], name: (key: string) => string): Choice[] => keys.map((key) => ({ key, name: name(key) }));

export const weaponChoices = (lists: BuilderChoices): Choice[] => [
  { key: "simple", name: "All Simple Weapons" },
  { key: "martial", name: "All Martial Weapons" },
  ...lists.weapons,
];
export const ArmorChecks = ({ edit }: { edit: Edit }) => (
  <PropChecks edit={edit} legend="Armor Proficiency" prop="armor-prof" items={choices(["light", "medium", "heavy", "shields"], (a) => `You gain proficiency with ${a}${a === "shields" ? "" : " armor"}`)} />
);
export const ToolChecks = ({ edit }: { edit: Edit }) => (
  <Checks legend="Tool Proficiency" items={TOOLS} checked={(key) => edit.get("profs", "tool", key) === true} onToggle={(key) => edit.toggle(["profs", "tool", key])} />
);
export const ResistanceChecks = ({ edit }: { edit: Edit }) => (
  <PropChecks
    edit={edit}
    legend="Damage Resistances"
    prop="damage-resistance"
    items={choices(["traps", ...DAMAGE_TYPES], (d) => (d === "traps" ? "Resistance to damage from traps" : `Resistance to ${d} damage`))}
  />
);
export const ImmunityChecks = ({ edit }: { edit: Edit }) => (
  <PropChecks edit={edit} legend="Damage Immunities" prop="damage-immunity" items={choices(DAMAGE_TYPES, (d) => `Immunity to ${d} damage`)} />
);
export const SkillChecks = ({ edit }: { edit: Edit }) => <PropChecks edit={edit} legend="Skill Proficiencies" prop="skill-prof" items={SKILLS} />;
export const savingThrowChoices = CONDITIONS.map((name) => ({ key: nameToKey(name), name: `You have advantage on saving throws against being ${name}` }));

/**
 * The spells, as the old option-spells: one row for each, and a blank row
 * that adds a spell when it is set. "Unlock at level" gates the spell by
 * character level; the spell's own level only filters the spell list.
 */
export function Spells({ edit, lists }: { edit: Edit; lists: BuilderChoices }) {
  const spells = (edit.get("spells") ?? []) as ItemRecord[];
  return (
    <fieldset>
      <legend className="font-bold">Spells</legend>
      {[...spells, {}].map((spell, i) => {
        const n = i + 1;
        const value = (spell[tag("value")] ?? {}) as ItemRecord;
        const level = (value[tag("level")] as number | undefined) ?? 0;
        const options = lists.spells.filter((s) => s.level === level).map((s): [string, string] => [tag(s.key), s.name]);
        return (
          <div key={i}>
            <Select label={`Spell ${n} unlock at level`} value={spell[tag("level")]} options={numbers(range(1, 21))} onSelect={(v) => edit.set(["spells", i, "level"], v)} placeholder="-" />
            <Select label={`Spell ${n} level`} value={value[tag("level")]} options={numbers(range(0, 10))} onSelect={(v) => edit.set(["spells", i, "value", "level"], v)} />
            <Select label={`Spell ${n} spellcasting ability`} value={value[tag("ability")]} options={ABILITY_OPTIONS} onSelect={(v) => edit.set(["spells", i, "value", "ability"], v)} placeholder="<select ability>" />
            <Select label={`Spell ${n}`} value={value[tag("key")]} options={options} onSelect={(v) => edit.set(["spells", i, "value", "key"], v)} placeholder="<select spell>" />
            {i < spells.length && (
              <button type="button" onClick={() => edit.set(["spells"], spells.filter((_, j) => j !== i))} className="border border-black px-2">
                Delete spell {n}
              </button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}

const LANGUAGES = tag("languages");

function RaceForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const languages = setItems(record[LANGUAGES]);
  const toggleLanguage = (name: string) => edit.set(["languages"], asSet(languages.includes(name) ? languages.filter((l) => l !== name) : [...languages, name]));
  const speeds = numbers(range(0, 55, 5));
  return (
    <WithChoices>
      {(lists) => (
        <div className="space-y-3">
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <label className="block">
            Description
            <textarea value={String(edit.get("help") ?? "")} onChange={(ev) => edit.set(["help"], ev.target.value)} className="block w-full border border-black" rows={4} />
          </label>
          <div>
            <Select label="Size" value={edit.get("size") ?? tag("medium")} options={SIZES.map((s) => [tag(s), s])} onSelect={(v) => edit.set(["size"], v)} />
            <Select label="Speed" value={edit.get("speed")} options={speeds} onSelect={(v) => edit.set(["speed"], v)} />
            <Select label="Flying speed" value={edit.get("props", "flying-speed") ?? 0} options={speeds} onSelect={(v) => edit.set(["props", "flying-speed"], v)} />
            <Select label="Swimming speed" value={edit.get("props", "swimming-speed") ?? 0} options={speeds} onSelect={(v) => edit.set(["props", "swimming-speed"], v)} />
            <Select label="Darkvision" value={edit.get("darkvision")} options={numbers([0, 60, 120])} onSelect={(v) => edit.set(["darkvision"], v)} />
          </div>
          <Checks
            legend="Armor Class"
            items={[
              { key: "lizardfolk-ac", name: "Without armor your AC becomes 13 + your DEX modifier." },
              { key: "tortle-ac", name: "Your AC is 17, regardless of your DEX modifier or armor." },
            ]}
            checked={(key) => edit.get("props", key) === true}
            onToggle={(key) => edit.toggle(["props", key])}
          />
          <fieldset>
            <legend className="font-bold">Ability Score Increases</legend>
            {ABILITIES.map(([key, name]) => (
              <Select key={key} label={name} value={edit.get("abilities", abilityKey(key)) ?? 0} options={BONUSES} onSelect={(v) => edit.set(["abilities", abilityKey(key)], v)} />
            ))}
          </fieldset>
          <Checks legend="Languages" items={lists.languages.map(({ name }) => ({ key: name, name }))} checked={(name) => languages.includes(name)} onToggle={toggleLanguage} />
          <PropChecks edit={edit} legend="Weapon Proficiencies" prop="weapon-prof" items={weaponChoices(lists)} />
          <ArmorChecks edit={edit} />
          <ToolChecks edit={edit} />
          <ResistanceChecks edit={edit} />
          <ImmunityChecks edit={edit} />
          <SkillChecks edit={edit} />
          <ProficiencyChoice edit={edit} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
          <ProficiencyChoice edit={edit} legend="Language Proficiency Choice" field="language-options" items={lists.languages} />
          <ProficiencyChoice edit={edit} legend="Weapon Proficiency Choice" field="weapon-proficiency-options" items={lists.weapons} />
          <Spells edit={edit} lists={lists} />
          <Traits edit={edit} />
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
  empty: { [tag("size")]: tag("medium"), [tag("speed")]: 30, [LANGUAGES]: asSet([]), [tag("traits")]: [] },
  fields: ["name"],
  Form: RaceForm,
};
