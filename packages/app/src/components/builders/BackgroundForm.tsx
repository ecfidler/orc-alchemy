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
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { tag, untag } from "../../engine/content.ts";
import type { Choice } from "../../engine/builder-choices.ts";
import {
  ARTISANS_TOOLS,
  Checks,
  editor,
  FormColumn,
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
  numberOrNull,
  pickedText,
  type BuilderType,
  type Edit,
  type FormProps,
  type ItemRecord,
  type Path,
  type PickerOptions,
} from "./fields.tsx";
import { holdsValue } from "./modifiers.tsx";

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

/**
 * A picker of the map at path, as the old checkboxes of the background
 * stored it: a pick stores on, and a removed token removes the key, as the
 * old second click did. A key shows as a token when its value is truthy, as
 * the old box showed checked. Only the picked or removed key changes, so a
 * key that is no option keeps its value.
 */
function KeyPicker({ edit, path, items, picker, on = true }: { edit: Edit; path: Path; items: Choice[]; picker: PickerOptions; on?: unknown }) {
  const picked = items.filter((item) => Boolean(edit.get(...path, item.key))).map((item) => item.key);
  return (
    <Picker
      label={picker.add}
      options={items.map((item) => ({ value: item.key, label: item.name }))}
      value={picked}
      search={picker.search}
      pickedText={pickedText}
      onValueChange={(next) => {
        const added = next.filter((key) => !picked.includes(key)).map((key): [Path, unknown] => [[...path, key], on]);
        const removed = picked.filter((key) => !next.includes(key)).map((key): [Path, unknown] => [[...path, key], undefined]);
        edit.setAll([...added, ...removed]);
      }}
    />
  );
}

/** Checkboxes of the map at path in one row, as the old checkboxes: a click stores true, and a second click removes the key. */
function KeyChecks({ edit, legend, path, items, action }: { edit: Edit; legend: string; path: Path; items: Choice[]; action?: ReactNode }) {
  return (
    <Checks
      legend={legend}
      row
      action={action}
      items={items}
      checked={(key) => Boolean(edit.get(...path, key))}
      onToggle={(key) => edit.set([...path, key], edit.get(...path, key) ? undefined : true)}
    />
  );
}

const LANGUAGE_OPTIONS: Path = ["profs", "language-options"];

/**
 * The languages of the player's choice as a None / 1 / 2 / 3 toggle. A
 * number stores {:choose n :options {:any true}}, as the old "Any n" box,
 * and None removes :language-options, as the old second click.
 */
function Languages({ edit }: { edit: Edit }) {
  const id = useId();
  const choose = edit.get(...LANGUAGE_OPTIONS, "choose");
  return (
    <Section legend="Languages">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <NumberToggle
          aria-labelledby={id}
          values={[null, 1, 2, 3]}
          value={choose === 1 || choose === 2 || choose === 3 ? choose : null}
          onValueChange={(n) => edit.set(LANGUAGE_OPTIONS, n === null ? undefined : { [tag("choose")]: n, [tag("options")]: { [tag("any")]: true } })}
        />
        <span id={id}>Languages of the player's choice</span>
      </div>
    </Section>
  );
}

const TOOL = ["profs", "tool"];
const toolOption = (key: string): Path => ["profs", "tool-options", key];

/** One sub-selection of the tool proficiencies: an "Any …" token at a number, or a block of tools in :profs :tool. */
type ToolSub = { id: string; name: string; example: string } & ({ any: string; items?: never } | { any?: never; items: Choice[] });

// The sub-selections in the order they show (docs/design/homebrew-forms.md, "Background").
const TOOL_SUBS: ToolSub[] = [
  { id: "any-artisan", name: "Any artisan's tool", example: "The player chooses 1 to 3 artisan's tools", any: "artisans-tool" },
  { id: "artisan", name: "Artisan's tools", example: "Smith's tools, brewer's supplies …", items: ARTISANS_TOOLS },
  { id: "any-instrument", name: "Any musical instrument", example: "The player chooses 1 to 3 musical instruments", any: "musical-instrument" },
  { id: "any-gaming", name: "Any gaming set", example: "The player chooses 1 to 3 gaming sets", any: "gaming-set" },
  { id: "vehicles", name: "Vehicles", example: "Land vehicles, water vehicles", items: VEHICLES },
  { id: "other", name: "Other tools", example: "Thieves' tools, herbalism kit, navigator's tools …", items: MISC_TOOLS },
];

/** Whether the record holds a value of the sub-selection: a number that is not zero, or a tool of the block that holds a value. */
const subHolds = (edit: Edit, sub: ToolSub) => (sub.items ? sub.items.some((item) => holdsValue(edit.get(...TOOL, item.key))) : holdsValue(edit.get(...toolOption(sub.any))));

/**
 * What a removed sub-selection writes: what the old second click on each of
 * its picks wrote, so that the key goes. A block changes only its own keys
 * of :profs :tool, which three blocks share.
 */
const subClear = (edit: Edit, sub: ToolSub): [Path, unknown][] =>
  sub.items ? sub.items.filter((item) => Boolean(edit.get(...TOOL, item.key))).map((item): [Path, unknown] => [[...TOOL, item.key], undefined]) : [[toolOption(sub.any), undefined]];

/** The first control of a new sub-selection, after its X: the X is not its first control. */
function firstControl(el: Element | null | undefined): HTMLElement | null {
  if (!el) return null;
  return [...el.querySelectorAll<HTMLElement>("button, input")].find((c) => c.tabIndex >= 0 && !c.closest(".ui-fieldset-action, .ui-token > .ui-x-button")) ?? null;
}

/**
 * The tool proficiencies: the sub-selections that hold a value or that the
 * user added in this visit, in the fixed order, then "+ Add a tool
 * proficiency" while one is left to add. The list closes on a click, as
 * the modifier list does. Which sub-selections the user added is local
 * state: an empty one stays until the form closes, and is not stored.
 */
function ToolProficiencies({ edit }: { edit: Edit }) {
  const [added, setAdded] = useState(() => new Set(TOOL_SUBS.filter((sub) => subHolds(edit, sub)).map((sub) => sub.id)));
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string>();
  const parts = useRef(new Map<string, HTMLElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const picked = useRef<string>();
  // The element that gets the focus after the next render.
  const focusNext = useRef<() => HTMLElement | null | undefined>();
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = undefined;
    target?.()?.focus();
  });

  const shown = TOOL_SUBS.filter((sub) => added.has(sub.id) || subHolds(edit, sub));
  const hidden = TOOL_SUBS.filter((sub) => !shown.includes(sub));
  const add = (id: string) => {
    const sub = TOOL_SUBS.find((s) => s.id === id)!;
    setAdded((ids) => new Set(ids).add(id));
    setFlash(id);
    // An "Any …" token stores 1 at once, as the old "Any 1" box: a toggle in a token has no None.
    if (sub.any && !subHolds(edit, sub)) edit.set(toolOption(sub.any), 1);
  };
  const remove = (sub: ToolSub) => {
    edit.setAll(subClear(edit, sub));
    setAdded((ids) => {
      const next = new Set(ids);
      next.delete(sub.id);
      return next;
    });
    // A token's X gives the focus on in its line (Tokens). A block's X has gone, so the focus goes to the add button.
    if (!sub.any) focusNext.current = () => addButton.current;
  };
  const ref = (id: string) => (el: HTMLElement | null) => {
    if (el) parts.current.set(id, el);
    else parts.current.delete(id);
  };

  // Next "Any …" tokens share one line that wraps.
  const runs: ToolSub[][] = [];
  for (const sub of shown) {
    const last = runs[runs.length - 1];
    if (sub.any && last?.[0].any) last.push(sub);
    else runs.push([sub]);
  }
  return (
    <Section legend="Tool proficiencies">
      <div className="grid gap-[10px]">
        {runs.map((run) =>
          run[0].any ? (
            <Tokens key={run[0].id}>
              {run.map((sub) => {
                const value = edit.get(...toolOption(sub.any!));
                return (
                  <span key={sub.id} ref={ref(sub.id)} data-sub={sub.id} className={`inline-flex ${flash === sub.id ? "ui-flash" : ""}`}>
                    <Token label={sub.name} onRemove={() => remove(sub)}>
                      <NumberToggle
                        size="small"
                        aria-label={`${sub.name}: number`}
                        values={[1, 2, 3]}
                        value={value === 1 || value === 2 || value === 3 ? value : null}
                        onValueChange={(n) => edit.set(toolOption(sub.any!), n)}
                      />
                    </Token>
                  </span>
                );
              })}
            </Tokens>
          ) : (
            <div
              key={run[0].id}
              ref={ref(run[0].id)}
              data-sub={run[0].id}
              className={`border-l-2 border-ink pl-3 [&_.ui-fieldset-head>.ui-fieldset-legend]:m-0 [&_.ui-fieldset-head>.ui-fieldset-legend]:text-[15.5px] [&_.ui-fieldset-head>.ui-fieldset-legend]:font-semibold [&_.ui-fieldset-head>.ui-fieldset-legend]:normal-case [&_.ui-fieldset-head>.ui-fieldset-legend]:tracking-normal [&_.ui-fieldset-head>.ui-fieldset-legend]:text-ink [&_.ui-fieldset-head>.ui-fieldset-legend]:[font-family:inherit] ${flash === run[0].id ? "ui-flash" : ""}`}
            >
              <ToolBlock edit={edit} sub={run[0]} onRemove={() => remove(run[0])} />
            </div>
          ),
        )}
        {hidden.length > 0 && <AddButton ref={addButton} label="Add a tool proficiency" remaining={hidden.length} aria-haspopup="dialog" onClick={() => setOpen(true)} />}
      </div>
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add a tool proficiency"
        items={hidden.map((sub) => ({ value: sub.id, label: sub.name, example: sub.example }))}
        onPick={(id) => {
          picked.current = id;
          add(id);
        }}
        // After a pick, the focus goes to the new part's first control; else back to the add button.
        finalFocus={() => {
          const id = picked.current;
          picked.current = undefined;
          return id === undefined ? addButton.current : firstControl(parts.current.get(id));
        }}
      />
    </Section>
  );
}

/** A block of tools in :profs :tool: a label and an X, then a picker (artisan's tools) or a checkbox row (a short list). */
function ToolBlock({ edit, sub, onRemove }: { edit: Edit; sub: ToolSub; onRemove: () => void }) {
  const x = <XButton size="small" aria-label={`Remove ${sub.name}`} onClick={onRemove} />;
  if (sub.items!.length > 6)
    return (
      <Fieldset legend={sub.name} action={x}>
        <KeyPicker edit={edit} path={TOOL} items={sub.items!} picker={{ add: "Add an artisan's tool" }} />
      </Fieldset>
    );
  return <KeyChecks edit={edit} legend={sub.name} path={TOOL} items={sub.items!} action={x} />;
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
/**
 * The options of the equipment picker. A value names its store: "choice:"
 * an entry of :equipment-choices by its name, and "item:" a key of
 * :equipment.
 */
const EQUIPMENT_OPTIONS: ListItem<string>[] = [
  ...EQUIPMENT_CHOICES.map((c) => ({ value: `choice:${c.name}`, label: c.label, group: "Player's choice" })),
  ...EQUIPMENT_GROUPS.flatMap(([group, items]) => items.map((item) => ({ value: `item:${item.key}`, label: item.name, group }))),
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
  const hasChoice = (name: string) => choices.some((c) => c[tag("name")] === name);
  const holds = (value: string) => (value.startsWith("choice:") ? hasChoice(value.slice(7)) : Boolean(edit.get("equipment", value.slice(5))));
  const picked = [...new Set(EQUIPMENT_OPTIONS.map((o) => o.value).filter(holds))];
  return (
    <Picker
      label="Add equipment"
      options={EQUIPMENT_OPTIONS}
      value={picked}
      search
      pickedText={pickedText}
      onValueChange={(next) => {
        const added = next.filter((v) => !picked.includes(v));
        const removed = picked.filter((v) => !next.includes(v));
        const changes: [Path, unknown][] = [];
        for (const v of added) if (v.startsWith("item:")) changes.push([["equipment", v.slice(5)], 1]);
        for (const v of removed) if (v.startsWith("item:")) changes.push([["equipment", v.slice(5)], undefined]);
        const removedChoices = removed.filter((v) => v.startsWith("choice:")).map((v) => v.slice(7));
        const addedChoices = EQUIPMENT_CHOICES.filter((c) => added.includes(`choice:${c.name}`));
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
        <KeyPicker edit={edit} path={["profs", "skill"]} items={SKILLS} picker={{ add: "Add a skill" }} />
      </Section>
      <Languages edit={edit} />
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
