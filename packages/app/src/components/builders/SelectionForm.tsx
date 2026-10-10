// The selection form of the homebrew builder, with the fields of the old
// app's selection builder (views.cljs selection-builder): a name and
// :options, a vector of {:name :description} maps. A class or subclass
// level can then give the selection (ClassForm.tsx). Each value is stored
// as the old events stored it (events.cljs ::selections/...): the new
// selection is {:options []} (db.cljs default-selection), Add Option
// appends {:name "Option N"} with the first N not in use, and delete
// removes the option at its index.
import { tag } from "../../engine/content.ts";
import { editor, FieldProblems, problemText, TextField, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

const OPTIONS = tag("options");
const button = "border border-black px-2";

/** The old add-option event's default name: "Option N", from the option count plus one, with the first N not in use. */
function newOptionName(options: ItemRecord[]) {
  const names = new Set(options.map((o) => o[tag("name")]));
  let n = options.length + 1;
  while (names.has(`Option ${n}`)) n++;
  return `Option ${n}`;
}

function SelectionForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const options = (record[OPTIONS] ?? []) as ItemRecord[];
  return (
    <div className="space-y-3">
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      <fieldset>
        <legend className="font-bold">Options</legend>
        {options.map((option, i) => {
          const n = i + 1;
          const found = problems.filter((p) => p.path[0] === "options" && p.path[1] === i);
          return (
            <div key={i} className="mb-3">
              <label className="mr-4 inline-block">
                Option {n} name{" "}
                <input type="text" value={String(option[tag("name")] ?? "")} onChange={(e) => edit.set(["options", i, "name"], e.target.value)} className="border border-black px-1" />
              </label>
              <button type="button" onClick={() => edit.set(["options"], options.filter((_, j) => j !== i))} className={button}>
                Delete option {n}
              </button>
              {found.length > 0 && (
                <ul aria-label={`Problems: Option ${n}`} className="text-red-700">
                  {found.map((problem, j) => (
                    <li key={j}>{"reason" in problem && problem.reason === "duplicate" ? `Option ${n} has the same name as another option.` : problemText(`Option ${n} name`, problem)}</li>
                  ))}
                </ul>
              )}
              <label className="block">
                Option {n} description
                <textarea value={String(option[tag("description")] ?? "")} onChange={(e) => edit.set(["options", i, "description"], e.target.value)} className="block w-full border border-black" />
              </label>
            </div>
          );
        })}
        <button type="button" onClick={() => edit.set(["options"], [...options, { [tag("name")]: newOptionName(options) }])} className={button}>
          Add option
        </button>
        <FieldProblems problems={problems.filter((p) => p.path.length === 1)} field="options" label="Options" />
      </fieldset>
    </div>
  );
}

export const selectionBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/selections",
  validator: "selection",
  one: "selection",
  empty: { [OPTIONS]: [] },
  fields: ["name", "options"],
  Form: SelectionForm,
};
