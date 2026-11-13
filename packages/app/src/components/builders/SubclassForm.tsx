// The subclass form of the homebrew builder, with the fields of the old
// app's subclass builder (views.cljs subclass-builder). Each value is stored
// as the old app's events stored it, so an .orcbrew export round-trips:
// :class the parent class keyword, :spellcasting {:level-factor 3} for a
// fighter or rogue subclass that casts wizard spells, and :paladin-spells,
// :cleric-spells or :warlock-spells as {spell-level {index spell}}. The skill
// choices, modifiers, selections and traits are as in the class form. The
// form shows the level modifiers always, and the user adds the skill choices
// and the selections from a list (modifiers.tsx). The spells are a table of
// tokens (docs/design/homebrew-forms.md, "Subclass").
import { AddChip, Field, Fieldset, Label, ListModal, Token, type ListItem } from "@orc-alchemy/ui";
import { useRef, useState } from "react";
import type { BuilderChoices } from "../../engine/builder-choices.ts";
import { intKey, tag, untag } from "../../engine/content.ts";
import { ordinal } from "../CharacterSheet.tsx";
import { LevelModifiers, LevelSelections } from "./ClassForm.tsx";
import { editor, fieldErrors, FormColumn, Help, range, SelectField, SKILLS, TextField, Traits, WithChoices, YES_NO, type BuilderType, type Edit, type FormProps, type Problem } from "./fields.tsx";
import { Modifiers, type Modifier } from "./modifiers.tsx";
import { choiceModifier } from "./modifier-kinds.tsx";

/**
 * The parent classes whose subclasses add spells: the field, its title, and
 * the class levels that give the spells of levels 1 to 5. A warlock has no
 * levels, because a warlock chooses the spells.
 */
const CLASS_SPELLS: Record<string, { field: string; title: string; at?: number[] }> = {
  paladin: { field: "paladin-spells", title: "Spells", at: [3, 5, 9, 13, 17] },
  cleric: { field: "cleric-spells", title: "Domain Spells", at: [1, 3, 5, 7, 9] },
  warlock: { field: "warlock-spells", title: "Expanded Spells" },
};
/** The slots of a row: the stored index and the column heading. */
const SLOTS = [
  { index: 0, name: "First spell" },
  { index: 1, name: "Second spell" },
];
type Slot = { level: number; slot: number };

/**
 * The spells of a paladin, cleric or warlock subclass: one row for each
 * spell level, and two slots in a row, each a token or a "+ Add a spell"
 * button. A pick sets {spell-level {index spell}} and an X removes the
 * index, as the selects did that the table replaces (the old app's
 * classes/set-class-spell, and the clear of this form's select). So a row
 * holds zero, one or two spells, and the second slot can hold a spell
 * while the first is empty. A stored spell that no list has shows its
 * key, and stays. On a screen narrower than 520px the two slots of a row
 * stack.
 */
function SpellsTable({ edit, parent, choices }: { edit: Edit; parent: string; choices: BuilderChoices }) {
  const { field, title, at } = CLASS_SPELLS[parent];
  const parentName = choices.classes.find((c) => c.key === parent)?.name ?? parent;
  // The slot that opened the picker. A pick goes to it, then to the other slot of the row while that is empty.
  const [open, setOpen] = useState<Slot | null>(null);
  const last = useRef<Slot | null>(null);
  const table = useRef<HTMLTableElement>(null);
  const value = (level: number, slot: number) => edit.get(field, intKey(level), intKey(slot));
  const name = (spell: unknown) => choices.spells.find((s) => tag(s.key) === spell)?.name ?? untag(spell);
  const inRow = (level: number) => SLOTS.map(({ index }) => value(level, index)).filter((v) => v !== undefined);
  const items = (level: number): ListItem<string>[] =>
    choices.spells.filter((s) => s.level === level && !inRow(level).includes(tag(s.key))).map((s) => ({ value: tag(s.key), label: s.name }));
  const pick = (spell: string) => {
    if (!open) return;
    const slot = value(open.level, open.slot) === undefined ? open.slot : SLOTS.find(({ index }) => value(open.level, index) === undefined)?.index;
    if (slot === undefined) return;
    edit.set([field, intKey(open.level), intKey(slot)], spell);
    last.current = { level: open.level, slot };
    if (inRow(open.level).length + 1 >= SLOTS.length) setOpen(null);
  };
  // At the close the focus goes to the slot of the last pick, or else back to the slot that was clicked.
  const focusAfter = () => {
    const to = last.current ?? open;
    return to ? (table.current?.querySelector<HTMLElement>(`[data-slot="${to.level}-${to.slot}"] button`) ?? null) : null;
  };
  const head = "whitespace-nowrap pb-1 pr-3 text-left font-normal";
  // The two slot columns share the width, so the spells line up. On a narrow screen the slots stack: block cells go into one anonymous table cell.
  const narrowTop = "max-[519px]:align-top max-[519px]:pt-[10px]";
  return (
    <Fieldset legend={title} look="section">
      <Help>{at ? `A ${parent} of this subclass always has these spells prepared, from the ${parent} level in the first column.` : `A ${parent} of this subclass can choose these spells as ${parent} spells.`}</Help>
      <table ref={table} className="w-full border-collapse">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b border-ink">
            {at && (
              <th scope="col" className={`${head} w-[1%]`}>
                <Label>{parentName} level</Label>
              </th>
            )}
            <th scope="col" className={`${head} w-[1%]`}>
              <Label>Spell level</Label>
            </th>
            {SLOTS.map(({ name: heading }) => (
              <th key={heading} scope="col" className={`${head} w-1/2 last:pr-0 max-[519px]:block max-[519px]:w-auto`}>
                <Label>{heading}</Label>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {range(1, 6).map((level, n) => (
            <tr key={level} className="border-b border-rule">
              {at && <td className={`w-[1%] whitespace-nowrap py-[6px] pr-3 align-middle text-ink-muted ${narrowTop}`}>{ordinal(at[n])}</td>}
              <th scope="row" className={`w-[1%] whitespace-nowrap py-[6px] pr-3 text-left align-middle font-normal ${narrowTop}`}>
                {ordinal(level)}
              </th>
              {SLOTS.map(({ index: slot, name: slotName }) => {
                const spell = value(level, slot);
                return (
                  <td key={slot} data-slot={`${level}-${slot}`} className="py-[6px] pr-3 align-middle last:pr-0 max-[519px]:block max-[519px]:py-[3px]">
                    {spell === undefined ? (
                      <AddChip
                        label="Add a spell"
                        aria-label={`Add a spell: ${ordinal(level)} level, ${slotName.toLowerCase()}`}
                        aria-haspopup="dialog"
                        onClick={() => {
                          last.current = null;
                          setOpen({ level, slot });
                        }}
                      />
                    ) : (
                      <Token label={name(spell)} onRemove={() => edit.set([field, intKey(level), intKey(slot)], undefined)} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ListModal
        open={open !== null}
        onOpenChange={(next) => {
          if (!next) setOpen(null);
        }}
        title={open ? `Add a ${ordinal(open.level)}-level spell` : "Add a spell"}
        items={open ? items(open.level) : []}
        onPick={pick}
        stayOpen
        search
        picked={open ? inRow(open.level).length : 0}
        pickedText={(n) => `${n} of ${SLOTS.length} in this row`}
        finalFocus={focusAfter}
      />
    </Fieldset>
  );
}

/** The subclass's modifiers in form order (docs/design/homebrew-forms.md, "Subclass"). */
function subclassModifiers(edit: Edit, problems: Problem[], choices: BuilderChoices): Modifier[] {
  return [
    choiceModifier(edit, "skill-options", "Skill Proficiency Choice", "Choose n skills from a list", SKILLS, { add: "Add a skill option" }),
    choiceModifier(edit, "skill-expertise-options", "Skill Expertise Choice", "Choose n skills for expertise", SKILLS, { add: "Add a skill option" }),
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
          {Object.hasOwn(CLASS_SPELLS, parent) && <SpellsTable key={parent} edit={edit} parent={parent} choices={choices} />}
          <Modifiers record={record} onChange={onChange} modifiers={subclassModifiers(edit, problems, choices)} />
          <Traits edit={edit} problems={problems} levels levelName={choices.classes.find((c) => c.key === parent)?.name ?? "Class"} />
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
