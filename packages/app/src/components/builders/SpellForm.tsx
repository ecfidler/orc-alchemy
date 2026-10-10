// The spell form of the homebrew builder, with the fields of the old app's
// spell builder (views.cljs spell-builder). Each value is stored as the old
// app's events stored it (events.cljs ::spells/...), so an .orcbrew export
// round-trips: :level an integer, :school a string, :ritual and
// :attack-roll? booleans, :components a map of :verbal, :somatic and
// :material booleans and the :material-component text, and :spell-lists a
// map of class keyword to true or false.
import { tag } from "../../engine/content.ts";
import { FieldProblems, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

const SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"];
/** The old builder's spellcasting classes. */
const CLASSES = ["bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard"];
const COMPONENTS = ["verbal", "somatic", "material"];

const title = (key: string) => key[0].toUpperCase() + key.slice(1);
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

function SpellForm({ record, onChange, problems }: FormProps) {
  const set = (field: string, value: unknown) => onChange({ ...record, [tag(field)]: value });
  const components = (record["~:components"] ?? {}) as ItemRecord;
  const lists = (record["~:spell-lists"] ?? {}) as ItemRecord;
  const text = (field: string, label: string) => (
    <div>
      <label className="block">
        {label}{" "}
        <input type="text" value={String(record[tag(field)] ?? "")} onChange={(e) => set(field, e.target.value)} className="border border-black px-1" />
      </label>
      <FieldProblems problems={problems} field={field} label={label} />
    </div>
  );
  const checkbox = (field: string, label: string) => (
    <label className="block">
      <input type="checkbox" checked={record[tag(field)] === true} onChange={(e) => set(field, e.target.checked)} /> {label}
    </label>
  );

  return (
    <div className="space-y-3">
      {text("name", "Name")}
      <div>
        <label className="block">
          Level{" "}
          <select value={String(record["~:level"] ?? "")} onChange={(e) => set("level", parseInt(e.target.value, 10))} className="border border-black">
            {Array.from({ length: 10 }, (_, n) => (
              <option key={n} value={n}>
                {n === 0 ? "Cantrip" : `${ordinal(n)}-level`}
              </option>
            ))}
          </select>
        </label>
        <FieldProblems problems={problems} field="level" label="Level" />
      </div>
      <div>
        <label className="block">
          School{" "}
          <select value={String(record["~:school"] ?? "")} onChange={(e) => set("school", e.target.value)} className="border border-black">
            {SCHOOLS.map((school) => (
              <option key={school} value={school}>
                {school}
              </option>
            ))}
          </select>
        </label>
        <FieldProblems problems={problems} field="school" label="School" />
      </div>
      {checkbox("ritual", "Ritual")}
      {checkbox("attack-roll?", "Requires an attack roll")}
      {text("casting-time", "Casting time")}
      {text("range", "Range")}
      <fieldset>
        <legend>Components</legend>
        {COMPONENTS.map((component) => (
          <label key={component} className="mr-4">
            <input
              type="checkbox"
              checked={components[tag(component)] === true}
              onChange={(e) => set("components", { ...components, [tag(component)]: e.target.checked })}
            />{" "}
            {title(component)}
          </label>
        ))}
        <label className="block">
          Material component{" "}
          <textarea
            value={String(components["~:material-component"] ?? "")}
            onChange={(e) => set("components", { ...components, "~:material-component": e.target.value })}
            className="block w-full border border-black"
          />
        </label>
        <FieldProblems problems={problems} field="components" label="Components" />
      </fieldset>
      {text("duration", "Duration")}
      <div>
        <label className="block">
          Description
          <textarea value={String(record["~:description"] ?? "")} onChange={(e) => set("description", e.target.value)} className="block w-full border border-black" rows={6} />
        </label>
        <FieldProblems problems={problems} field="description" label="Description" />
      </div>
      <fieldset>
        <legend>Class spell lists</legend>
        {CLASSES.map((klass) => (
          <label key={klass} className="mr-4">
            <input type="checkbox" checked={lists[tag(klass)] === true} onChange={(e) => set("spell-lists", { ...lists, [tag(klass)]: e.target.checked })} />{" "}
            {title(klass)}
          </label>
        ))}
        <FieldProblems problems={problems} field="spell-lists" label="Class spell lists" />
      </fieldset>
    </div>
  );
}

export const spellBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/spells",
  validator: "spell",
  one: "spell",
  // The old builder's new spell (db.cljs default-spell).
  empty: { "~:level": 0, "~:school": "abjuration", "~:spell-lists": Object.fromEntries(CLASSES.map((klass) => [tag(klass), true])) },
  fields: ["name", "level", "school", "ritual", "attack-roll?", "casting-time", "range", "components", "duration", "description", "spell-lists"],
  Form: SpellForm,
};
