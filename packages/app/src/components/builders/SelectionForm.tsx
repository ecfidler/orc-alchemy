// The selection form of the homebrew builder, with the fields of the old
// app's selection builder (views.cljs selection-builder): a name and
// :options, a vector of {:name :description} maps. A class or subclass
// level can then give the selection (ClassForm.tsx). Each value is stored
// as the old events stored it (events.cljs ::selections/...): the new
// selection is {:options []} (db.cljs default-selection), Add Option
// appends {:name "Option N"} with the first N not in use, and delete
// removes the option at its index.
import { Field, FieldLabel, Fieldset, TextArea, TextInput, XButton } from "@orc-alchemy/ui";
import { tag } from "../../engine/content.ts";
import { AddButton, Card, editor, fieldErrors, FormColumn, problemText, TextField, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

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
    <FormColumn>
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      <Fieldset legend="Options" look="section" errors={fieldErrors(problems.filter((p) => p.path.length === 1), "options", "Options")}>
        {options.map((option, i) => {
          const n = i + 1;
          const found = problems.filter((p) => p.path[0] === "options" && p.path[1] === i);
          return (
            <Card
              key={i}
              top={
                <>
                  <div className="min-w-[12rem] flex-1">
                    <Field
                      label={`Option ${n}`}
                      errors={found.map((problem) =>
                        "reason" in problem && problem.reason === "duplicate" ? `Option ${n} has the same name as another option.` : problemText(`Option ${n} name`, problem),
                      )}
                    >
                      <FieldLabel label="Name">
                        <TextInput aria-label={`Option ${n} name`} value={String(option[tag("name")] ?? "")} onValueChange={(text) => edit.set(["options", i, "name"], text)} width="full" />
                      </FieldLabel>
                    </Field>
                  </div>
                  <XButton aria-label={`Delete option ${n}`} onClick={() => edit.set(["options"], options.filter((_, j) => j !== i))} />
                </>
              }
            >
              <FieldLabel label="Description">
                <TextArea aria-label={`Option ${n} description`} value={String(option[tag("description")] ?? "")} onValueChange={(text) => edit.set(["options", i, "description"], text)} rows={3} />
              </FieldLabel>
            </Card>
          );
        })}
        <AddButton onClick={() => edit.set(["options"], [...options, { [tag("name")]: newOptionName(options) }])}>Add option</AddButton>
      </Fieldset>
    </FormColumn>
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
