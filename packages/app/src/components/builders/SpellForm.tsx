// The spell form of the homebrew builder, with the fields of the old app's
// spell builder (views.cljs spell-builder). Each value is stored as the old
// app's events stored it (events.cljs ::spells/...), so an .orcbrew export
// round-trips: :level an integer, :school a string, :ritual and
// :attack-roll? booleans, :components a map of :verbal, :somatic and
// :material booleans and the :material-component text, and :spell-lists a
// map of class keyword to true or false.
import { Checkbox, Field, Fieldset } from "@orc-alchemy/ui";
import { tag } from "../../engine/content.ts";
import { fieldErrors, title, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

const SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"];
/** The old builder's spellcasting classes. */
const CLASSES = ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"];
const COMPONENTS = ["verbal", "somatic", "material"];

const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function SpellForm({ record, onChange, problems }: FormProps) {
  const set = (field: string, value: unknown) => onChange({ ...record, [tag(field)]: value });
  const components = (record[tag("components")] ?? {}) as ItemRecord;
  const lists = (record[tag("spell-lists")] ?? {}) as ItemRecord;
  const text = (field: string, label: string) => (
    <Field label={label} errors={fieldErrors(problems, field, label)}>
      <label className="block">
        {label}{" "}
        <input type="text" value={String(record[tag(field)] ?? "")} onChange={(e) => set(field, e.target.value)} className="border border-black px-1" />
      </label>
    </Field>
  );
  const checkbox = (field: string, label: string) => (
    <Checkbox label={label} checked={record[tag(field)] === true} onCheckedChange={(on) => set(field, on)} className="flex" />
  );

  return (
    <div className="space-y-3">
      {text("name", "Name")}
      <Field label="Level" errors={fieldErrors(problems, "level", "Level")}>
        <label className="block">
          Level{" "}
          <select value={String(record[tag("level")] ?? "")} onChange={(e) => set("level", parseInt(e.target.value, 10))} className="border border-black">
            {Array.from({ length: 10 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? "Cantrip" : `${ordinal(n)}-level`}
              </option>
            ))}
          </select>
        </label>
      </Field>
      <Field label="School" errors={fieldErrors(problems, "school", "School")}>
        <label className="block">
          School{" "}
          <select value={String(record[tag("school")] ?? "")} onChange={(e) => set("school", e.target.value)} className="border border-black">
            {SCHOOLS.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </label>
      </Field>
      {checkbox("ritual", "Ritual")}
      {checkbox("attack-roll?", "Requires an attack roll")}
      {text("casting-time", "Casting time")}
      {text("range", "Range")}
      <Fieldset legend="Components" errors={fieldErrors(problems, "components", "Components")}>
        {COMPONENTS.map((component) => (
          <Checkbox
            key={component}
            label={title(component)}
            checked={components[tag(component)] === true}
            onCheckedChange={(on) => set("components", { ...components, [tag(component)]: on })}
            className="mr-4"
          />
        ))}
        <label className="block">
          Material component{" "}
          <textarea
            value={String(components[tag("material-component")] ?? "")}
            onChange={(e) => set("components", { ...components, [tag("material-component")]: e.target.value })}
            className="block w-full border border-black"
          />
        </label>
      </Fieldset>
      {text("duration", "Duration")}
      <Field label="Description" errors={fieldErrors(problems, "description", "Description")}>
        <label className="block">
          Description
          <textarea value={String(record[tag("description")] ?? "")} onChange={(e) => set("description", e.target.value)} className="block w-full border border-black" rows={6} />
        </label>
      </Field>
      <Fieldset legend="Class spell lists" errors={fieldErrors(problems, "spell-lists", "Class spell lists")}>
        {CLASSES.map((klass) => (
          <Checkbox
            key={klass}
            label={title(klass)}
            checked={lists[tag(klass)] === true}
            onCheckedChange={(on) => set("spell-lists", { ...lists, [tag(klass)]: on })}
            className="mr-4"
          />
        ))}
      </Fieldset>
    </div>
  );
}

export const spellBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/spells",
  validator: "spell",
  one: "spell",
  // The old builder's new spell (db.cljs default-spell).
  empty: { [tag("level")]: 0, [tag("school")]: "abjuration", [tag("spell-lists")]: Object.fromEntries(CLASSES.map((klass) => [tag(klass), true])) },
  fields: ["name", "level", "school", "ritual", "attack-roll?", "casting-time", "range", "components", "duration", "description", "spell-lists"],
  Form: SpellForm,
};
