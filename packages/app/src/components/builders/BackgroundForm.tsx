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
  editor,
  MISC_TOOLS,
  MUSICAL_INSTRUMENTS,
  SKILLS,
  TextArea,
  TextField,
  Traits,
  ValueChecks,
  VEHICLES,
  named,
  nameToKw,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Path,
} from "./fields.tsx";

// The old equipment lists (equipment.cljc), keyed as common/add-keys keys them.
const CLOTHES = named(["Clothes, common", "Clothes, costume", "Clothes, fine", "Clothes, traveler’s"]);
const HOLY_SYMBOLS = named(["Amulet", "Emblem", "Reliquary"]);
const MISC_EQUIPMENT = named([
  "Abacus", "Acid", "Alchemist’s fire", "Alms Box", "Antitoxin", "Backpack", "Bag of Sand", "Ball bearings", "Barrel", "Basket",
  "Bedroll", "Bell", "Blanket", "Block and tackle", "Book", "Bottle, glass", "Bucket", "Caltrops", "Candle", "Case, crossbow bolt",
  "Case, map or scroll", "Censer", "Chain", "Chalk", "Chest", "Climber’s kit", "Component pouch", "Costume", "Crowbar",
  "Fishing tackle", "Flask or tankard", "Grappling hook", "Hammer", "Hammer, sledge", "Healer’s kit", "Holy water", "Holy symbol",
  "Hourglass", "Hunting trap", "Ink", "Ink pen", "Incense", "Jug or pitcher", "Knife, Small", "Ladder (10-foot)", "Lamp",
  "Lantern, bullseye", "Lantern, hooded", "Lock", "Magnifying glass", "Manacles", "Mess kit", "Mirror, steel", "Oil", "Paper",
  "Parchment", "Perfume", "Pick, miner’s", "Piton", "Poison, basic", "Pole (10-foot)", "Pot, iron", "Potion of healing", "Pouch",
  "Prayer Book", "Prayer Wheel", "Purse", "Quiver", "Ram, portable", "Rations (1 day)", "Robes", "Rope, hempen", "Rope, silk", "Sack",
  "Scale, merchant’s", "Sealing wax", "Shovel", "Signal whistle", "Signet ring", "Soap", "Spellbook", "Spikes, iron", "Spyglass",
  "String", "Tent, two-person", "Tinderbox", "Torch", "Vial", "Vestements", "Waterskin", "Whetstone", "Wooden Stake",
]);

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
          The key of this background is {key}. The key of its name is {nameToKw(name)}. A character always gets a background by the key of its name, not by
          the stored key. Thus a character that has the key {key} does not find this background. To make the keys the same, change the name, or make a new background with this name.
        </p>
      )}
      <TextArea edit={edit} field="help" label="Description" />
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
