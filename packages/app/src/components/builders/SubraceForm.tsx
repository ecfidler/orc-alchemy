// The subrace form of the homebrew builder, with the fields of the old app's
// subrace builder (views.cljs subrace-builder). Values are stored as the old
// events stored them (events.cljs ::races/...), as in the race form, with
// :race the parent race's keyword. Size, speed and darkvision show the
// parent race's value until the subrace has its own; the engine applies a
// subrace's speed and darkvision only when they differ from the race's. The
// languages are checkboxes in :props, as {:language {:elvish true}}, and
// :props :max-hp-bonus is 1, 2 or absent.
import { tag, untag } from "../../engine/content.ts";
import {
  ABILITIES,
  abilityKey,
  Checks,
  editor,
  FieldProblems,
  numbers,
  ProficiencyChoice,
  range,
  Select,
  SKILLS,
  TextField,
  Traits,
  WithChoices,
  type BuilderType,
  type FormProps,
} from "./fields.tsx";
import { ArmorChecks, BONUSES, ImmunityChecks, PropChecks, ResistanceChecks, savingThrowChoices, SIZES, SkillChecks, Spells, ToolChecks, weaponChoices } from "./RaceForm.tsx";

function SubraceForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  return (
    <WithChoices>
      {(lists) => {
        const race = lists.races.find((r) => r.key === untag(edit.get("race")));
        const hpBonus = edit.get("props", "max-hp-bonus");
        return (
          <div className="space-y-3">
            <TextField edit={edit} problems={problems} field="name" label="Name" />
            <div>
              <Select label="Race" value={edit.get("race")} options={lists.races.map((r) => [tag(r.key), r.name])} onSelect={(v) => edit.set(["race"], v)} />
              <FieldProblems problems={problems} field="race" label="Race" />
            </div>
            <div>
              <Select label="Size" value={edit.get("size") ?? (race?.size && tag(race.size))} options={SIZES.map((s) => [tag(s), s])} onSelect={(v) => edit.set(["size"], v)} />
              <Select label="Speed" value={edit.get("speed") ?? race?.speed} options={numbers(range(5, 55, 5))} onSelect={(v) => edit.set(["speed"], v)} />
              <Select label="Darkvision" value={edit.get("darkvision") ?? race?.darkvision} options={numbers([0, 60, 120])} onSelect={(v) => edit.set(["darkvision"], v)} />
            </div>
            <fieldset>
              <legend className="font-bold">Ability Score Increases</legend>
              {ABILITIES.map(([key, name]) => {
                const raceBonus = race?.abilities[key] ?? 0;
                const bonus = (edit.get("abilities", abilityKey(key)) as number | undefined) ?? 0;
                return (
                  <div key={key}>
                    <Select label={name} value={bonus} options={BONUSES} onSelect={(v) => edit.set(["abilities", abilityKey(key)], v)} />
                    <span>
                      Race bonus {raceBonus}, total {raceBonus + bonus}
                    </span>
                  </div>
                );
              })}
            </fieldset>
            <Checks
              legend="Hit Points"
              items={[1, 2].map((n) => ({ key: String(n), name: `Your hit point maximum increases by ${n} for each of your levels` }))}
              checked={(key) => hpBonus === Number(key)}
              onToggle={(key) => edit.set(["props", "max-hp-bonus"], hpBonus === Number(key) ? undefined : Number(key))}
            />
            <ResistanceChecks edit={edit} />
            <ImmunityChecks edit={edit} />
            <PropChecks edit={edit} legend="Saving Throw Advantage" prop="saving-throw-advantage" items={savingThrowChoices} />
            <PropChecks edit={edit} legend="Weapon Proficiencies" prop="weapon-prof" items={weaponChoices(lists)} />
            <ArmorChecks edit={edit} />
            <ToolChecks edit={edit} />
            <SkillChecks edit={edit} />
            <ProficiencyChoice edit={edit} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
            <PropChecks edit={edit} legend="Languages" prop="language" items={lists.languages} />
            <Spells edit={edit} lists={lists} />
            <Traits edit={edit} />
          </div>
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
