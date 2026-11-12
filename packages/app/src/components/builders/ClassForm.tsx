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
// Where the old app stored nil, for spell slots "No" and the spell list
// "Custom", the form removes the key: the importer and the export check
// treat a nil as a problem. The modifiers and selections are also the
// subclass form's.
import { FieldErrors, Fieldset, Menu, XButton } from "@orc-alchemy/ui";
import type { BuilderChoices } from "../../engine/builder-choices.ts";
import { asSet, intKey, intKeyValue, setItems, tag } from "../../engine/content.ts";
import {
  ABILITIES,
  ABILITY_OPTIONS,
  abilityKey,
  AddButton,
  Checks,
  CONDITIONS,
  DAMAGE_TYPES,
  editor,
  fieldErrors,
  FormColumn,
  Help,
  nameToKw,
  numbers,
  ProficiencyChoice,
  range,
  SelectField,
  SKILLS,
  TextArea,
  TextField,
  title,
  TOOLS,
  Traits,
  WithChoices,
  YES_NO,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Options,
  type Problem,
} from "./fields.tsx";

/** The old app's spells-known schedules (classes.cljc), by the level at which slots start. */
const SCHEDULES: Record<number, Record<number, number>> = {
  1: { 1: 2, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 13: 1, 15: 1, 17: 1 },
  2: { 2: 2, 3: 1, 5: 1, 7: 1, 9: 1, 11: 1, 13: 1, 15: 1, 17: 1, 19: 1 },
  3: { 3: 3, 4: 1, 7: 1, 8: 1, 10: 1, 11: 1, 13: 1, 14: 1, 16: 1, 19: 1, 20: 1 },
};
const LEVELS = numbers(range(1, 21));

const transitSchedule = (factor: number) => Object.fromEntries(Object.entries(SCHEDULES[factor]).map(([level, n]) => [intKey(Number(level)), n]));
const keywords = (keys: string[], text: (key: string) => string = (k) => k): Options => keys.map((key) => [tag(key), text(key)]);

/** The old modifier types (views.cljs modifier-values), by name, with the options of their value. */
function modifierTypes(choices: BuilderChoices): [key: string, name: string, values?: Options][] {
  const speeds = range(10, 130, 10).map((n): [number, string] => [n, `${n} ft.`]);
  return [
    ["armor-prof", "Armor Proficiency", keywords(["light", "medium", "heavy", "shields"])],
    ["damage-immunity", "Damage Immunity", keywords(DAMAGE_TYPES)],
    ["damage-resistance", "Damage Resistance", keywords(DAMAGE_TYPES)],
    ["flying-speed", "Flying Speed", speeds],
    ["flying-speed-equals-walking-speed", "Flying Speed Equals Walking Speed"],
    ["num-attacks", "Number of Attacks", numbers(range(2, 5))],
    ["saving-throw-advantage", "Saving Throw Advantage", CONDITIONS.map((c) => [tag(nameToKw(c)), c])],
    ["skill-prof", "Skill Proficiency", SKILLS.map(({ key, name }) => [tag(key), name])],
    ["spell", "Spell"],
    ["swimming-speed", "Swimming Speed", speeds],
    ["tool-prof", "Tool Proficiency", TOOLS.map(({ key, name }) => [tag(key), name])],
    [
      "weapon-prof",
      "Weapon Proficiency",
      [...keywords(["simple", "martial"], (k) => `All ${k}`), ...choices.weapons.map(({ key, name }): [string, string] => [tag(key), name])].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    ],
  ];
}

/** A row of a list: its fields, then its X button at the end. */
const ROW = "flex flex-wrap items-end gap-x-[10px] gap-y-2 border-b border-rule py-2";

interface ListProps {
  edit: Edit;
  problems: Problem[];
  choices: BuilderChoices;
}

/** :level-modifiers, each a :type, the :level it unlocks at and a :value. */
export function LevelModifiers({ edit, problems, choices }: ListProps) {
  const rows = (edit.get("level-modifiers") ?? []) as ItemRecord[];
  const types = modifierTypes(choices);
  const spells: Options = choices.spells.map(({ key, name }) => [tag(key), name]);
  return (
    <Fieldset legend="Modifiers" look="section" errors={fieldErrors(problems, "level-modifiers", "Modifiers")}>
      {rows.map((row, i) => {
        const n = i + 1;
        const at = (...path: (string | number)[]) => ["level-modifiers", i, ...path];
        const type = types.find(([key]) => tag(key) === row[tag("type")]);
        return (
          <div key={i} className={ROW}>
            {/* A new type keeps the value, as the old event does. */}
            <SelectField label="Type" name={`Modifier ${n} type`} value={row[tag("type")]} options={types.map(([key, name]) => [tag(key), name])} onSelect={(t) => edit.set(at("type"), t)} placeholder="<select type>" className="" />
            <SelectField label="Level" name={`Modifier ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => edit.set(at("level"), v)} placeholder="-" className="" />
            {type?.[2] && <SelectField label="Value" name={`Modifier ${n} value`} value={row[tag("value")]} options={type[2]} onSelect={(v) => edit.set(at("value"), v)} placeholder="<select value>" className="" />}
            {type?.[0] === "spell" && (
              <>
                <SelectField label="Spell level" name={`Modifier ${n} spell level`} value={edit.get(...at("value", "level"))} options={numbers(range(0, 10))} onSelect={(v) => edit.set(at("value", "level"), v)} className="" />
                <SelectField
                  label="Ability"
                  name={`Modifier ${n} spellcasting ability`}
                  className=""
                  value={edit.get(...at("value", "ability"))}
                  options={ABILITY_OPTIONS}
                  onSelect={(v) => edit.set(at("value", "ability"), v)}
                  placeholder="<select ability>"
                />
                <SelectField label="Spell" name={`Modifier ${n} spell`} value={edit.get(...at("value", "key"))} options={spells} onSelect={(v) => edit.set(at("value", "key"), v)} placeholder="<select spell>" className="" />
              </>
            )}
            <XButton aria-label={`Delete modifier ${n}`} onClick={() => edit.set(["level-modifiers"], rows.filter((_, j) => j !== i))} className="ml-auto" />
          </div>
        );
      })}
      <AddButton onClick={() => edit.set(["level-modifiers"], [...rows, {}])}>Add modifier</AddButton>
    </Fieldset>
  );
}

/** :level-selections, each a selection :type of the packs, the :level it is given at and the :num to select. */
export function LevelSelections({ edit, problems, choices }: ListProps) {
  const rows = (edit.get("level-selections") ?? []) as ItemRecord[];
  return (
    <Fieldset legend="Selections" look="section" errors={fieldErrors(problems, "level-selections", "Selections")}>
      <Help>A selection gives options to pick at a level, such as Martial Maneuvers. Make the selection first; it is then a type here.</Help>
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <div key={i} className={ROW}>
            <SelectField
              label="Type"
              name={`Selection ${n} type`}
              className=""
              value={row[tag("type")]}
              options={choices.selections.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => edit.set(["level-selections", i, "type"], v)}
              placeholder="<select type>"
            />
            <SelectField label="Level" name={`Selection ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => edit.set(["level-selections", i, "level"], v)} placeholder="-" className="" />
            <SelectField label="Amount" name={`Selection ${n} amount`} value={row[tag("num")]} options={numbers(range(1, 11))} onSelect={(v) => edit.set(["level-selections", i, "num"], v)} placeholder="-" className="" />
            <XButton aria-label={`Delete selection ${n}`} onClick={() => edit.set(["level-selections"], rows.filter((_, j) => j !== i))} className="ml-auto" />
          </div>
        );
      })}
      <AddButton onClick={() => edit.set(["level-selections"], [...rows, {}])}>Add selection</AddButton>
    </Fieldset>
  );
}

/** :spellcasting, as the old "Spellcasting" section edits it. */
function Spellcasting({ edit, problems, choices }: ListProps) {
  const spellcasting = edit.get("spellcasting") as ItemRecord | undefined;
  const factor = Number(edit.get("spellcasting", "level-factor") ?? 1);
  const cantrips = edit.get("spellcasting", "cantrips?") === true;
  const cantripsKnown = (edit.get("spellcasting", "cantrips-known") ?? {}) as ItemRecord;
  const extraCantrips = Object.keys(cantripsKnown)
    .map(intKeyValue)
    .filter((level) => level !== 1)
    .sort((a, b) => a - b);
  const setCantripLevel = (from: number | undefined, to: unknown) => {
    const next = { ...cantripsKnown };
    if (from !== undefined) delete next[intKey(from)];
    if (to !== undefined) next[intKey(to as number)] = 1;
    edit.set(["spellcasting", "cantrips-known"], next);
  };
  const spellsAt = (level: number) => setItems(edit.get("spellcasting", "spell-list", intKey(level)));
  const toggleSpell = (level: number, key: string) => {
    const spells = spellsAt(level);
    edit.set(["spellcasting", "spell-list", intKey(level)], asSet(spells.includes(key) ? spells.filter((s) => s !== key) : [...spells, key]));
  };
  const maxLevel = factor === 2 ? 5 : factor === 3 ? 4 : 9;

  return (
    <Fieldset legend="Spellcasting" look="section" errors={fieldErrors(problems, "spellcasting", "Spellcasting")}>
      <SelectField
        label="Spell slots"
        value={spellcasting !== undefined}
        options={YES_NO}
        onSelect={(yes) =>
          edit.set(
            ["spellcasting"],
            yes ? { [tag("level-factor")]: 3, [tag("known-mode")]: tag("schedule"), [tag("ability")]: tag(abilityKey("cha")), [tag("spells-known")]: transitSchedule(3) } : undefined,
          )
        }
      />
      {spellcasting && (
        <>
          <SelectField
            label="Spell list"
            value={spellcasting[tag("spell-list-kw")]}
            options={choices.spellLists.map((key) => [tag(key), choices.classes.find((c) => c.key === key)?.name ?? title(key)])}
            onSelect={(v) => edit.set(["spellcasting", "spell-list-kw"], v)}
            placeholder="Custom"
          />
          <SelectField label="Spellcasting ability" value={spellcasting[tag("ability")]} options={ABILITY_OPTIONS} onSelect={(v) => edit.set(["spellcasting", "ability"], v)} placeholder="<select ability>" />
          <SelectField
            label="First spell slots at level"
            value={factor}
            options={numbers([1, 2, 3])}
            onSelect={(v) => edit.set(["spellcasting"], { ...spellcasting, [tag("level-factor")]: v, [tag("spells-known")]: transitSchedule(v as number) })}
          />
        </>
      )}
      {spellcasting && spellcasting[tag("spell-list-kw")] === undefined && (
        <div>
          <SelectField label="Cantrips" value={cantrips} options={YES_NO} onSelect={(v) => edit.set(["spellcasting", "cantrips?"], v)} />
          {cantrips && (
            <>
              <SelectField label="Cantrips known at level 1" value={cantripsKnown[intKey(1)]} options={numbers(range(0, 6))} onSelect={(v) => edit.set(["spellcasting", "cantrips-known", intKey(1)], v)} />
              {extraCantrips.map((level, i) => (
                <div key={level} className="flex items-end gap-[10px]">
                  <SelectField label={`Extra cantrip ${i + 1} level`} value={level} options={numbers(range(2, 21))} onSelect={(v) => setCantripLevel(level, v)} className="mb-[10px]" />
                  <XButton aria-label={`Remove extra cantrip ${i + 1}`} onClick={() => setCantripLevel(level, undefined)} className="mb-[10px]" />
                </div>
              ))}
              <Menu label="Add an extra cantrip at level" items={numbers(range(2, 21))} onPick={(v) => setCantripLevel(undefined, v)} />
            </>
          )}
          {range(cantrips ? 0 : 1, maxLevel + 1).map((level) => (
            <Checks
              key={level}
              legend={level === 0 ? "Cantrips" : `Level ${level} spells`}
              items={choices.spells.filter((s) => s.level === level)}
              checked={(key) => spellsAt(level).includes(tag(key))}
              onToggle={(key) => toggleSpell(level, tag(key))}
            />
          ))}
        </div>
      )}
    </Fieldset>
  );
}

function ClassForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const asiLevels = (edit.get("ability-increase-levels") ?? []) as number[];
  return (
    <WithChoices>
      {(choices) => (
        <FormColumn>
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <TextArea edit={edit} field="help" label="Description" />
          <div className="-mb-[10px]">
            <SelectField label="Hit die" value={edit.get("hit-die")} options={numbers([6, 8, 10, 12])} onSelect={(v) => edit.set(["hit-die"], v)} />
            <SelectField label="Subclass chosen at level" value={edit.get("subclass-level")} options={numbers([1, 2, 3])} onSelect={(v) => edit.set(["subclass-level"], v)} placeholder="-" />
          </div>
          <TextField edit={edit} problems={problems} field="subclass-title" label="Subclass title, such as Path or Circle" />
          <TextField edit={edit} problems={problems} field="subclass-help" label="Subclass description" />
          <Checks
            legend="Saving throws"
            items={ABILITIES.map(([key, name]) => ({ key: abilityKey(key), name: `${name} saving throw` }))}
            checked={(key) => edit.get("profs", "save", key) === true}
            // The old toggle removes the key, not stores false.
            onToggle={(key) => edit.set(["profs", "save", key], edit.get("profs", "save", key) === true ? undefined : true)}
          />
          <Checks
            legend="Ability increase levels"
            items={range(4, 21).map((level) => ({ key: String(level), name: `Ability increase at level ${level}` }))}
            checked={(key) => asiLevels.includes(Number(key))}
            onToggle={(key) => {
              const level = Number(key);
              edit.set(["ability-increase-levels"], (asiLevels.includes(level) ? asiLevels.filter((l) => l !== level) : [...asiLevels, level]).sort((a, b) => a - b));
            }}
          />
          <Spellcasting edit={edit} problems={problems} choices={choices} />
          <ProficiencyChoice edit={edit} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
          <ProficiencyChoice edit={edit} legend="Skill Expertise Choice" field="skill-expertise-options" items={SKILLS} />
          <LevelModifiers edit={edit} problems={problems} choices={choices} />
          <LevelSelections edit={edit} problems={problems} choices={choices} />
          <Traits edit={edit} problems={problems} levels />
          <FieldErrors label="Proficiencies" errors={fieldErrors(problems, "profs", "Proficiencies")} />
        </FormColumn>
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
