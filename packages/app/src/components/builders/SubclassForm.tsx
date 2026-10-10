// The subclass form of the homebrew builder, with the fields of the old
// app's subclass builder (views.cljs subclass-builder). Each value is stored
// as the old app's events stored it, so an .orcbrew export round-trips:
// :class the parent class keyword, :spellcasting {:level-factor 3} for a
// fighter or rogue subclass that casts wizard spells, and :paladin-spells,
// :cleric-spells or :warlock-spells as {spell-level {index spell}}. The skill
// choices, modifiers, selections and traits are as in the class form.
import { intKey, tag, untag } from "../../engine/content.ts";
import { LevelModifiers, LevelSelections } from "./ClassForm.tsx";
import { editor, FieldProblems, ProficiencyChoice, Select, SKILLS, TextField, Traits, WithChoices, YES_NO, type BuilderType, type FormProps } from "./fields.tsx";

/** The parent classes whose subclasses add spells, with the field and its title. */
const CLASS_SPELLS: Record<string, [field: string, title: string]> = {
  paladin: ["paladin-spells", "Spells"],
  cleric: ["cleric-spells", "Domain Spells"],
  warlock: ["warlock-spells", "Expanded Spells"],
};

function SubclassForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const parent = untag(edit.get("class"));
  const spells = CLASS_SPELLS[parent];
  return (
    <WithChoices>
      {(choices) => (
        <div className="space-y-3">
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <div>
            <Select
              label="Class"
              value={edit.get("class")}
              options={choices.classes.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => edit.set(["class"], v)}
              placeholder="<select class>"
            />
            <FieldProblems problems={problems} field="class" label="Class" />
          </div>
          {(parent === "fighter" || parent === "rogue") && (
            <Select
              label="Casts wizard spells"
              value={edit.get("spellcasting") !== undefined}
              options={YES_NO}
              onSelect={(yes) => edit.set(["spellcasting"], yes ? { [tag("level-factor")]: 3 } : undefined)}
            />
          )}
          {spells && (
            // The old subclass spells table: two spells for each spell level from 1 to 5.
            <fieldset>
              <legend className="font-bold">{spells[1]}</legend>
              {[1, 2, 3, 4, 5].map((level) => (
                <div key={level}>
                  {[0, 1].map((i) => (
                    <Select
                      key={i}
                      label={`Level ${level} spell ${i + 1}`}
                      value={edit.get(spells[0], intKey(level), intKey(i))}
                      options={choices.spells.filter((s) => s.level === level).map(({ key, name }) => [tag(key), name])}
                      onSelect={(v) => edit.set([spells[0], intKey(level), intKey(i)], v)}
                      placeholder="<select spell>"
                    />
                  ))}
                </div>
              ))}
            </fieldset>
          )}
          <ProficiencyChoice edit={edit} legend="Skill Proficiency Choice" field="skill-options" items={SKILLS} />
          <ProficiencyChoice edit={edit} legend="Skill Expertise Choice" field="skill-expertise-options" items={SKILLS} />
          <LevelModifiers edit={edit} problems={problems} choices={choices} />
          <LevelSelections edit={edit} problems={problems} choices={choices} />
          <Traits edit={edit} problems={problems} levels />
        </div>
      )}
    </WithChoices>
  );
}

export const subclassBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/subclasses",
  validator: "subclass",
  one: "subclass",
  // The old builder's new subclass (db.cljs default-subclass).
  empty: { [tag("class")]: tag("barbarian"), [tag("traits")]: [], [tag("level-modifiers")]: [] },
  fields: ["name", "class", "level-modifiers", "level-selections", "traits"],
  Form: SubclassForm,
};
