// The subrace form of the homebrew builder, with the fields of the old app's
// subrace builder (views.cljs subrace-builder). Values are stored as the old
// events stored them (events.cljs ::races/...), as in the race form, with
// :race the parent race's keyword. Size, speed and darkvision show the
// parent race's value until the subrace has its own; the engine applies a
// subrace's speed and darkvision only when they differ from the race's. The
// languages are checkboxes in :props, as {:language {:elvish true}}, and
// :props :max-hp-bonus is 1, 2 or absent. The form shows its common
// modifiers always, and the user adds the other modifiers from a list
// (modifiers.tsx).
import { Field } from "@orc-alchemy/ui";
import type { BuilderChoices, RaceChoice } from "../../engine/builder-choices.ts";
import { tag, untag } from "../../engine/content.ts";
import { editor, fieldErrors, FieldRow, FormColumn, numbers, range, SelectField, SKILLS, TextField, Traits, WithChoices, type BuilderType, type Edit, type FormProps } from "./fields.tsx";
import { valueModifier } from "./FeatForm.tsx";
import { Modifiers, type Modifier } from "./modifiers.tsx";
import {
  AbilityIncreases,
  ARMOR_CHOICES,
  choiceModifier,
  IMMUNITY_CHOICES,
  propModifier,
  RESISTANCE_CHOICES,
  savingThrowChoices,
  SIZES,
  Spells,
  toolModifier,
  weaponChoices,
} from "./RaceForm.tsx";

/** The subrace's modifiers in form order (docs/design/homebrew-forms.md, "Subrace"). race is the parent race, for the totals. */
function subraceModifiers(edit: Edit, lists: BuilderChoices, race: RaceChoice | undefined): Modifier[] {
  return [
    {
      id: "abilities",
      name: "Ability Score Increases",
      common: true,
      render: ({ name }) => (
        <AbilityIncreases
          edit={edit}
          legend={name}
          note={(key, bonus) => {
            const raceBonus = race?.abilities[key] ?? 0;
            return `Race bonus ${raceBonus}, total ${raceBonus + bonus}`;
          }}
        />
      ),
    },
    valueModifier(edit, "max-hp-bonus", "Hit Points", "+1 or +2 hit point maximum for each level", [1, 2], (n) => `Your hit point maximum increases by ${n} for each of your levels`),
    propModifier(edit, "damage-resistance", "Damage Resistances", "Resistance to fire, cold, damage from traps …", RESISTANCE_CHOICES),
    propModifier(edit, "damage-immunity", "Damage Immunities", "Poison, necrotic …", IMMUNITY_CHOICES),
    propModifier(edit, "saving-throw-advantage", "Saving Throw Advantage", "Advantage on saves against being charmed, poisoned …", savingThrowChoices),
    propModifier(edit, "weapon-prof", "Weapon Proficiencies", "Longsword, shortbow, all simple weapons …", weaponChoices(lists)),
    propModifier(edit, "armor-prof", "Armor Proficiency", "Light, medium or heavy armor, shields", ARMOR_CHOICES),
    toolModifier(edit),
    propModifier(edit, "skill-prof", "Skill Proficiencies", "Perception, Stealth …", SKILLS),
    choiceModifier(edit, "skill-options", "Skill Proficiency Choice", "Choose n skills from a list", SKILLS),
    propModifier(edit, "language", "Languages", "Elvish, Undercommon …", lists.languages),
    { id: "spells", name: "Spells", common: true, render: ({ name }) => <Spells edit={edit} lists={lists} legend={name} /> },
  ];
}

function SubraceForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <WithChoices>
      {(lists) => {
        const race = lists.races.find((r) => r.key === untag(edit.get("race")));
        return (
          <FormColumn>
            <TextField edit={edit} problems={problems} field="name" label="Name" />
            <Field label="Race" errors={fieldErrors(problems, "race", "Race")}>
              <SelectField label="Race" value={edit.get("race")} options={lists.races.map((r) => [tag(r.key), r.name])} onSelect={(v) => edit.set(["race"], v)} />
            </Field>
            <FieldRow>
              <SelectField label="Size" value={edit.get("size") ?? (race?.size && tag(race.size))} options={SIZES.map((s) => [tag(s), s])} onSelect={(v) => edit.set(["size"], v)} />
              <SelectField label="Speed" value={edit.get("speed") ?? race?.speed} options={numbers(range(5, 55, 5))} onSelect={(v) => edit.set(["speed"], v)} />
              <SelectField label="Darkvision" value={edit.get("darkvision") ?? race?.darkvision} options={numbers([0, 60, 120])} onSelect={(v) => edit.set(["darkvision"], v)} />
            </FieldRow>
            <Modifiers record={record} onChange={onChange} modifiers={subraceModifiers(edit, lists, race)} />
            <Traits edit={edit} />
          </FormColumn>
        );
      }}
    </WithChoices>
  );
}

export const subraceBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/subraces",
  validator: "subrace",
  one: "subrace",
  // The old builder's new subrace (db.cljs default-subrace).
  empty: { [tag("race")]: tag("dwarf"), [tag("traits")]: [] },
  fields: ["name", "race"],
  Form: SubraceForm,
};
