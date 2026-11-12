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
// :description maps. The form shows its common modifiers always, and the
// user adds the other modifiers from a list (modifiers.tsx). The subrace
// form (SubraceForm.tsx) and the feat form (FeatForm.tsx) use the parts
// exported here.
import { Fieldset, Select, SelectBox, XButton } from "@orc-alchemy/ui";
import { useState, type ReactNode } from "react";
import { asSet, setItems, tag } from "../../engine/content.ts";
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import {
  ABILITIES,
  ABILITY_OPTIONS,
  abilityKey,
  AddButton,
  Checks,
  CONDITIONS,
  DAMAGE_TYPES,
  editor,
  FieldRow,
  FormColumn,
  nameToKw,
  numbers,
  orFirst,
  ProficiencyChoice,
  range,
  RecordTextArea,
  SelectField,
  SKILLS,
  SPELL_LEVELS,
  TextField,
  TOOLS,
  Traits,
  WithChoices,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
} from "./fields.tsx";
import { Modifiers, type Modifier } from "./modifiers.tsx";

export const SIZES = ["small", "medium", "large"];
const bonus = (n: number) => `${n > 0 ? "+" : ""}${n}`;
export const BONUSES = range(-2, 3).map((n): [number, string] => [n, bonus(n)]);

/** Checkboxes of the map at :props prop, as {:prop {:key true}}. */
export function PropChecks({ edit, legend, prop, items, action }: { edit: Edit; legend: string; prop: string; items: Choice[]; action?: ReactNode }) {
  return <Checks legend={legend} action={action} items={items} checked={(key) => edit.get("props", prop, key) === true} onToggle={(key) => edit.toggle(["props", prop, key])} />;
}

/** The props of a group's section: the Remove link on its rule, for a modifier (modifiers.tsx). */
type Section = { edit: Edit; action?: ReactNode };

const choices = (keys: string[], name: (key: string) => string): Choice[] => keys.map((key) => ({ key, name: name(key) }));

export const weaponChoices = (lists: BuilderChoices): Choice[] => [
  { key: "simple", name: "All Simple Weapons" },
  { key: "martial", name: "All Martial Weapons" },
  ...lists.weapons,
];
export const ArmorChecks = ({ edit, action }: Section) => (
  <PropChecks edit={edit} legend="Armor Proficiency" action={action} prop="armor-prof" items={choices(["light", "medium", "heavy", "shields"], (a) => `You gain proficiency with ${a}${a === "shields" ? "" : " armor"}`)} />
);
export const ToolChecks = ({ edit, action }: Section) => (
  <Checks legend="Tool Proficiency" action={action} items={TOOLS} checked={(key) => edit.get("profs", "tool", key) === true} onToggle={(key) => edit.toggle(["profs", "tool", key])} />
);
export const ResistanceChecks = ({ edit, action }: Section) => (
  <PropChecks
    edit={edit}
    legend="Damage Resistances"
    action={action}
    prop="damage-resistance"
    items={choices(["traps", ...DAMAGE_TYPES], (d) => (d === "traps" ? "Resistance to damage from traps" : `Resistance to ${d} damage`))}
  />
);
export const ImmunityChecks = ({ edit, action }: Section) => (
  <PropChecks edit={edit} legend="Damage Immunities" action={action} prop="damage-immunity" items={choices(DAMAGE_TYPES, (d) => `Immunity to ${d} damage`)} />
);
export const SkillChecks = ({ edit, action }: Section) => <PropChecks edit={edit} legend="Skill Proficiencies" action={action} prop="skill-prof" items={SKILLS} />;
export const savingThrowChoices = CONDITIONS.map((name) => ({ key: nameToKw(name), name: `You have advantage on saving throws against being ${name}` }));

const UNLOCK_LEVELS = range(1, 21).map((n): [number, string] => [n, `Level ${n}`]);

/**
 * The spells, as the old option-spells: one row for each. "Add a spell"
 * shows a blank row, which is stored only when one of its fields is set, as
 * the old blank last row. "Unlocks at" gates the spell by character level;
 * the spell's own level only filters the spell list. On a phone, the spell
 * select goes on its own line.
 */
export function Spells({ edit, lists }: { edit: Edit; lists: BuilderChoices }) {
  const spells = (edit.get("spells") ?? []) as ItemRecord[];
  const [blank, setBlank] = useState(false);
  return (
    <Fieldset legend="Spells" look="section">
      <div className="grid gap-2">
        {(blank ? [...spells, {}] : spells).map((spell, i) => {
          const n = i + 1;
          const stored = i < spells.length;
          // A field set on the blank row stores the row, which is then a spell like the others.
          const set = (path: (string | number)[], v: unknown) => {
            edit.set(["spells", i, ...path], v);
            if (!stored) setBlank(false);
          };
          const value = (spell[tag("value")] ?? {}) as ItemRecord;
          const level = (value[tag("level")] as number | undefined) ?? 0;
          const options = lists.spells.filter((s) => s.level === level).map((s): [string, string] => [tag(s.key), s.name]);
          return (
            <div
              key={i}
              className="grid grid-cols-[max-content_max-content_minmax(0,1fr)_auto] items-end gap-x-[10px] gap-y-2 border-b border-rule pb-2 sm:grid-cols-[max-content_max-content_max-content_minmax(0,1fr)_auto] sm:border-b-0 sm:pb-0"
            >
              <SelectField label="Unlocks at" name={`Spell ${n} unlocks at`} value={spell[tag("level")]} options={UNLOCK_LEVELS} onSelect={(v) => set(["level"], v)} placeholder="-" />
              <SelectField label="Spell level" name={`Spell ${n} spell level`} value={value[tag("level")]} options={SPELL_LEVELS} onSelect={(v) => set(["value", "level"], v)} />
              <SelectField
                label="Ability"
                name={`Spell ${n} spellcasting ability`}
                value={value[tag("ability")]}
                options={ABILITY_OPTIONS}
                onSelect={(v) => set(["value", "ability"], v)}
                placeholder="<select ability>"
                className="[&>.ui-select]:max-w-full"
              />
              <SelectField
                label="Spell"
                name={`Spell ${n}`}
                value={value[tag("key")]}
                options={options}
                onSelect={(v) => set(["value", "key"], v)}
                placeholder="<select spell>"
                className="col-span-full row-start-2 sm:col-span-1 sm:row-start-auto [&>.ui-select]:w-full"
              />
              <XButton
                aria-label={`Delete spell ${n}`}
                onClick={() => (stored ? edit.set(["spells"], spells.filter((_, j) => j !== i)) : setBlank(false))}
                className="col-start-4 row-start-1 sm:col-start-auto sm:row-start-auto"
              />
            </div>
          );
        })}
      </div>
      <AddButton onClick={() => setBlank(true)}>Add a spell</AddButton>
    </Fieldset>
  );
}

/** The six ability score increases of a race or subrace, each a box with its bonus. note is a line under a box. */
export function AbilityIncreases({ edit, note }: { edit: Edit; note?: (ability: string, bonus: number) => string }) {
  return (
    <Fieldset legend="Ability Score Increases" look="section">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map(([key, name]) => {
          const bonus = (edit.get("abilities", abilityKey(key)) as number | undefined) ?? 0;
          return (
            <div key={key} className="grid content-start gap-1">
              <SelectBox label={name} value={orFirst(bonus, BONUSES)} options={BONUSES} onValueChange={(v) => edit.set(["abilities", abilityKey(key)], v)} />
              {note && <span className="text-center text-[13px] leading-tight text-ink-muted">{note(key, bonus)}</span>}
            </div>
          );
        })}
      </div>
    </Fieldset>
  );
}

const LANGUAGES = tag("languages");
const SPEEDS = numbers(range(0, 55, 5));

/** A speed in :props as a section with one select: 0 until it is set. */
function SpeedSection({ edit, legend, prop, action }: Section & { legend: string; prop: string }) {
  return (
    <Fieldset legend={legend} look="section" action={action}>
      <Select aria-label={legend} value={orFirst(edit.get("props", prop) ?? 0, SPEEDS)} options={SPEEDS} onValueChange={(v) => edit.set(["props", prop], v)} />
    </Fieldset>
  );
}

const AC_CHOICES: Choice[] = [
  { key: "lizardfolk-ac", name: "Without armor your AC becomes 13 + your DEX modifier." },
  { key: "tortle-ac", name: "Your AC is 17, regardless of your DEX modifier or armor." },
];

/** The race's modifiers in form order (docs/design/homebrew-forms.md, "Race"). */
function raceModifiers(edit: Edit, lists: BuilderChoices): Modifier[] {
  const languages = setItems(edit.get("languages"));
  const toggleLanguage = (name: string) => edit.set(["languages"], asSet(languages.includes(name) ? languages.filter((l) => l !== name) : [...languages, name]));
  return [
    {
      id: "flying-speed",
      name: "Flying speed",
      example: "A flying speed from 5 to 50 ft.",
      paths: [["props", "flying-speed"]],
      render: (action) => <SpeedSection edit={edit} legend="Flying speed" prop="flying-speed" action={action} />,
    },
    {
      id: "swimming-speed",
      name: "Swimming speed",
      example: "A swimming speed from 5 to 50 ft.",
      paths: [["props", "swimming-speed"]],
      render: (action) => <SpeedSection edit={edit} legend="Swimming speed" prop="swimming-speed" action={action} />,
    },
    {
      id: "armor-class",
      name: "Armor Class",
      example: "Natural armor: 13 + Dexterity, or always 17",
      paths: AC_CHOICES.map(({ key }) => ["props", key]),
      render: (action) => <Checks legend="Armor Class" action={action} items={AC_CHOICES} checked={(key) => edit.get("props", key) === true} onToggle={(key) => edit.toggle(["props", key])} />,
    },
    { id: "abilities", name: "Ability Score Increases", common: true, render: () => <AbilityIncreases edit={edit} /> },
    {
      id: "languages",
      name: "Languages",
      common: true,
      render: () => <Checks legend="Languages" items={lists.languages.map(({ name }) => ({ key: name, name }))} checked={(name) => languages.includes(name)} onToggle={toggleLanguage} />,
    },
    {
      id: "weapon-prof",
      name: "Weapon Proficiencies",
      example: "Longsword, shortbow, all simple weapons …",
      paths: [["props", "weapon-prof"]],
      render: (action) => <PropChecks edit={edit} legend="Weapon Proficiencies" action={action} prop="weapon-prof" items={weaponChoices(lists)} />,
    },
    { id: "armor-prof", name: "Armor Proficiency", example: "Light, medium or heavy armor, shields", paths: [["props", "armor-prof"]], render: (action) => <ArmorChecks edit={edit} action={action} /> },
    { id: "tool", name: "Tool Proficiency", example: "Smith's tools, thieves' tools …", paths: [["profs", "tool"]], render: (action) => <ToolChecks edit={edit} action={action} /> },
    { id: "damage-resistance", name: "Damage Resistances", common: true, render: () => <ResistanceChecks edit={edit} /> },
    { id: "damage-immunity", name: "Damage Immunities", example: "Poison, necrotic …", paths: [["props", "damage-immunity"]], render: (action) => <ImmunityChecks edit={edit} action={action} /> },
    { id: "skill-prof", name: "Skill Proficiencies", example: "Perception, Stealth …", paths: [["props", "skill-prof"]], render: (action) => <SkillChecks edit={edit} action={action} /> },
    {
      id: "skill-options",
      name: "Skill Proficiency Choice",
      example: "Choose n skills from a list",
      paths: [["profs", "skill-options"]],
      render: (action) => <ProficiencyChoice edit={edit} legend="Skill Proficiency Choice" action={action} field="skill-options" items={SKILLS} />,
    },
    {
      id: "language-options",
      name: "Language Proficiency Choice",
      common: true,
      render: () => <ProficiencyChoice edit={edit} legend="Language Proficiency Choice" field="language-options" items={lists.languages} />,
    },
    {
      id: "weapon-proficiency-options",
      name: "Weapon Proficiency Choice",
      example: "Choose n weapons from a list",
      paths: [["profs", "weapon-proficiency-options"]],
      render: (action) => <ProficiencyChoice edit={edit} legend="Weapon Proficiency Choice" action={action} field="weapon-proficiency-options" items={lists.weapons} />,
    },
    { id: "spells", name: "Spells", common: true, render: () => <Spells edit={edit} lists={lists} /> },
  ];
}

function RaceForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <WithChoices>
      {(lists) => (
        <FormColumn>
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <RecordTextArea edit={edit} field="help" label="Description" />
          <FieldRow>
            <SelectField label="Size" value={edit.get("size") ?? tag("medium")} options={SIZES.map((s) => [tag(s), s])} onSelect={(v) => edit.set(["size"], v)} />
            <SelectField label="Speed" value={edit.get("speed")} options={SPEEDS} onSelect={(v) => edit.set(["speed"], v)} />
            <SelectField label="Darkvision" value={edit.get("darkvision")} options={numbers([0, 60, 120])} onSelect={(v) => edit.set(["darkvision"], v)} />
          </FieldRow>
          <Modifiers record={record} onChange={onChange} modifiers={raceModifiers(edit, lists)} />
          <Traits edit={edit} />
        </FormColumn>
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
