// The selection form of the homebrew builder, with the fields of the old
// app's selection builder (views.cljs selection-builder): a name and
// :options, a vector of {:name :description} maps. A class or subclass
// level can then give the selection (ClassForm.tsx). Each value is stored
// as the old events stored it (events.cljs ::selections/...): the new
// selection is {:options []} (db.cljs default-selection), Add Option
// appends {:name "Option N"} with the first N not in use, and delete
// removes the option at its index.
import { Button, Field, Fieldset } from "@orc-alchemy/ui";
import { tag } from "../../engine/content.ts";
import { editor, fieldErrors, problemText, TextField, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

const OPTIONS = tag("options");

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
      <Fieldset legend="Options" errors={fieldErrors(problems.filter((p) => p.path.length === 1), "options", "Options")}>
        {options.map((option, i) => {
          const n = i + 1;
          const found = problems.filter((p) => p.path[0] === "options" && p.path[1] === i);
          return (
            <div key={i} className="mb-3">
              <Field
                label={`Option ${n}`}
                errors={found.map((problem) =>
                  "reason" in problem && problem.reason === "duplicate" ? `Option ${n} has the same name as another option.` : problemText(`Option ${n} name`, problem),
                )}
              >
                <label className="mr-4 inline-block">
                  Option {n} name{" "}
                  <input type="text" value={String(option[tag("name")] ?? "")} onChange={(e) => edit.set(["options", i, "name"], e.target.value)} className="border border-black px-1" />
                </label>
                <Button onClick={() => edit.set(["options"], options.filter((_, j) => j !== i))} size="small">
                  Delete option {n}
                </Button>
              </Field>
              <label className="block">
                Option {n} description
                <textarea value={String(option[tag("description")] ?? "")} onChange={(e) => edit.set(["options", i, "description"], e.target.value)} className="block w-full border border-black" />
              </label>
            </div>
          );
        })}
        <Button onClick={() => edit.set(["options"], [...options, { [tag("name")]: newOptionName(options) }])} size="small">
          Add option
        </Button>
      </Fieldset>
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
