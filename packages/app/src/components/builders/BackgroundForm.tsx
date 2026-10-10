// The background form of the homebrew builder, with the fields of the old
// app's background builder (views.cljs background-builder). Each value is
// stored as the old app's events stored it (events.cljs ::bg/...), so an
// .orcbrew export round-trips: :help the description, the skill and tool
// checkboxes in :profs as {:skill {:stealth true}} (a second click removes
// the key), the "Any n" choices in :profs :tool-options {:artisans-tool n}
// and :profs :language-options {:choose n :options {:any true}}, the gold in
// :treasure :gp, the equipment checkboxes in :equipment {:key 1}, the "Any 1"
// equipment choices in :equipment-choices [{:name :options {:key 1}}], and
// :traits a vector of :name, :type and :description maps.
import { tag, untag } from "../../engine/content.ts";
import type { Choice } from "../../engine/builder-choices.ts";
import {
  ARTISANS_TOOLS,
  Checks,
  CLOTHES,
  editor,
  HOLY_SYMBOLS,
  MISC_EQUIPMENT,
  MISC_TOOLS,
  MUSICAL_INSTRUMENTS,
  SKILLS,
  TextField,
  Traits,
  ValueChecks,
  VEHICLES,
  nameToKw,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Path,
} from "./fields.tsx";

const ANY = [1, 2, 3];

/** Checkboxes of the map at path, as {:key on}: a click stores on, and a second click removes the key. */
function KeyChecks({ edit, legend, path, items, on = true }: { edit: Edit; legend: string; path: Path; items: Choice[]; on?: unknown }) {
  return <Checks legend={legend} items={items} checked={(key) => Boolean(edit.get(...path, key))} onToggle={(key) => edit.set([...path, key], edit.get(...path, key) ? undefined : on)} />;
}

function BackgroundForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const name = String(edit.get("name") ?? "");
  const key = untag(edit.get("key"));
  const languageChoice = edit.get("profs", "language-options", "choose");
  const choices = (edit.get("equipment-choices") ?? []) as ItemRecord[];
  const hasChoice = (choice: string) => choices.some((c) => c[tag("name")] === choice);
  const toggleChoice = (choice: string, items: Choice[]) =>
    edit.set(
      ["equipment-choices"],
      hasChoice(choice)
        ? choices.filter((c) => c[tag("name")] !== choice)
        : [...choices, { [tag("name")]: choice, [tag("options")]: Object.fromEntries(items.map((item) => [tag(item.key), 1])) }],
    );
  const gold = edit.get("treasure", "gp");
  return (
    <div className="space-y-3">
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      {key !== "" && name !== "" && key !== nameToKw(name) && (
        <p role="note" className="text-amber-700">
          The key of this background is {key}, not {nameToKw(name)}, the key of its name. The old app gives an imported background the key of its name, so a
          character that has this background in the old app can lose it.
        </p>
      )}
      <label className="block">
        Description
        <textarea value={String(edit.get("help") ?? "")} onChange={(ev) => edit.set(["help"], ev.target.value)} className="block w-full border border-black" rows={4} />
      </label>
      <KeyChecks edit={edit} legend="Skill Proficiencies" path={["profs", "skill"]} items={SKILLS} />
      <Checks
        legend="Languages"
        items={ANY.map((n) => ({ key: String(n), name: `Any ${n}` }))}
        checked={(n) => languageChoice === Number(n)}
        onToggle={(n) =>
          edit.set(["profs", "language-options"], languageChoice === Number(n) ? undefined : { [tag("choose")]: Number(n), [tag("options")]: { [tag("any")]: true } })
        }
      />
      <fieldset>
        <legend className="font-bold">Tool Proficiencies</legend>
        <ValueChecks edit={edit} legend="Artisan's Tools: proficiency choice" path={["profs", "tool-options", "artisans-tool"]} values={ANY} name={(n) => `Any ${n}`} />
        <KeyChecks edit={edit} legend="Artisan's Tools: proficiencies" path={["profs", "tool"]} items={ARTISANS_TOOLS} />
        <ValueChecks edit={edit} legend="Musical Instruments: proficiency choice" path={["profs", "tool-options", "musical-instrument"]} values={ANY} name={(n) => `Any ${n}`} />
        <ValueChecks edit={edit} legend="Gaming Set: proficiency choice" path={["profs", "tool-options", "gaming-set"]} values={ANY} name={(n) => `Any ${n}`} />
        <KeyChecks edit={edit} legend="Vehicle proficiencies" path={["profs", "tool"]} items={VEHICLES} />
        <KeyChecks edit={edit} legend="Other tool proficiencies" path={["profs", "tool"]} items={MISC_TOOLS} />
      </fieldset>
      <fieldset>
        <legend className="font-bold">Starting Equipment</legend>
        <label className="block">
          Gold{" "}
          <input
            type="number"
            value={typeof gold === "number" ? gold : ""}
            onChange={(e) => edit.set(["treasure", "gp"], e.target.value === "" ? undefined : parseInt(e.target.value, 10))}
            className="border border-black px-1"
          />
        </label>
        <KeyChecks edit={edit} legend="Clothing" path={["equipment"]} items={CLOTHES} on={1} />
        <Checks
          legend="Equipment choices"
          items={[
            { key: "Artisan's Tools", name: "Any 1 of the artisan's tools" },
            { key: "Musical Instruments", name: "Any 1 of the musical instruments" },
          ]}
          checked={hasChoice}
          onToggle={(choice) => toggleChoice(choice, choice === "Artisan's Tools" ? ARTISANS_TOOLS : MUSICAL_INSTRUMENTS)}
        />
        <KeyChecks edit={edit} legend="Artisan's Tools" path={["equipment"]} items={ARTISANS_TOOLS} on={1} />
        <KeyChecks edit={edit} legend="Other Tools" path={["equipment"]} items={MISC_TOOLS} on={1} />
        <KeyChecks edit={edit} legend="Holy Symbols" path={["equipment"]} items={HOLY_SYMBOLS} on={1} />
        <KeyChecks edit={edit} legend="Other Equipment" path={["equipment"]} items={MISC_EQUIPMENT} on={1} />
      </fieldset>
      <Traits edit={edit} />
    </div>
  );
}

export const backgroundBuilder: BuilderType = {
  contentType: "orcpub.dnd.e5/backgrounds",
  validator: "background",
  one: "background",
  // The old builder's new background (db.cljs default-background).
  empty: { [tag("traits")]: [] },
  fields: ["name"],
  Form: BackgroundForm,
};
