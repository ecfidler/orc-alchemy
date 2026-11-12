// The feat form of the homebrew builder, with the fields of the old app's
// feat builder (views.cljs feat-builder). Each value is stored as the old
// app's events stored it (events.cljs ::feats/...), so an .orcbrew export
// round-trips: :description the text, :prereqs a set of :spellcasting, the
// namespaced ability keywords (13 or higher) and the armor types,
// :path-prereqs {:race {:elf true}}, :ability-increases a set of namespaced
// ability keywords and :saves?, and the modifiers in :props: a number for
// the "n of your choice" and bonus checkboxes (a second click removes the
// key), true for the other checkboxes (a second click stores false), and a
// map such as {:armor-prof {:light true}} for the grouped ones. The form
// shows the prerequisites and the ability increase options always, and the
// user adds the other modifiers from a list (modifiers.tsx).
import type { ReactNode } from "react";
import { asSet, setItems, tag } from "../../engine/content.ts";
import { ABILITIES, abilityKey, Checks, editor, FormColumn, RecordTextArea, SKILLS, TextField, TOOLS, ValueChecks, WithChoices, type BuilderType, type Edit, type FormProps } from "./fields.tsx";
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import { Modifiers, type Modifier } from "./modifiers.tsx";
import { ARMOR_CHOICES, propModifier, RESISTANCE_CHOICES } from "./RaceForm.tsx";

/** Checkboxes of the set at field: a click adds the item's keyword, and a second click removes it. */
function SetChecks({ edit, legend, field, items }: { edit: Edit; legend: string; field: string; items: Choice[] }) {
  const set = setItems(edit.get(field));
  return (
    <Checks
      legend={legend}
      items={items}
      checked={(key) => set.includes(tag(key))}
      onToggle={(key) => edit.set([field], asSet(set.includes(tag(key)) ? set.filter((k) => k !== tag(key)) : [...set, tag(key)]))}
    />
  );
}

/** Checkboxes of true or false values in :props. */
function Toggles({ edit, legend, items, action }: { edit: Edit; legend: string; items: [key: string, name: string][]; action?: ReactNode }) {
  return (
    <Checks
      legend={legend}
      action={action}
      items={items.map(([key, name]) => ({ key, name }))}
      checked={(key) => edit.get("props", key) === true}
      onToggle={(key) => edit.toggle(["props", key])}
    />
  );
}

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

/** A modifier of one number at :props prop: a click on a box stores its number. */
export const valueModifier = (edit: Edit, prop: string, name: string, example: string, values: number[], text: (n: number) => string): Modifier => ({
  id: prop,
  name,
  example,
  paths: [["props", prop]],
  render: ({ name, action }) => <ValueChecks edit={edit} legend={name} action={action} path={["props", prop]} values={values} name={text} />,
});

/** A modifier of true or false values in :props, one for each item. */
const toggleModifier = (edit: Edit, id: string, name: string, example: string, items: [key: string, name: string][]): Modifier => ({
  id,
  name,
  example,
  paths: items.map(([key]) => ["props", key]),
  render: ({ name, action }) => <Toggles edit={edit} legend={name} action={action} items={items} />,
});

/** The feat's modifiers in form order (docs/design/homebrew-forms.md, "Feat"). */
function featModifiers(edit: Edit, lists: BuilderChoices): Modifier[] {
  return [
    {
      id: "prereqs",
      name: "Prerequisites",
      common: true,
      render: ({ name }) => (
        <SetChecks
          edit={edit}
          legend={name}
          field="prereqs"
          items={[
            { key: "spellcasting", name: "The ability to cast at least one spell" },
            ...ABILITY_CHOICES.map(({ key, name }) => ({ key, name: `${name} 13 or higher` })),
            ...["light", "medium", "heavy"].map((key) => ({ key, name: `Proficiency with ${key} armor` })),
          ]}
        />
      ),
    },
    {
      id: "race-prereqs",
      name: "Race prerequisites",
      common: true,
      render: ({ name }) => (
        <Checks
          legend={name}
          items={lists.races.map(({ key, name }) => ({ key, name: `${name} race` }))}
          checked={(key) => edit.get("path-prereqs", "race", key) === true}
          onToggle={(key) => edit.toggle(["path-prereqs", "race", key])}
        />
      ),
    },
    {
      id: "ability-increases",
      name: "Ability Increase Options",
      common: true,
      render: ({ name }) => (
        <SetChecks
          edit={edit}
          legend={name}
          field="ability-increases"
          items={[...ABILITY_CHOICES, { key: "saves?", name: "You also gain proficiency in saving throws with the above chosen abilities" }]}
        />
      ),
    },
    valueModifier(edit, "skill-tool-choice", "Skill or Tool Proficiency", "Proficiency in 1 to 3 skills or tools of choice", [1, 2, 3], (n) => `You gain proficiency in ${n} skills or tools of your choice`),
    valueModifier(edit, "language-choice", "Languages", "Learn 1 to 3 languages of choice", [1, 2, 3], (n) => `You learn ${n} languages of your choice.`),
    toggleModifier(edit, "weapon-prof", "Weapon Proficiency", "Proficiency with improvised weapons", WEAPON_TOGGLES),
    valueModifier(edit, "weapon-prof-choice", "Weapon Proficiency Choice", "Proficiency with 3 or 4 weapons of choice", [3, 4], (n) => `You gain proficiency with ${n} weapons of your choice`),
    propModifier(edit, "armor-prof", "Armor Proficiency", "Light, medium or heavy armor, shields", ARMOR_CHOICES),
    toggleModifier(edit, "medium-armor", "Medium Armor", "No Stealth disadvantage, +3 Dexterity to AC", MEDIUM_ARMOR),
    valueModifier(edit, "max-hp-bonus", "Hit Points", "+1 or +2 hit point maximum for each level", [1, 2], (n) => `Your hit point maximum increases by ${n} for each of your levels`),
    propModifier(edit, "damage-resistance", "Damage Resistances", "Resistance to fire, cold, damage from traps …", RESISTANCE_CHOICES),
    valueModifier(edit, "speed", "Speed Bonuses", "+5, +10 or +15 ft. speed", [5, 10, 15], (n) => `Your speed is increased by ${n} ft.`),
    valueModifier(edit, "initiative", "Initiative Bonuses", "+1 to +5 to initiative", [1, 2, 3, 4, 5], (n) => `You gain a +${n} bonus to initiative`),
    toggleModifier(edit, "misc", "Misc. Modifiers", "Two-weapon fighting, +5 passive Perception, traps", MISC),
    toggleModifier(edit, "spellcasting", "Spellcasting", "Cantrips and a 1st-level spell, ritual spells, an attack cantrip", SPELLCASTING),
    propModifier(edit, "skill-prof-or-expertise", "Skill Proficiency or Expertise", "Proficiency in a skill, or expertise if already proficient", SKILLS),
    propModifier(edit, "tool-prof-or-expertise", "Tool Proficiency or Expertise", "Proficiency with a tool, or expertise if already proficient", TOOLS),
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
