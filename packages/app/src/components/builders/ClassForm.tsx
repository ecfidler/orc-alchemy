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
import { Chips, FieldErrors, Fieldset, XButton } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import type { BuilderChoices } from "../../engine/builder-choices.ts";
import { intKey, intKeyValue, setItems, tag, untag } from "../../engine/content.ts";
import { ordinal } from "../CharacterSheet.tsx";
import {
  ABILITIES,
  ABILITY_OPTIONS,
  abilityKey,
  AddButton,
  Checks,
  ChoicePicker,
  CONDITIONS,
  DAMAGE_TYPES,
  editor,
  fieldErrors,
  FieldRow,
  FormColumn,
  Help,
  nameToKw,
  numbers,
  range,
  RecordTextArea,
  SelectField,
  SetPicker,
  SKILLS,
  SPELL_LEVELS,
  TextField,
  title,
  TOOLS,
  Traits,
  WithChoices,
  withOthers,
  YES_NO,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Options,
  type PickItem,
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

/**
 * The old modifier types (views.cljs modifier-values), with the options of
 * their value. The most used types are first (docs/design/homebrew-forms.md,
 * "Level modifiers"); the others are by name.
 */
function modifierTypes(choices: BuilderChoices): [key: string, name: string, values?: Options][] {
  const speeds = range(10, 130, 10).map((n): [number, string] => [n, `${n} ft.`]);
  return [
    ["spell", "Spell"],
    ["armor-prof", "Armor Proficiency", keywords(["light", "medium", "heavy", "shields"])],
    [
      "weapon-prof",
      "Weapon Proficiency",
      [...keywords(["simple", "martial"], (k) => `All ${k}`), ...choices.weapons.map(({ key, name }): [string, string] => [tag(key), name])].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    ],
    ["damage-resistance", "Damage Resistance", keywords(DAMAGE_TYPES)],
    ["damage-immunity", "Damage Immunity", keywords(DAMAGE_TYPES)],
    ["flying-speed", "Flying Speed", speeds],
    ["flying-speed-equals-walking-speed", "Flying Speed Equals Walking Speed"],
    ["num-attacks", "Number of Attacks", numbers(range(2, 5))],
    ["saving-throw-advantage", "Saving Throw Advantage", CONDITIONS.map((c) => [tag(nameToKw(c)), c])],
    ["skill-prof", "Skill Proficiency", SKILLS.map(({ key, name }) => [tag(key), name])],
    ["swimming-speed", "Swimming Speed", speeds],
    ["tool-prof", "Tool Proficiency", TOOLS.map(({ key, name }) => [tag(key), name])],
  ];
}

interface ListProps {
  edit: Edit;
  problems: Problem[];
  choices: BuilderChoices;
}

/** A row list as a section: its title, and the control on its rule, such as the Remove link of a modifier (modifiers.tsx). */
interface SectionProps extends ListProps {
  legend?: string;
  action?: ReactNode;
}

/** :level-modifiers, each a :type, the :level it unlocks at and a :value. */
export function LevelModifiers({ edit, problems, choices, legend = "Modifiers", action }: SectionProps) {
  const rows = (edit.get("level-modifiers") ?? []) as ItemRecord[];
  const types = modifierTypes(choices);
  const spells: Options = choices.spells.map(({ key, name }) => [tag(key), name]);
  return (
    <Fieldset legend={legend} look="section" action={action} errors={fieldErrors(problems, "level-modifiers", legend)}>
      {rows.map((row, i) => {
        const n = i + 1;
        const at = (...path: (string | number)[]) => ["level-modifiers", i, ...path];
        const type = types.find(([key]) => tag(key) === row[tag("type")]);
        return (
          <FieldRow key={i} look="list">
            {/* A new type keeps the value, as the old event does. */}
            <SelectField label="Type" name={`Modifier ${n} type`} value={row[tag("type")]} options={types.map(([key, name]) => [tag(key), name])} onSelect={(t) => edit.set(at("type"), t)} placeholder="<select type>" />
            <SelectField label="Level" name={`Modifier ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => edit.set(at("level"), v)} placeholder="-" />
            {type?.[2] && <SelectField label="Value" name={`Modifier ${n} value`} value={row[tag("value")]} options={type[2]} onSelect={(v) => edit.set(at("value"), v)} placeholder="<select value>" />}
            {type?.[0] === "spell" && (
              <>
                <SelectField label="Spell level" name={`Modifier ${n} spell level`} value={edit.get(...at("value", "level"))} options={SPELL_LEVELS} onSelect={(v) => edit.set(at("value", "level"), v)} />
                <SelectField
                  label="Ability"
                  name={`Modifier ${n} spellcasting ability`}
                  value={edit.get(...at("value", "ability"))}
                  options={ABILITY_OPTIONS}
                  onSelect={(v) => edit.set(at("value", "ability"), v)}
                  placeholder="<select ability>"
                />
                <SelectField label="Spell" name={`Modifier ${n} spell`} value={edit.get(...at("value", "key"))} options={spells} onSelect={(v) => edit.set(at("value", "key"), v)} placeholder="<select spell>" />
              </>
            )}
            <XButton aria-label={`Delete modifier ${n}`} onClick={() => edit.set(["level-modifiers"], rows.filter((_, j) => j !== i))} className="ml-auto" />
          </FieldRow>
        );
      })}
      <AddButton onClick={() => edit.set(["level-modifiers"], [...rows, {}])}>Add a level modifier</AddButton>
    </Fieldset>
  );
}

/** :level-selections, each a selection :type of the packs, the :level it is given at and the :num to select. */
export function LevelSelections({ edit, problems, choices, legend = "Selections", action }: SectionProps) {
  const rows = (edit.get("level-selections") ?? []) as ItemRecord[];
  return (
    <Fieldset legend={legend} look="section" action={action} errors={fieldErrors(problems, "level-selections", legend)}>
      <Help>A selection gives options to pick at a level, such as Martial Maneuvers, Fighting Style or Eldritch Invocations. Make the selection first; it is then a type here.</Help>
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <FieldRow key={i} look="list">
            <SelectField
              label="Type"
              name={`Selection ${n} type`}
              value={row[tag("type")]}
              options={choices.selections.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => edit.set(["level-selections", i, "type"], v)}
              placeholder="<select type>"
            />
            <SelectField label="Level" name={`Selection ${n} level`} value={row[tag("level")]} options={LEVELS} onSelect={(v) => edit.set(["level-selections", i, "level"], v)} placeholder="-" />
            <SelectField label="Amount" name={`Selection ${n} amount`} value={row[tag("num")]} options={numbers(range(1, 11))} onSelect={(v) => edit.set(["level-selections", i, "num"], v)} placeholder="-" />
            <XButton aria-label={`Delete selection ${n}`} onClick={() => edit.set(["level-selections"], rows.filter((_, j) => j !== i))} className="ml-auto" />
          </FieldRow>
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
  // An added level stores 1 and a removed level loses its key, as the old level select and its remove button did. The other levels keep their values.
  const setExtraCantrips = (next: number[]) => {
    const map = { ...cantripsKnown };
    for (const level of extraCantrips) if (!next.includes(level)) delete map[intKey(level)];
    for (const level of next) if (!extraCantrips.includes(level)) map[intKey(level)] = 1;
    edit.set(["spellcasting", "cantrips-known"], map);
  };
  // A stored spell that no list has, such as one of a pack that is not enabled, shows as a token with its key, and stays.
  const spellItems = (level: number): PickItem[] =>
    withOthers(
      choices.spells.filter((s) => s.level === level),
      setItems(edit.get("spellcasting", "spell-list", intKey(level)))
        .filter((v): v is string => typeof v === "string")
        .map(untag),
    );
  const maxLevel = factor === 2 ? 5 : factor === 3 ? 4 : 9;

  return (
    <Fieldset legend="Spellcasting" look="section" errors={fieldErrors(problems, "spellcasting", "Spellcasting")}>
      <FieldRow>
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
      </FieldRow>
      {spellcasting && spellcasting[tag("spell-list-kw")] === undefined && (
        <div className="mt-[10px]">
          <FieldRow>
            <SelectField label="Cantrips" value={cantrips} options={YES_NO} onSelect={(v) => edit.set(["spellcasting", "cantrips?"], v)} />
            {cantrips && (
              <>
                <SelectField label="Cantrips known at level 1" value={cantripsKnown[intKey(1)]} options={numbers(range(0, 6))} onSelect={(v) => edit.set(["spellcasting", "cantrips-known", intKey(1)], v)} />
                <Fieldset legend="Extra cantrips at level">
                  <Chips values={extraCantrips} options={range(2, 21)} onValuesChange={setExtraCantrips} addLabel="Add a level" name={(level) => `Level ${level}`} />
                </Fieldset>
              </>
            )}
          </FieldRow>
          <div className="mt-[10px] grid gap-[14px]">
            {range(cantrips ? 0 : 1, maxLevel + 1).map((level) => (
              <Fieldset key={level} legend={level === 0 ? "Cantrips" : `Level ${level} spells`}>
                <SetPicker
                  edit={edit}
                  path={["spellcasting", "spell-list", intKey(level)]}
                  items={spellItems(level)}
                  picker={{ add: level === 0 ? "Add a cantrip" : `Add a ${ordinal(level)}-level spell`, search: true }}
                />
              </Fieldset>
            ))}
          </div>
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
          <RecordTextArea edit={edit} field="help" label="Description" />
          <FieldRow>
            <SelectField label="Hit die" value={edit.get("hit-die")} options={numbers([6, 8, 10, 12])} onSelect={(v) => edit.set(["hit-die"], v)} />
            <SelectField label="Subclass chosen at level" value={edit.get("subclass-level")} options={numbers([1, 2, 3])} onSelect={(v) => edit.set(["subclass-level"], v)} placeholder="-" />
          </FieldRow>
          <TextField edit={edit} problems={problems} field="subclass-title" label="Subclass title, such as Path or Circle" />
          <TextField edit={edit} problems={problems} field="subclass-help" label="Subclass description" />
          <Checks
            legend="Saving throws"
            items={ABILITIES.map(([key, name]) => ({ key: abilityKey(key), name }))}
            checked={(key) => edit.get("profs", "save", key) === true}
            // The old toggle removes the key, not stores false.
            onToggle={(key) => edit.set(["profs", "save", key], edit.get("profs", "save", key) === true ? undefined : true)}
          />
          <Fieldset legend="Ability increase levels" look="section">
            {/* The old toggle stores a sorted vector with no repeats (classes/toggle-ability-increase-level). */}
            <Chips
              values={asiLevels}
              options={range(4, 21)}
              onValuesChange={(next) => edit.set(["ability-increase-levels"], [...new Set(next)].sort((a, b) => a - b))}
              addLabel="Add a level"
              name={(level) => `Level ${level}`}
            />
          </Fieldset>
          <Spellcasting edit={edit} problems={problems} choices={choices} />
          <ChoicePicker edit={edit} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} picker={{ add: "Add a skill option" }} />
          <ChoicePicker edit={edit} legend="Skill Expertise Choice" field="skill-expertise-options" items={SKILLS} picker={{ add: "Add a skill option" }} />
          <LevelModifiers edit={edit} problems={problems} choices={choices} />
          <LevelSelections edit={edit} problems={problems} choices={choices} />
          <Traits edit={edit} problems={problems} levels levelName={String(edit.get("name") ?? "").trim() || "Class"} />
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
