// The subclass form of the homebrew builder, with the fields of the old
// app's subclass builder (views.cljs subclass-builder). Each value is stored
// as the old app's events stored it, so an .orcbrew export round-trips:
// :class the parent class keyword, :spellcasting {:level-factor 3} for a
// fighter or rogue subclass that casts wizard spells, and :paladin-spells,
// :cleric-spells or :warlock-spells as {spell-level {index spell}}. The skill
// choices, modifiers, selections and traits are as in the class form. The
// form shows the level modifiers always, and the user adds the skill choices
// and the selections from a list (modifiers.tsx).
import { Field, Fieldset } from "@orc-alchemy/ui";
import type { BuilderChoices } from "../../engine/builder-choices.ts";
import { intKey, tag, untag } from "../../engine/content.ts";
import { LevelModifiers, LevelSelections } from "./ClassForm.tsx";
import { editor, fieldErrors, FieldRow, FormColumn, SelectField, SKILLS, TextField, Traits, WithChoices, YES_NO, type BuilderType, type Edit, type FormProps, type Problem } from "./fields.tsx";
import { Modifiers, type Modifier } from "./modifiers.tsx";
import { choiceModifier } from "./RaceForm.tsx";

/** The parent classes whose subclasses add spells, with the field and its title. */
const CLASS_SPELLS: Record<string, [field: string, title: string]> = {
  paladin: ["paladin-spells", "Spells"],
  cleric: ["cleric-spells", "Domain Spells"],
  warlock: ["warlock-spells", "Expanded Spells"],
};

/** The subclass's modifiers in form order (docs/design/homebrew-forms.md, "Subclass"). */
function subclassModifiers(edit: Edit, problems: Problem[], choices: BuilderChoices): Modifier[] {
  return [
    choiceModifier(edit, "skill-options", "Skill Proficiency Choice", "Choose n skills from a list", SKILLS),
    choiceModifier(edit, "skill-expertise-options", "Skill Expertise Choice", "Choose n skills for expertise", SKILLS),
    { id: "level-modifiers", name: "Modifiers", common: true, render: ({ name }) => <LevelModifiers edit={edit} problems={problems} choices={choices} legend={name} /> },
    {
      id: "level-selections",
      name: "Selections",
      example: "Options to pick at a level, such as Martial Maneuvers",
      paths: [["level-selections"]],
      render: ({ name, action }) => <LevelSelections edit={edit} problems={problems} choices={choices} legend={name} action={action} />,
    },
  ];
}

function SubclassForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const parent = untag(edit.get("class"));
  const spells = CLASS_SPELLS[parent];
  return (
    <WithChoices>
      {(choices) => (
        <FormColumn>
          <TextField edit={edit} problems={problems} field="name" label="Name" />
          <Field label="Class" errors={fieldErrors(problems, "class", "Class")}>
            <SelectField
              label="Class"
              value={edit.get("class")}
              options={choices.classes.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => edit.set(["class"], v)}
              placeholder="<select class>"
            />
          </Field>
          {(parent === "fighter" || parent === "rogue") && (
            <SelectField
              label="Casts wizard spells"
              value={edit.get("spellcasting") !== undefined}
              options={YES_NO}
              onSelect={(yes) => edit.set(["spellcasting"], yes ? { [tag("level-factor")]: 3 } : undefined)}
            />
          )}
          {spells && (
            // The old subclass spells table: two spells for each spell level from 1 to 5.
            <Fieldset legend={spells[1]} look="section">
              <div className="grid gap-[10px]">
                {[1, 2, 3, 4, 5].map((level) => (
                  <FieldRow key={level}>
                    {[0, 1].map((i) => (
                      <SelectField
                        key={i}
                        label={`Level ${level} spell ${i + 1}`}
                        value={edit.get(spells[0], intKey(level), intKey(i))}
                        options={choices.spells.filter((s) => s.level === level).map(({ key, name }) => [tag(key), name])}
                        onSelect={(v) => edit.set([spells[0], intKey(level), intKey(i)], v)}
                        placeholder="<select spell>"
                      />
                    ))}
                  </FieldRow>
                ))}
              </div>
            </Fieldset>
          )}
          <Modifiers record={record} onChange={onChange} modifiers={subclassModifiers(edit, problems, choices)} />
          <Traits edit={edit} problems={problems} levels />
        </FormColumn>
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
