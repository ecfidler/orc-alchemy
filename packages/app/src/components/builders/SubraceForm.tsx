// The subrace form of the homebrew builder, with the fields of the old app's
// subrace builder (views.cljs subrace-builder). Values are stored as the old
// events stored them (events.cljs ::races/...), as in the race form, with
// :race the parent race's keyword. Size, speed and darkvision show the
// parent race's value until the subrace has its own; the engine applies a
// subrace's speed and darkvision only when they differ from the race's. The
// languages are checkboxes in :props, as {:language {:elvish true}}, and
// :props :max-hp-bonus is 1, 2 or absent.
import { tag, untag } from "../../engine/content.ts";
import { FieldProblems, type BuilderType, type FormProps } from "./fields.tsx";
import {
  ABILITIES,
  abilityKey,
  ArmorChecks,
  BONUSES,
  edit,
  ImmunityChecks,
  NameField,
  numbers,
  ProficiencyChoice,
  PropChecks,
  range,
  ResistanceChecks,
  savingThrowChoices,
  Select,
  SIZES,
  SkillChecks,
  SKILLS,
  Spells,
  ToolChecks,
  Traits,
  weaponChoices,
  WithChoices,
  Checks,
} from "./RaceForm.tsx";

function SubraceForm({ record, onChange, problems }: FormProps) {
  const e = edit(record, onChange);
  return (
    <WithChoices>
      {(lists) => {
        const race = lists.races.find((r) => r.key === untag(e.get("race")));
        const hpBonus = e.get("props", "max-hp-bonus");
        return (
          <div className="space-y-3">
            <NameField e={e} problems={problems} />
            <div>
              <Select label="Race" value={e.get("race")} options={lists.races.map((r) => [tag(r.key), r.name])} onChange={(v) => e.set(["race"], v)} />
              <FieldProblems problems={problems} field="race" label="Race" />
            </div>
            <div>
              <Select label="Size" value={e.get("size") ?? (race?.size && tag(race.size))} options={SIZES.map((s) => [tag(s), s])} onChange={(v) => e.set(["size"], v)} />
              <Select label="Speed" value={e.get("speed") ?? race?.speed} options={numbers(range(5, 55, 5))} onChange={(v) => e.set(["speed"], Number(v))} />
              <Select label="Darkvision" value={e.get("darkvision") ?? race?.darkvision} options={numbers([0, 60, 120])} onChange={(v) => e.set(["darkvision"], Number(v))} />
            </div>
            <fieldset>
              <legend className="font-bold">Ability Score Increases</legend>
              {ABILITIES.map(([key, name]) => {
                const raceBonus = race?.abilities[key] ?? 0;
                const bonus = (e.get("abilities", abilityKey(key)) as number | undefined) ?? 0;
                return (
                  <div key={key}>
                    <Select label={name} value={bonus} options={BONUSES} onChange={(v) => e.set(["abilities", abilityKey(key)], Number(v))} />
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
              onToggle={(key) => e.set(["props", "max-hp-bonus"], hpBonus === Number(key) ? undefined : Number(key))}
            />
            <ResistanceChecks e={e} />
            <ImmunityChecks e={e} />
            <PropChecks e={e} legend="Saving Throw Advantage" prop="saving-throw-advantage" items={savingThrowChoices} />
            <PropChecks e={e} legend="Weapon Proficiencies" prop="weapon-prof" items={weaponChoices(lists)} />
            <ArmorChecks e={e} />
            <ToolChecks e={e} />
            <SkillChecks e={e} />
            <ProficiencyChoice e={e} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
            <PropChecks e={e} legend="Languages" prop="language" items={lists.languages} />
            <Spells e={e} lists={lists} />
            <Traits e={e} />
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
