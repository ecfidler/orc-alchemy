// The feat form of the homebrew builder, with the fields of the old app's
// feat builder (views.cljs feat-builder). Each value is stored as the old
// app's events stored it (events.cljs ::feats/...), so an .orcbrew export
// round-trips: :description the text, :prereqs a set of :spellcasting, the
// namespaced ability keywords (13 or higher) and the armor types,
// :path-prereqs {:race {:elf true}}, :ability-increases a set of namespaced
// ability keywords and :saves?, and the modifiers in :props: a number for
// the "n of your choice" and bonus checkboxes (a second click removes the
// key), true for the other checkboxes (a second click stores false), and a
// map such as {:armor-prof {:light true}} for the grouped ones.
import { asSet, setItems, tag } from "../../engine/content.ts";
import { ABILITIES, abilityKey, Checks, editor, SKILLS, TextArea, TextField, TOOLS, ValueChecks, WithChoices, type BuilderType, type Edit, type FormProps } from "./fields.tsx";
import type { Choice } from "../../engine/builder-choices.ts";
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
function Toggles({ edit, legend, items }: { edit: Edit; legend: string; items: [key: string, name: string][] }) {
  return (
    <Checks legend={legend} items={items.map(([key, name]) => ({ key, name }))} checked={(key) => edit.get("props", key) === true} onToggle={(key) => edit.toggle(["props", key])} />
  );
}

const ABILITY_CHOICES: Choice[] = ABILITIES.map(([key, name]) => ({ key: abilityKey(key), name }));

function FeatForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <WithChoices>
      {(lists) => (
        <div className="space-y-3">
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <TextArea edit={edit} field="description" label="Description" />
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
          <Checks
            legend="Race prerequisites"
            items={lists.races.map(({ key, name }) => ({ key, name: `${name} race` }))}
            checked={(key) => edit.get("path-prereqs", "race", key) === true}
            onToggle={(key) => edit.toggle(["path-prereqs", "race", key])}
          />
          <h2 className="font-bold">Modifiers</h2>
          <SetChecks
            edit={edit}
            legend="Ability Increase Options"
            field="ability-increases"
            items={[...ABILITY_CHOICES, { key: "saves?", name: "You also gain proficiency in saving throws with the above chosen abilities" }]}
          />
          <ValueChecks edit={edit} legend="Skill or Tool Proficiency" path={["props", "skill-tool-choice"]} values={[1, 2, 3]} name={(n) => `You gain proficiency in ${n} skills or tools of your choice`} />
          <ValueChecks edit={edit} legend="Languages" path={["props", "language-choice"]} values={[1, 2, 3]} name={(n) => `You learn ${n} languages of your choice.`} />
          <Toggles edit={edit} legend="Weapon Proficiency" items={[["improvised-weapons-prof", "You gain proficiency with improvised weapons"]]} />
          <ValueChecks edit={edit} legend="Weapon Proficiency Choice" path={["props", "weapon-prof-choice"]} values={[3, 4]} name={(n) => `You gain proficiency with ${n} weapons of your choice`} />
          <ArmorChecks edit={edit} />
          <Toggles
            edit={edit}
            legend="Medium Armor"
            items={[
              ["medium-armor-stealth", "Wearing medium armor doesn't give disadvantage on Stealth checks"],
              ["medium-armor-max-dex-3", "When wearing medium armor, you can add 3 to your AC if your Dexterity is 16+"],
            ]}
          />
          <ValueChecks edit={edit} legend="Hit Points" path={["props", "max-hp-bonus"]} values={[1, 2]} name={(n) => `Your hit point maximum increases by ${n} for each of your levels`} />
          <ResistanceChecks edit={edit} />
          <ValueChecks edit={edit} legend="Speed Bonuses" path={["props", "speed"]} values={[5, 10, 15]} name={(n) => `Your speed is increased by ${n} ft.`} />
          <ValueChecks edit={edit} legend="Initiative Bonuses" path={["props", "initiative"]} values={[1, 2, 3, 4, 5]} name={(n) => `You gain a +${n} bonus to initiative`} />
          <Toggles
            edit={edit}
            legend="Misc. Modifiers"
            items={[
              ["two-weapon-ac-1", "+1 AC Bonus while wielding two melee weapons"],
              ["two-weapon-any-one-handed", "You can use two-weapon fighting with any one-handed melee weapon"],
              ["saving-throw-advantage-traps", "Advantage on saving throws against traps"],
              ["passive-perception-5", "You gain a +5 to your passive Perception"],
              ["passive-investigation-5", "You gain a +5 to your passive Investigation"],
            ]}
          />
          <Toggles
            edit={edit}
            legend="Spellcasting"
            items={[
              ["magic-novice", "Choose a class, gain (2) cantrips and (1) 1st-level spell from that class's spell list"],
              ["ritual-casting", "Choose a class, gain (2) 1st-level ritual spells from that class's spell list"],
              ["attack-spell", "Choose a class, gain a cantrip requiring an attack roll from that class's spell list"],
            ]}
          />
          <PropChecks edit={edit} legend="Skill Proficiency or Expertise" prop="skill-prof-or-expertise" items={SKILLS} />
          <PropChecks edit={edit} legend="Tool Proficiency or Expertise" prop="tool-prof-or-expertise" items={TOOLS} />
        </div>
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
