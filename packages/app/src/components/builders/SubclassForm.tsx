// The subclass form of the homebrew builder, with the fields of the old
// app's subclass builder (views.cljs subclass-builder). Each value is stored
// as the old app's events stored it, so an .orcbrew export round-trips:
// :class the parent class keyword, :spellcasting {:level-factor 3} for a
// fighter or rogue subclass that casts wizard spells, and :paladin-spells,
// :cleric-spells or :warlock-spells as {spell-level {index spell}}. The skill
// choices, modifiers, selections and traits are as in the class form.
import type { ClassChoices } from "../../engine/class-choices.ts";
import { tag, untag } from "../../engine/content.ts";
import { assocIn, intKey, LevelModifiers, LevelSelections, Select, SkillChoice, TextField, Traits, WithChoices } from "./ClassForm.tsx";
import { FieldProblems, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

/** The parent classes whose subclasses add spells, with the field and its title. */
const CLASS_SPELLS: Record<string, [field: string, title: string]> = {
  paladin: ["paladin-spells", "Spells"],
  cleric: ["cleric-spells", "Domain Spells"],
  warlock: ["warlock-spells", "Expanded Spells"],
};

/** The old subclass spells table: two spells for each spell level from 1 to 5. */
function SubclassSpells({ record, onChange, choices, field, legend }: Omit<FormProps, "problems"> & { choices: ClassChoices; field: string; legend: string }) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      {[1, 2, 3, 4, 5].map((level) => (
        <div key={level}>
          {[0, 1].map((i) => (
            <Select
              key={i}
              label={`Level ${level} spell ${i + 1}`}
              value={((record[tag(field)] ?? {}) as Record<string, ItemRecord>)[intKey(level)]?.[intKey(i)]}
              options={choices.spells.filter((s) => s.level === level).map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => onChange(assocIn(record, [tag(field), intKey(level), intKey(i)], v))}
              placeholder="<select spell>"
            />
          ))}
        </div>
      ))}
    </fieldset>
  );
}

function SubclassForm(props: FormProps) {
  const { record, onChange, problems } = props;
  const parent = untag(record[tag("class")]);
  const spells = CLASS_SPELLS[parent];
  return (
    <WithChoices>
      {(choices) => (
        <div className="space-y-3">
          <TextField {...props} field="name" label="Name" />
          <div>
            <Select
              label="Class"
              value={record[tag("class")]}
              options={choices.classes.map(({ key, name }) => [tag(key), name])}
              onSelect={(v) => onChange(assocIn(record, [tag("class")], v))}
              placeholder="<select class>"
            />
            <FieldProblems problems={problems} field="class" label="Class" />
          </div>
          {(parent === "fighter" || parent === "rogue") && (
            <Select
              label="Casts wizard spells"
              value={record[tag("spellcasting")] !== undefined}
              options={[
                [false, "No"],
                [true, "Yes"],
              ]}
              onSelect={(yes) => onChange(assocIn(record, [tag("spellcasting")], yes ? { [tag("level-factor")]: 3 } : undefined))}
            />
          )}
          {spells && <SubclassSpells record={record} onChange={onChange} choices={choices} field={spells[0]} legend={spells[1]} />}
          <SkillChoice record={record} onChange={onChange} field="skill-options" legend="Skill proficiency choice" />
          <SkillChoice record={record} onChange={onChange} field="skill-expertise-options" legend="Skill expertise choice" />
          <LevelModifiers {...props} choices={choices} />
          <LevelSelections {...props} choices={choices} />
          <Traits {...props} />
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
