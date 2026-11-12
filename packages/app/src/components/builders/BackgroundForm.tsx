// The background form of the homebrew builder, with the fields of the old
// app's background builder (views.cljs background-builder). Each value is
// stored as the old app's events stored it (events.cljs ::bg/...), so an
// .orcbrew export round-trips: :help the description, the skills and tools
// in :profs as {:skill {:stealth true}} (a removed pick removes the key, as
// the old second click), the "Any n" choices in :profs :tool-options
// {:artisans-tool n} and :profs :language-options {:choose n :options {:any
// true}}, the gold in :treasure :gp, the equipment in :equipment {:key 1},
// the "Any 1" equipment choices in :equipment-choices [{:name :options {:key
// 1}}], and :traits a vector of :name, :type and :description maps. The
// controls are those of docs/design/homebrew-forms.md, "Background". The
// form has no "+ Add a modifier" button: its five groups always show.
import { AddButton, FieldLabel, Fieldset, ListModal, NumberField, NumberToggle, Picker, Token, Tokens, XButton, type ListItem } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import { tag, untag } from "../../engine/content.ts";
import type { Choice } from "../../engine/builder-choices.ts";
import {
  ARTISANS_TOOLS,
  Checks,
  editor,
  FormColumn,
  getIn,
  MapPicker,
  MISC_TOOLS,
  MUSICAL_INSTRUMENTS,
  RecordTextArea,
  Section,
  SKILLS,
  TextField,
  Traits,
  VEHICLES,
  named,
  nameToKw,
  NumberChoice,
  numberOrNull,
  pickedText,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Path,
  type PickerOptions,
} from "./fields.tsx";
import { holdsValue, useAddList } from "./modifiers.tsx";

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

/** The skills and tools are stored as the old background checkboxes stored them: a removed pick removes the key. */
const SKILL: Path = ["profs", "skill"];
const TOOL: Path = ["profs", "tool"];
const toolOption = (key: string): Path => ["profs", "tool-options", key];

/** Checkboxes of :profs :tool in one row, as the old checkboxes: a click stores true, and a second click removes the key. */
function ToolChecks({ edit, legend, items, action }: { edit: Edit; legend: string; items: Choice[]; action: ReactNode }) {
  return (
    <Checks
      legend={legend}
      look="block"
      action={action}
      items={items}
      checked={(key) => Boolean(edit.get(...TOOL, key))}
      onToggle={(key) => edit.set([...TOOL, key], edit.get(...TOOL, key) ? undefined : true)}
    />
  );
}

/**
 * One sub-selection of the tool proficiencies: an "Any …" token with the
 * number at :profs :tool-options option, or a block of tools in :profs
 * :tool with a picker or, for a short list, a checkbox row.
 */
type ToolSub = { id: string; name: string; example: string } & (
  | { kind: "any"; option: string }
  | { kind: "picker"; items: Choice[]; picker: PickerOptions }
  | { kind: "checks"; items: Choice[] }
);
type ToolBlockSub = Exclude<ToolSub, { kind: "any" }>;

// The sub-selections in their fixed order (docs/design/homebrew-forms.md, "Background"). The "Any …" tokens show first, on one line.
const TOOL_SUBS: ToolSub[] = [
  { id: "any-artisan", name: "Any artisan's tool", example: "The player chooses 1 to 3 artisan's tools", kind: "any", option: "artisans-tool" },
  { id: "artisan", name: "Artisan's tools", example: "Smith's tools, brewer's supplies …", kind: "picker", items: ARTISANS_TOOLS, picker: { add: "Add an artisan's tool" } },
  { id: "any-instrument", name: "Any musical instrument", example: "The player chooses 1 to 3 musical instruments", kind: "any", option: "musical-instrument" },
  { id: "any-gaming", name: "Any gaming set", example: "The player chooses 1 to 3 gaming sets", kind: "any", option: "gaming-set" },
  { id: "vehicles", name: "Vehicles", example: "Land vehicles, water vehicles", kind: "checks", items: VEHICLES },
  { id: "other", name: "Other tools", example: "Thieves' tools, herbalism kit, navigator's tools …", kind: "checks", items: MISC_TOOLS },
];

/** Whether the record holds a value of the sub-selection: a number that is not zero, or a tool of the block that holds a value. */
const subHolds = (edit: Edit, sub: ToolSub) =>
  sub.kind === "any" ? holdsValue(edit.get(...toolOption(sub.option))) : sub.items.some((item) => holdsValue(edit.get(...TOOL, item.key)));

/**
 * What a removed sub-selection writes: what the old second click on each of
 * its picks wrote, so that the key goes. A block changes only its own keys
 * of :profs :tool, which three blocks share.
 */
const subClear = (edit: Edit, sub: ToolSub): [Path, unknown][] =>
  sub.kind === "any"
    ? [[toolOption(sub.option), undefined]]
    : sub.items.filter((item) => Boolean(edit.get(...TOOL, item.key))).map((item): [Path, unknown] => [[...TOOL, item.key], undefined]);

/**
 * The tool proficiencies: the sub-selections that hold a value or that the
 * user added in this visit, then "+ Add a tool proficiency" while one is
 * left to add. The "Any …" tokens are on one line first, then the blocks,
 * each in the fixed order. The list closes on a click, as the modifier list
 * does.
 */
function ToolProficiencies({ edit }: { edit: Edit }) {
  const list = useAddList(() => TOOL_SUBS.filter((sub) => subHolds(edit, sub)).map((sub) => sub.id));
  const shown = TOOL_SUBS.filter((sub) => list.added.has(sub.id) || subHolds(edit, sub));
  const hidden = TOOL_SUBS.filter((sub) => !shown.includes(sub));
  const add = (id: string) => {
    const sub = TOOL_SUBS.find((s) => s.id === id)!;
    list.show(id);
    // An "Any …" token stores 1 at once, as the old "Any 1" box: a toggle in a token has no None.
    if (sub.kind === "any" && !subHolds(edit, sub)) edit.set(toolOption(sub.option), 1);
  };
  const remove = (sub: ToolSub) => {
    edit.setAll(subClear(edit, sub));
    list.hide(sub.id);
    // A token's X gives the focus on in its line (Tokens). A block's X has gone, so the focus goes to the add button.
    if (sub.kind !== "any") list.focusAfterRender(() => list.addButton.current);
  };
  const flash = (id: string) => list.flashClass(id) ?? "";
  return (
    <Section legend="Tool proficiencies">
      <div className="grid gap-[10px]">
        <Tokens>
          {shown.map(
            (sub) =>
              sub.kind === "any" && (
                <span key={sub.id} ref={list.part(sub.id)} data-sub={sub.id} className={`inline-flex ${flash(sub.id)}`}>
                  <Token label={sub.name} onRemove={() => remove(sub)}>
                    <NumberToggle
                      size="small"
                      aria-label={`${sub.name}: number`}
                      values={[1, 2, 3]}
                      value={numberOrNull(edit.get(...toolOption(sub.option)))}
                      onValueChange={(n) => edit.set(toolOption(sub.option), n)}
                    />
                  </Token>
                </span>
              ),
          )}
        </Tokens>
        {shown.map(
          (sub) =>
            sub.kind !== "any" && (
              <div key={sub.id} ref={list.part(sub.id)} data-sub={sub.id} className={flash(sub.id)}>
                <ToolBlock edit={edit} sub={sub} onRemove={() => remove(sub)} />
              </div>
            ),
        )}
        {hidden.length > 0 && <AddButton ref={list.addButton} label="Add a tool proficiency" remaining={hidden.length} aria-haspopup="dialog" onClick={list.openList} />}
      </div>
      <ListModal title="Add a tool proficiency" items={hidden.map((sub) => ({ value: sub.id, label: sub.name, example: sub.example }))} {...list.modal(add)} />
    </Section>
  );
}

/** A block of tools in :profs :tool: a label and an X, then a picker or a checkbox row. */
function ToolBlock({ edit, sub, onRemove }: { edit: Edit; sub: ToolBlockSub; onRemove: () => void }) {
  const x = <XButton size="small" aria-label={`Remove ${sub.name}`} onClick={onRemove} />;
  if (sub.kind === "checks") return <ToolChecks edit={edit} legend={sub.name} items={sub.items} action={x} />;
  return (
    <Fieldset legend={sub.name} look="block" action={x}>
      <MapPicker edit={edit} path={TOOL} items={sub.items} picker={sub.picker} removeKey />
    </Fieldset>
  );
}

const EQUIPMENT_CHOICES = [
  { name: "Artisan's Tools", label: "Any 1 artisan's tool", items: ARTISANS_TOOLS },
  { name: "Musical Instruments", label: "Any 1 musical instrument", items: MUSICAL_INSTRUMENTS },
];
const EQUIPMENT_GROUPS: [string, Choice[]][] = [
  ["Clothing", CLOTHES],
  ["Artisan's tools", ARTISANS_TOOLS],
  ["Other tools", MISC_TOOLS],
  ["Holy symbols", HOLY_SYMBOLS],
  ["Other equipment", MISC_EQUIPMENT],
];

/** Where an equipment option is stored: an entry of :equipment-choices by its name, or a key of :equipment. */
type EquipmentStore = "choice" | "item";
/** The picker value of an equipment option, such as "item:amulet". */
const equipmentValue = (store: EquipmentStore, key: string) => `${store}:${key}`;
/** The store and the key of a picker value. A choice name has no colon, so the first colon ends the store. */
function parseEquipment(value: string): { store: EquipmentStore; key: string } {
  const at = value.indexOf(":");
  return { store: value.slice(0, at) as EquipmentStore, key: value.slice(at + 1) };
}

const EQUIPMENT_OPTIONS: ListItem<string>[] = [
  ...EQUIPMENT_CHOICES.map((c) => ({ value: equipmentValue("choice", c.name), label: c.label, group: "Player's choice" })),
  ...EQUIPMENT_GROUPS.flatMap(([group, items]) => items.map((item) => ({ value: equipmentValue("item", item.key), label: item.name, group }))),
];

/**
 * The starting equipment as one picker over two stores, each written as
 * its old checkbox wrote it. An item stores 1 in :equipment, and its
 * removal removes the key. A player's choice adds {:name :options {:key 1}}
 * at the end of :equipment-choices, and its removal takes out each entry
 * with its name. Keys and entries that are no option keep their values.
 */
function EquipmentPicker({ edit }: { edit: Edit }) {
  const choices = (edit.get("equipment-choices") ?? []) as ItemRecord[];
  const holds = (value: string) => {
    const { store, key } = parseEquipment(value);
    return store === "choice" ? choices.some((c) => c[tag("name")] === key) : Boolean(edit.get("equipment", key));
  };
  const picked = EQUIPMENT_OPTIONS.map((o) => o.value).filter(holds);
  return (
    <Picker
      label="Add equipment"
      options={EQUIPMENT_OPTIONS}
      value={picked}
      search
      pickedText={pickedText}
      onValueChange={(next) => {
        const added = next.filter((v) => !picked.includes(v)).map(parseEquipment);
        const removed = picked.filter((v) => !next.includes(v)).map(parseEquipment);
        const changes: [Path, unknown][] = [
          ...added.filter((v) => v.store === "item").map(({ key }): [Path, unknown] => [["equipment", key], 1]),
          ...removed.filter((v) => v.store === "item").map(({ key }): [Path, unknown] => [["equipment", key], undefined]),
        ];
        const removedChoices = removed.filter((v) => v.store === "choice").map((v) => v.key);
        const addedChoices = EQUIPMENT_CHOICES.filter((c) => added.some((v) => v.store === "choice" && v.key === c.name));
        if (removedChoices.length > 0 || addedChoices.length > 0)
          changes.push([
            ["equipment-choices"],
            [
              ...choices.filter((c) => !removedChoices.includes(c[tag("name")] as string)),
              ...addedChoices.map((c) => ({ [tag("name")]: c.name, [tag("options")]: Object.fromEntries(c.items.map((item) => [tag(item.key), 1])) })),
            ],
          ]);
        edit.setAll(changes);
      }}
    />
  );
}

function BackgroundForm({ record, onChange, problems }: FormProps) {
  const edit = editor(record, onChange);
  const name = String(edit.get("name") ?? "");
  const key = untag(edit.get("key"));
  const gold = edit.get("treasure", "gp");
  return (
    <FormColumn>
      <TextField edit={edit} problems={problems} field="name" label="Name" />
      {key !== "" && name !== "" && key !== nameToKw(name) && (
        <p role="note" className="text-warning">
          The key of this background is {key}. The key of its name is {nameToKw(name)}. A character always gets a background by the key of its name, not by
          the stored key. Thus a character that has the key {key} does not find this background. To make the keys the same, change the name, or make a new background with this name.
        </p>
      )}
      <RecordTextArea edit={edit} field="help" label="Description" />
      <Section legend="Skill proficiencies">
        <MapPicker edit={edit} path={SKILL} items={SKILLS} picker={{ add: "Add a skill" }} removeKey />
      </Section>
      {/* A number stores {:choose n :options {:any true}}, as the old "Any n" box, and None removes :language-options, as the old second click. */}
      <NumberChoice
        edit={edit}
        legend="Languages"
        path={["profs", "language-options"]}
        values={[1, 2, 3]}
        line="Languages of the player's choice"
        read={(stored) => getIn(stored, ["choose"])}
        write={(n) => ({ [tag("choose")]: n, [tag("options")]: { [tag("any")]: true } })}
      />
      <ToolProficiencies edit={edit} />
      <Section legend="Starting equipment">
        <div className="grid gap-[10px]">
          <FieldLabel label="Gold" className="justify-self-start">
            <NumberField value={numberOrNull(gold)} onValueChange={(n) => edit.set(["treasure", "gp"], n ?? undefined)} />
          </FieldLabel>
          <EquipmentPicker edit={edit} />
        </div>
      </Section>
      <Traits edit={edit} />
    </FormColumn>
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
