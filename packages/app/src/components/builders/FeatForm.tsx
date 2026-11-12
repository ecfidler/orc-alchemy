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
import { ABILITIES, abilityKey, Checks, editor, FormColumn, RecordTextArea, SKILLS, TextField, TOOLS, ValueChecks, WithChoices, type BuilderType, type Edit, type FormProps, type Path } from "./fields.tsx";
import type { BuilderChoices, Choice } from "../../engine/builder-choices.ts";
import { Modifiers, type Modifier } from "./modifiers.tsx";
import { ArmorChecks, PropChecks, ResistanceChecks } from "./RaceForm.tsx";

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

/** The paths of the keys in :props. */
const inProps = (...keys: string[]): Path[] => keys.map((key) => ["props", key]);

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

/** The feat's modifiers in form order (docs/design/homebrew-forms.md, "Feat"). */
function featModifiers(edit: Edit, lists: BuilderChoices): Modifier[] {
  return [
    {
      id: "prereqs",
      name: "Prerequisites",
      common: true,
      render: () => (
        <SetChecks
          edit={edit}
          legend="Prerequisites"
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
      render: () => (
        <Checks
          legend="Race prerequisites"
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
      render: () => (
        <SetChecks
          edit={edit}
          legend="Ability Increase Options"
          field="ability-increases"
          items={[...ABILITY_CHOICES, { key: "saves?", name: "You also gain proficiency in saving throws with the above chosen abilities" }]}
        />
      ),
    },
    {
      id: "skill-tool-choice",
      name: "Skill or Tool Proficiency",
      example: "Proficiency in 1 to 3 skills or tools of choice",
      paths: inProps("skill-tool-choice"),
      render: (action) => (
        <ValueChecks edit={edit} legend="Skill or Tool Proficiency" action={action} path={["props", "skill-tool-choice"]} values={[1, 2, 3]} name={(n) => `You gain proficiency in ${n} skills or tools of your choice`} />
      ),
    },
    {
      id: "language-choice",
      name: "Languages",
      example: "Learn 1 to 3 languages of choice",
      paths: inProps("language-choice"),
      render: (action) => <ValueChecks edit={edit} legend="Languages" action={action} path={["props", "language-choice"]} values={[1, 2, 3]} name={(n) => `You learn ${n} languages of your choice.`} />,
    },
    {
      id: "weapon-prof",
      name: "Weapon Proficiency",
      example: "Proficiency with improvised weapons",
      paths: inProps(...WEAPON_TOGGLES.map(([key]) => key)),
      render: (action) => <Toggles edit={edit} legend="Weapon Proficiency" action={action} items={WEAPON_TOGGLES} />,
    },
    {
      id: "weapon-prof-choice",
      name: "Weapon Proficiency Choice",
      example: "Proficiency with 3 or 4 weapons of choice",
      paths: inProps("weapon-prof-choice"),
      render: (action) => (
        <ValueChecks edit={edit} legend="Weapon Proficiency Choice" action={action} path={["props", "weapon-prof-choice"]} values={[3, 4]} name={(n) => `You gain proficiency with ${n} weapons of your choice`} />
      ),
    },
    { id: "armor-prof", name: "Armor Proficiency", example: "Light, medium or heavy armor, shields", paths: inProps("armor-prof"), render: (action) => <ArmorChecks edit={edit} action={action} /> },
    {
      id: "medium-armor",
      name: "Medium Armor",
      example: "No Stealth disadvantage, +3 Dexterity to AC",
      paths: inProps(...MEDIUM_ARMOR.map(([key]) => key)),
      render: (action) => <Toggles edit={edit} legend="Medium Armor" action={action} items={MEDIUM_ARMOR} />,
    },
    {
      id: "max-hp-bonus",
      name: "Hit Points",
      example: "+1 or +2 hit point maximum for each level",
      paths: inProps("max-hp-bonus"),
      render: (action) => (
        <ValueChecks edit={edit} legend="Hit Points" action={action} path={["props", "max-hp-bonus"]} values={[1, 2]} name={(n) => `Your hit point maximum increases by ${n} for each of your levels`} />
      ),
    },
    {
      id: "damage-resistance",
      name: "Damage Resistances",
      example: "Resistance to fire, cold, damage from traps …",
      paths: inProps("damage-resistance"),
      render: (action) => <ResistanceChecks edit={edit} action={action} />,
    },
    {
      id: "speed",
      name: "Speed Bonuses",
      example: "+5, +10 or +15 ft. speed",
      paths: inProps("speed"),
      render: (action) => <ValueChecks edit={edit} legend="Speed Bonuses" action={action} path={["props", "speed"]} values={[5, 10, 15]} name={(n) => `Your speed is increased by ${n} ft.`} />,
    },
    {
      id: "initiative",
      name: "Initiative Bonuses",
      example: "+1 to +5 to initiative",
      paths: inProps("initiative"),
      render: (action) => (
        <ValueChecks edit={edit} legend="Initiative Bonuses" action={action} path={["props", "initiative"]} values={[1, 2, 3, 4, 5]} name={(n) => `You gain a +${n} bonus to initiative`} />
      ),
    },
    {
      id: "misc",
      name: "Misc. Modifiers",
      example: "Two-weapon fighting, +5 passive Perception, traps",
      paths: inProps(...MISC.map(([key]) => key)),
      render: (action) => <Toggles edit={edit} legend="Misc. Modifiers" action={action} items={MISC} />,
    },
    {
      id: "spellcasting",
      name: "Spellcasting",
      example: "Cantrips and a 1st-level spell, ritual spells, an attack cantrip",
      paths: inProps(...SPELLCASTING.map(([key]) => key)),
      render: (action) => <Toggles edit={edit} legend="Spellcasting" action={action} items={SPELLCASTING} />,
    },
    {
      id: "skill-prof-or-expertise",
      name: "Skill Proficiency or Expertise",
      example: "Proficiency in a skill, or expertise if already proficient",
      paths: inProps("skill-prof-or-expertise"),
      render: (action) => <PropChecks edit={edit} legend="Skill Proficiency or Expertise" action={action} prop="skill-prof-or-expertise" items={SKILLS} />,
    },
    {
      id: "tool-prof-or-expertise",
      name: "Tool Proficiency or Expertise",
      example: "Proficiency with a tool, or expertise if already proficient",
      paths: inProps("tool-prof-or-expertise"),
      render: (action) => <PropChecks edit={edit} legend="Tool Proficiency or Expertise" action={action} prop="tool-prof-or-expertise" items={TOOLS} />,
    },
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
