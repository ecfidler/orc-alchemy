// The feat form of the homebrew builder, with the fields of the old app's
// feat builder (views.cljs feat-builder). Each value is stored as the old
// app's events stored it (events.cljs ::feats/...), so an .orcbrew export
// round-trips: :description the text, :prereqs a set of :spellcasting, the
// namespaced ability keywords (13 or higher) and the armor types,
// :path-prereqs {:race {:elf true}}, :ability-increases a set of namespaced
// ability keywords and :saves?, and the modifiers in :props: a number for
// the "n of your choice" and bonus toggles (None removes the key), true for
// each picked sentence (a removed one stores false, as the old second
// click), and a map such as {:armor-prof {:light true}} for the grouped
// ones. The form shows the prerequisites and the ability increase options
// always, and the user adds the other modifiers from a list (modifiers.tsx).
import { Checkbox, Picker } from "@orc-alchemy/ui";
import { asSet, setItems, tag } from "../../engine/content.ts";
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import { ABILITIES, abilityKey, Checks, editor, FormColumn, MapPicker, PickerSection, RecordTextArea, SKILLS, TextField, WithChoices, type BuilderType, type Edit, type FormProps, type Path } from "./fields.tsx";
import { armorModifier, hitPointsModifier, propModifier, RESISTANCE_CHOICES, TOOL_ITEMS, valueModifier } from "./modifier-kinds.tsx";
import { Modifiers, type Modifier } from "./modifiers.tsx";

const ABILITY_CHOICES: Choice[] = ABILITIES.map(([key, name]) => ({ key: abilityKey(key), name }));

const WEAPON_TOGGLES: [string, string][] = [["improvised-weapons-prof", "You gain proficiency with improvised weapons"]];
const MEDIUM_ARMOR: [string, string][] = [
  ["medium-armor-stealth", "Wearing medium armor doesn't give disadvantage on Stealth checks"],
  ["medium-armor-max-dex-3", "When wearing medium armor, you can add 3 to your AC if your Dexterity is 16+"],
];
const MISC: [string, string][] = [
  ["two-weapon-ac-1", "+1 AC Bonus while wielding two melee weapons"],
  ["two-weapon-any-one-handed", "You can use two-weapon fighting with any one-handed melee weapon"],
  ["saving-throw-advantage-traps", "Advantage on saving throws against traps"],
  ["passive-perception-5", "You gain a +5 to your passive Perception"],
  ["passive-investigation-5", "You gain a +5 to your passive Investigation"],
];
const SPELLCASTING: [string, string][] = [
  ["magic-novice", "Choose a class, gain (2) cantrips and (1) 1st-level spell from that class's spell list"],
  ["ritual-casting", "Choose a class, gain (2) 1st-level ritual spells from that class's spell list"],
  ["attack-spell", "Choose a class, gain a cantrip requiring an attack roll from that class's spell list"],
];

/**
 * A modifier of true or false values in :props, one for each sentence, as a
 * picker: each sentence is one token. A pick stores true, and a removed
 * token stores false, as the old second click.
 */
const sentenceModifier = (edit: Edit, id: string, name: string, example: string, add: string, items: [key: string, name: string][]): Modifier => ({
  id,
  name,
  example,
  paths: items.map(([key]) => ["props", key]),
  render: ({ name, action }) => (
    <PickerSection legend={name} action={action}>
      <MapPicker edit={edit} path={["props"]} items={items.map(([key, name]) => ({ key, name }))} text={{ add }} />
    </PickerSection>
  ),
});

const PREREQS: Choice[] = [
  { key: "spellcasting", name: "The ability to cast at least one spell" },
  ...ABILITY_CHOICES.map(({ key, name }) => ({ key, name: `${name} 13 or higher` })),
  ...["light", "medium", "heavy"].map((key) => ({ key, name: `Proficiency with ${key} armor` })),
];
// A race's value in the prerequisite picker. A :prereqs value is a keyword, "~:…", so the two cannot meet.
const RACE = "race ";

/**
 * The prerequisites and the race prerequisites in one picker, with the
 * races at the end of the list. A prerequisite is in the :prereqs set, as
 * SetPicker stores it. A race is {:path-prereqs {:race {:elf true}}}: a pick
 * stores true and a removed token false, as the old checkbox. A change
 * writes only the store that it changes, so a feat without :prereqs gets
 * none from a race pick.
 */
function Prerequisites({ edit, lists, legend }: { edit: Edit; lists: BuilderChoices; legend: string }) {
  const set = setItems(edit.get("prereqs")) as string[];
  const races = (edit.get("path-prereqs", "race") ?? {}) as Record<string, unknown>;
  const picked = Object.keys(races).filter((key) => races[key] === true).map((key) => RACE + key.replace(/^~:/, ""));
  const options = [
    ...PREREQS.map(({ key, name }) => ({ value: tag(key), label: name })),
    ...lists.races.map(({ key, name }) => ({ value: RACE + key, label: `${name} race`, group: "Races" })),
  ];
  const onValueChange = (next: string[]) => {
    const nextSet = next.filter((v) => !v.startsWith(RACE));
    const changes: [Path, unknown][] = [];
    if (nextSet.length !== set.length || nextSet.some((v, i) => v !== set[i])) changes.push([["prereqs"], asSet(nextSet)]);
    for (const v of next) if (v.startsWith(RACE) && !picked.includes(v)) changes.push([["path-prereqs", "race", v.slice(RACE.length)], true]);
    for (const v of picked) if (!next.includes(v)) changes.push([["path-prereqs", "race", v.slice(RACE.length)], false]);
    edit.setAll(changes);
  };
  return (
    <PickerSection legend={legend}>
      <Picker label="Add a prerequisite" options={options} value={[...set, ...picked]} onValueChange={onValueChange} search={options.length > 20} pickedText={(n) => `${n} on the form`} />
    </PickerSection>
  );
}

/** The ability increase options, a set at :ability-increases: a checkbox row of the six abilities, then the saving throw line as one checkbox. */
function AbilityIncreaseOptions({ edit, legend }: { edit: Edit; legend: string }) {
  const set = setItems(edit.get("ability-increases"));
  const has = (key: string) => set.includes(tag(key));
  const toggle = (key: string) => edit.set(["ability-increases"], asSet(has(key) ? set.filter((k) => k !== tag(key)) : [...set, tag(key)]));
  return (
    <Checks legend={legend} row items={ABILITY_CHOICES} checked={has} onToggle={toggle}>
      <Checkbox label="You also gain proficiency in saving throws with the above chosen abilities" checked={has("saves?")} onCheckedChange={() => toggle("saves?")} className="mt-2 items-start [&>.ui-check]:mt-[4px]" />
    </Checks>
  );
}

/** The feat's modifiers in form order (docs/design/homebrew-forms.md, "Feat"). */
function featModifiers(edit: Edit, lists: BuilderChoices): Modifier[] {
  return [
    { id: "prereqs", name: "Prerequisites", common: true, render: ({ name }) => <Prerequisites edit={edit} lists={lists} legend={name} /> },
    { id: "ability-increases", name: "Ability Increase Options", common: true, render: ({ name }) => <AbilityIncreaseOptions edit={edit} legend={name} /> },
    valueModifier(edit, "skill-tool-choice", "Skill or Tool Proficiency", "Proficiency in 1 to 3 skills or tools of choice", [1, 2, 3], "Skills or tools of your choice"),
    valueModifier(edit, "language-choice", "Languages", "Learn 1 to 3 languages of choice", [1, 2, 3], "Languages of your choice"),
    sentenceModifier(edit, "weapon-prof", "Weapon Proficiency", "Proficiency with improvised weapons", "Add a weapon proficiency", WEAPON_TOGGLES),
    valueModifier(edit, "weapon-prof-choice", "Weapon Proficiency Choice", "Proficiency with 3 or 4 weapons of choice", [3, 4], "Weapons of your choice"),
    armorModifier(edit),
    sentenceModifier(edit, "medium-armor", "Medium Armor", "No Stealth disadvantage, +3 Dexterity to AC", "Add a medium armor benefit", MEDIUM_ARMOR),
    hitPointsModifier(edit),
    propModifier(edit, "damage-resistance", "Damage Resistances", "Resistance to fire, cold, damage from traps …", RESISTANCE_CHOICES, { add: "Add a damage resistance" }),
    valueModifier(edit, "speed", "Speed Bonuses", "+5, +10 or +15 ft. speed", [5, 10, 15], "More feet of speed"),
    valueModifier(edit, "initiative", "Initiative Bonuses", "+1 to +5 to initiative", [1, 2, 3, 4, 5], "Bonus to initiative"),
    sentenceModifier(edit, "misc", "Misc. Modifiers", "Two-weapon fighting, +5 passive Perception, traps", "Add a misc. modifier", MISC),
    sentenceModifier(edit, "spellcasting", "Spellcasting", "Cantrips and a 1st-level spell, ritual spells, an attack cantrip", "Add a spellcasting benefit", SPELLCASTING),
    propModifier(edit, "skill-prof-or-expertise", "Skill Proficiency or Expertise", "Proficiency in a skill, or expertise if already proficient", SKILLS, { add: "Add a skill" }),
    propModifier(edit, "tool-prof-or-expertise", "Tool Proficiency or Expertise", "Proficiency with a tool, or expertise if already proficient", TOOL_ITEMS, { add: "Add a tool", search: true }),
  ];
}

function FeatForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <WithChoices>
      {(lists) => (
        <FormColumn>
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <RecordTextArea edit={edit} field="description" label="Description" />
          <Modifiers record={record} onChange={onChange} modifiers={featModifiers(edit, lists)} />
        </FormColumn>
      )}
    </WithChoices>
  );
}

export const featBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/feats",
  validator: "feat",
  one: "feat",
  // The old builder's new feat (db.cljs default-feat) has an empty :prereqs
  // too; it is left out here, and added at the first prerequisite, so an
  // item without prerequisites is stored as the old packs have it.
  empty: { [tag("ability-increases")]: asSet([]) },
  fields: ["name"],
  Form: FeatForm,
};
