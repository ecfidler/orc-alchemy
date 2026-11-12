// The magic item form of the homebrew builder, with the fields of the old
// app's item builder (views.cljs item-builder). The item is stored as the
// old server stored it, in the form readServerEdn returns (magic_items.cljc
// from-internal-item): namespaced keys, keyword values, :subtypes and
// :attunement as keyword vectors, and :modifiers as mod-cfg maps of a
// :orcpub.modifiers/key and its keyword or int args. The engine expands a
// weapon or armor with subtypes into one option for each base item. A
// New weapon (the subtype :other, the old "Custom") has its own details in
// :orcpub.dnd.e5.weapons/ fields. Magic items are not in packs: save and
// load use the magic items store. The form shows the base fields always, and
// the user adds the other modifiers from a list (modifiers.tsx). Each picker
// writes what the old checkbox wrote: a pick is the old check, and a removed
// token the old second click.
import { Checkbox, Field, FieldErrors, FieldLabel, Fieldset, NumberField, Picker, Select, TextArea, TextInput } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import type { Choice } from "../../engine/builder-choices.ts";
import { tag, untag } from "../../engine/content.ts";
import { magicItemKey } from "../../engine/import.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import {
  Checks,
  DAMAGE_TYPES,
  editor,
  fieldErrors,
  FieldRow,
  FormColumn,
  Help,
  nameToKw,
  numberOrNull,
  numbers,
  orFirst,
  pickedText,
  range,
  SelectField,
  title,
  WithChoices,
  withOthers,
  type BuilderType,
  type FormProps,
  type ItemRecord,
  type Options,
  type PickItem,
} from "./fields.tsx";
import { CONDITION_CHOICES, DAMAGE_CHOICES } from "./modifier-kinds.tsx";
import { Modifiers, type Modifier, type ModifierValues } from "./modifiers.tsx";

const MI = "orcpub.dnd.e5.magic-items/";
const W = "orcpub.dnd.e5.weapons/";

/** The old builder's types and rarities (subs.cljs ::mi/item-types, ::mi/rarities). */
const TYPES = ["wondrous-item", "weapon", "armor", "ring", "wand", "rod", "scroll", "potion", "other"];
const RARITIES = ["common", "uncommon", "rare", "very-rare", "legendary", "varies"];
/** The SRD armor of the engine's content (content/armor.json), as key and name. */
const ARMOR: [string, string][] = [
  ["shield", "Shield"], ["padded", "Padded"], ["leather", "Leather"], ["studded", "Studded"], ["hide", "Hide"],
  ["chain-shirt", "Chain Shirt"], ["scale-mail", "Scale mail"], ["breastplate", "Breastplate"], ["half-plate", "Half plate"],
  ["ring-mail", "Ring mail"], ["chain-mail", "Chain mail"], ["splint", "Splint"], ["plate", "Plate"], ["spiked-armor", "Spiked Armor"],
];
/**
 * The base weapon or armor select. Any is the subtype :all, and New weapon
 * the subtype :other, a weapon with its own details (the old "Custom").
 * Specific is the other subtypes, picked with a picker.
 */
const WEAPON_BASES: [string, string][] = [["all", "Any"], ["specific", "Specific"], ["other", "New weapon"]];
const ARMOR_BASES: [string, string][] = [["all", "Any"], ["specific", "Specific"]];
/** The kinds that the old weapon selector offers after New weapon and Any. The weapons follow, sorted by name. */
const WEAPON_KINDS: PickItem[] = [["sword", "All Swords"], ["axe", "All Axes"]].map(([key, name]) => ({ key, name, group: "Kinds" }));
/** The old armor selector's choices after All: the kinds, then the armor. */
const ARMOR_ITEMS: PickItem[] = [
  ...[["light", "All light"], ["medium", "All medium"], ["heavy", "All heavy"]].map(([key, name]) => ({ key, name, group: "Kinds" })),
  ...ARMOR.map(([key, name]) => ({ key, name, group: "Armor" })),
];
/** The properties of a New weapon, each with its field as key and its checkbox name. */
const WEAPON_PROPERTIES = ["Finesse", "Versatile", "Reach", "Two-Handed", "Thrown", "Heavy", "Light", "Ammunition", "Special", "Loading"].map((name) => ({ key: `${name.toLowerCase()}?`, name: `${name}?` }));
/** The fields of a New weapon, which each subtype toggle removes (magic_items.cljc remove-custom-weapon-fields). */
const WEAPON_FIELDS = [...WEAPON_PROPERTIES.map((p) => p.key), "damage-die-count", "damage-die", "versatile", "melee?", "ranged?", "type", "range", "damage-type"];
const DICE: Options = [4, 6, 8, 10, 12, 20, 100].map((die) => [die, `d${die}`]);
/** The alignments of the old attunement checkboxes, after Good and Evil. */
const ALIGNMENTS = ["Lawful Good", "Lawful Neutral", "Lawful Evil", "Neutral Good", "Neutral", "Neutral Evil", "Chaotic Good", "Chaotic Neutral", "Chaotic Evil"];
/** Each ability with its keyword arg, such as :orcpub.dnd.e5.character/str. */
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"].map((ability) => ({ ability, arg: `orcpub.dnd.e5.character/${ability}` }));
const ABILITY_ARGS = ABILITIES.map(({ arg }) => arg);
/** The modifier keys of each speed for each kind of change (magic_items.cljc speed-mod-fn). */
const SPEEDS: { label: string; increases: string; atLeast: string; walking?: string }[] = [
  { label: "Walking speed", increases: "speed", atLeast: "speed-override" },
  { label: "Flying speed", increases: "flying-speed-bonus", atLeast: "flying-speed-override", walking: "flying-speed-equal-to-walking" },
  { label: "Swimming speed", increases: "swimming-speed", atLeast: "swimming-speed-override", walking: "swimming-speed-equal-to-walking" },
  { label: "Climbing speed", increases: "climbing-speed", atLeast: "climbing-speed-override", walking: "climbing-speed-equal-to-walking" },
];

type Mod = Record<string, unknown>;
const MOD_KEY = tag("orcpub.modifiers/key");
const MOD_ARGS = tag("orcpub.modifiers/args");
/** A modifier as the old save stores it (magic_items.cljc mod-cfg): a string arg here is always a keyword. */
function modCfg(key: string, ...args: (string | number)[]): Mod {
  const mod: Mod = { [MOD_KEY]: tag(key) };
  if (args.length > 0) mod[MOD_ARGS] = args.map((arg) => (typeof arg === "number" ? { [tag("orcpub.modifiers/int-arg")]: arg } : { [tag("orcpub.modifiers/keyword-arg")]: tag(arg) }));
  return mod;
}
const modKey = (mod: Mod) => untag(mod[MOD_KEY]);
/** The modifier's arg values: a keyword arg without its "~:". */
const modArgs = (mod: Mod) =>
  ((mod[MOD_ARGS] ?? []) as Record<string, unknown>[]).map((arg) =>
    tag("orcpub.modifiers/int-arg") in arg
      ? Number(arg[tag("orcpub.modifiers/int-arg")])
      : untag(arg[tag("orcpub.modifiers/keyword-arg")] ?? arg[tag("orcpub.modifiers/string-arg")]),
  );

const MODS = tag(MI + "modifiers");
const modsOf = (record: ItemRecord) => (record[MODS] ?? []) as Mod[];
/** The record with the mods; with none, without the key, as setMod stores it. */
function withMods(record: ItemRecord, mods: Mod[]): ItemRecord {
  const next = { ...record, [MODS]: mods };
  if (mods.length === 0) delete next[MODS];
  return next;
}
/** An ability score entry: it increases a score or sets its least value. */
const isAbilityMod = (mod: Mod) => modKey(mod) === "ability" || modKey(mod) === "ability-override";
/** A saving throw bonus entry. */
const isSaveMod = (mod: Mod) => modKey(mod) === "saving-throw-bonus";

/**
 * Where a modifier of the form keeps its values: the entries of the shared
 * :modifiers vector that belongs picks. Each such entry is a value, also one
 * with an int arg of 0, because its control then shows a change, not None.
 */
function modEntries(belongs: (mod: Mod) => boolean): ModifierValues {
  return {
    holds: (record) => modsOf(record).some(belongs),
    clear: (record) => withMods(record, modsOf(record).filter((m) => !belongs(m))),
    // Each entry goes back to the index it had at Remove, in ascending order,
    // or to the end when the vector is now shorter. The other entries keep
    // their order, also when the user changed one of them before Undo.
    // Known limit: when the user deleted an earlier entry of another
    // modifier before Undo, the restored entries are one place later. The
    // engine does not read the order, so the simple rule stays.
    restore: (record, before) => {
      const mods = modsOf(record).filter((m) => !belongs(m));
      modsOf(before).forEach((mod, i) => {
        if (belongs(mod)) mods.splice(Math.min(i, mods.length), 0, mod);
      });
      return withMods(record, mods);
    },
  };
}

/** The one key that a picker's change adds or removes. A picker change is one pick or one removed token. */
const toggledKey = (before: string[], after: string[]) => after.find((key) => !before.includes(key)) ?? before.find((key) => !after.includes(key));

/**
 * A picker whose every pick or removed token toggles one key (onToggle),
 * as the old checkboxes of the form did. value is the stored keys; a key
 * that is no item shows as a token named by its key, and a key stored
 * twice is one token.
 */
function TogglePicker({ label, items, value, search, onToggle, className }: { label: string; items: PickItem[]; value: string[]; search?: boolean; onToggle: (key: string) => void; className?: string }) {
  const keys = [...new Set(value)];
  return (
    <Picker
      label={label}
      options={withOthers(items, keys).map((item) => ({ value: item.key, label: item.name, group: item.group }))}
      value={keys}
      search={search}
      pickedText={pickedText}
      onValueChange={(next) => {
        const key = toggledKey(keys, next);
        if (key !== undefined) onToggle(key);
      }}
      className={className}
    />
  );
}

/**
 * The base weapon or armor: a select of Any, Specific and (for a weapon)
 * New weapon, and with Specific a picker of the subtypes. Any and New
 * weapon toggle :all and :other, and a pick or a removed token toggles its
 * subtype, as the old checkboxes did (onToggle). A subtype that is no
 * option, such as a weapon of a pack that is not enabled, shows as a token.
 */
function BaseItem({
  type,
  subtypes,
  weapons,
  legend,
  errors,
  onToggle,
  onSpecific,
}: {
  type: "weapon" | "armor";
  subtypes: string[];
  weapons: Choice[];
  legend: string;
  errors: string[];
  onToggle: (key: string) => void;
  onSpecific: () => void;
}) {
  const bases = type === "weapon" ? WEAPON_BASES : ARMOR_BASES;
  const has = (key: string) => subtypes.includes(tag(key));
  const base = type === "weapon" && has("other") ? "other" : has("all") ? "all" : "specific";
  const items =
    type === "weapon"
      ? [...WEAPON_KINDS, ...[...weapons].sort((a, b) => a.name.localeCompare(b.name)).map((w) => ({ ...w, group: "Weapons" }))]
      : ARMOR_ITEMS;
  const value = subtypes.map(untag).filter((key) => key !== "all" && (type === "armor" || key !== "other"));
  return (
    <Fieldset legend={legend} look="section" errors={errors}>
      <Select
        aria-label={legend}
        value={base}
        options={bases}
        onValueChange={(next) => (next === "specific" ? onSpecific() : onToggle(next))}
        className="justify-self-start"
      />
      {base === "specific" && (
        <TogglePicker label={type === "weapon" ? "Add a base weapon" : "Add a base armor"} items={items} value={value} search={type === "weapon"} onToggle={onToggle} className="mt-[10px]" />
      )}
    </Fieldset>
  );
}

/**
 * The attunement limits, a picker with search: Spellcaster and the classes,
 * then the alignments. A pick or a removed token is the old
 * toggle-attunement-value (onToggle). With no picks, :attunement is [:any]:
 * any creature can attune to the item. A value that is no option shows as
 * a token.
 */
function AttunementLimits({ attunement, classes, onToggle }: { attunement: string[]; classes: Choice[]; onToggle: (key: string) => void }) {
  const items: PickItem[] = [
    ...[{ key: "spellcaster", name: "Spellcaster" }, ...classes].map((c) => ({ ...c, group: "Classes" })),
    ...["Good", "Evil", ...ALIGNMENTS].map((name) => ({ key: nameToKw(name), name, group: "Alignments" })),
  ];
  const value = attunement.map(untag).filter((key) => key !== "any");
  return (
    <div className="mt-[10px]">
      {value.length === 0 && <Help>No limits: any creature can attune to it.</Help>}
      <TogglePicker label="Add an attunement limit" items={items} value={value} search onToggle={onToggle} />
    </div>
  );
}

function MagicItemForm({ record, onChange, problems }: FormProps) {
  const get = (field: string) => record[tag(MI + field)];
  const change = (fields: Record<string, unknown>) => {
    const next = { ...record };
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) delete next[tag(MI + field)];
      else next[tag(MI + field)] = value;
    }
    onChange(next);
  };
  const type = untag(get("type"));
  const baseLegend = type === "weapon" ? "Base weapon" : "Base armor";
  const subtypes = (get("subtypes") ?? []) as string[];
  const attunement = (get("attunement") ?? []) as string[];
  const mods = modsOf(record);
  // The details of a New weapon.
  const edit = editor(record, onChange);
  const versatile = edit.get(W + "versatile");
  const ranged = edit.get(W + "melee?") !== true && edit.get(W + "ranged?") === true;

  /** Replaces the first modifier that matches with next, or removes it with null, or adds next. */
  function setMod(match: (mod: Mod) => boolean, next: Mod | null) {
    const i = mods.findIndex(match);
    const changed = i < 0 ? (next ? [...mods, next] : mods) : next ? mods.map((m, j) => (j === i ? next : m)) : mods.filter((_, j) => j !== i);
    onChange(withMods(record, changed));
  }
  const findMod = (match: (mod: Mod) => boolean) => mods.find(match);
  /** Specific with no picks, as the old app stores a base weapon picked and then removed: no subtypes, and no details of a New weapon. */
  function specific() {
    const next = { ...record };
    delete next[tag(MI + "subtypes")];
    for (const field of WEAPON_FIELDS) delete next[tag(W + field)];
    onChange(next);
  }

  /**
   * As the old toggle-subtype (magic_items.cljc apply-subtype-toggle): Any
   * (:all) and New weapon (:other) each replace the others, each toggle
   * removes the details of a New weapon, and New weapon sets its first
   * details. On armor, :other is no New weapon: it toggles as any other
   * subtype, so the X of its token removes it.
   */
  function toggleSubtype(key: string) {
    const newWeapon = type === "weapon" && key === "other";
    const clean = subtypes.filter((s) => s !== tag("all") && (type !== "weapon" || s !== tag("other")));
    const nextSubtypes = newWeapon || key === "all" ? [tag(key)] : clean.includes(tag(key)) ? clean.filter((s) => s !== tag(key)) : [...clean, tag(key)];
    const next = { ...record, [tag(MI + "subtypes")]: nextSubtypes };
    if (nextSubtypes.length === 0) delete next[tag(MI + "subtypes")];
    for (const field of WEAPON_FIELDS) delete next[tag(W + field)];
    if (newWeapon) {
      Object.assign(next, {
        [tag(W + "damage-die-count")]: 1,
        [tag(W + "damage-die")]: 4,
        [tag(W + "type")]: tag("simple"),
        [tag(W + "damage-type")]: tag("bludgeoning"),
        [tag(W + "melee?")]: true,
        [tag(W + "ranged?")]: false,
      });
    }
    onChange(next);
  }
  /** As the old toggle-attunement-value: with no value left, the item can be attuned by any creature. */
  function toggleAttunement(key: string) {
    const values = attunement.includes(tag(key)) ? attunement.filter((a) => a !== tag(key)) : [...attunement, tag(key)];
    const clean = values.filter((a) => a !== tag("any"));
    change({ attunement: clean.length === 0 ? [tag("any")] : clean });
  }

  const field = (name: string, label: string, control: ReactNode) => (
    <Field label={label} errors={fieldErrors(problems, MI + name, label)}>
      <FieldLabel label={label}>{control}</FieldLabel>
    </Field>
  );
  const select = (name: string, values: string[], names: (v: string) => string, onSelect: (v: string) => void) => {
    const options = values.map((v): [string, string] => [v, names(v)]);
    return <Select value={orFirst(untag(get(name)), options)} options={options} onValueChange={onSelect} />;
  };
  const bonus = (name: string, label: string) =>
    field(
      name,
      label,
      <NumberField value={numberOrNull(get(name))} onValueChange={(n) => change({ [name]: n ?? undefined })} />,
    );
  /**
   * The entries of one modifier key with a keyword arg, such as the damage
   * resistances, as a picker (magic_items.cljc toggle-mods): a pick adds the
   * entry at the end, and a removed token removes the entries with its arg.
   * An arg that is no option shows as a token.
   */
  const togglePicker = (legend: string, key: string, items: PickItem[], add: string, action: ReactNode) => {
    const isKey = (m: Mod) => modKey(m) === key && typeof modArgs(m)[0] === "string";
    const value = mods.filter(isKey).map((m) => String(modArgs(m)[0]));
    return (
      <Fieldset legend={legend} look="section" action={action}>
        <TogglePicker
          label={add}
          items={items}
          value={value}
          onToggle={(arg) => onChange(withMods(record, value.includes(arg) ? mods.filter((m) => !(isKey(m) && modArgs(m)[0] === arg)) : [...mods, modCfg(key, arg)]))}
        />
      </Fieldset>
    );
  };
  /** A number with how it changes: a select of the modifier key, and its int value. */
  const modRow = (label: string, keys: { key: string; text: string; noValue?: boolean }[], match: (m: Mod) => boolean, args: string[]) => {
    const mod = findMod(match);
    const current = keys.find((k) => mod && modKey(mod) === k.key);
    const value = mod ? modArgs(mod)[args.length] : undefined;
    return (
      <FieldRow key={label} look="tight">
        <FieldLabel label={label}>
          <Select
            aria-label={`${label} change`}
            value={current?.key ?? ""}
            options={[["", "None"], ...keys.map((k): [string, string] => [k.key, k.text])]}
            onValueChange={(next) => {
              const k = keys.find((k) => k.key === next);
              setMod(match, k ? (k.noValue ? modCfg(k.key, ...args) : modCfg(k.key, ...args, typeof value === "number" ? value : 0)) : null);
            }}
          />
        </FieldLabel>
        {current && !current.noValue && (
          <NumberField
            aria-label={`${label} value`}
            value={numberOrNull(value)}
            onValueChange={(n) => setMod(match, modCfg(current.key, ...args, n ?? 0))}
          />
        )}
      </FieldRow>
    );
  };

  /** A modifier of the entries of one modifier key with a keyword arg, also an arg that is no option. */
  const toggleModifier = (id: string, name: string, example: string, items: PickItem[], add: string): Modifier => ({
    id,
    name,
    example,
    ...modEntries((m) => modKey(m) === id && typeof modArgs(m)[0] === "string"),
    render: ({ name, action }) => togglePicker(name, id, items, add, action),
  });
  const speedKeys = SPEEDS.map(({ increases, atLeast, walking }) => [
    { key: atLeast, text: "Becomes at least" },
    { key: increases, text: "Increases by" },
    ...(walking ? [{ key: walking, text: "Equals walking speed", noValue: true }] : []),
  ]);
  /** The modifiers in form order (docs/design/homebrew-forms.md, "Magic item"). */
  const modifiers: Modifier[] = [
    {
      id: "ability",
      name: "Ability scores",
      example: "Strength becomes at least 19, Wisdom increases by 2",
      ...modEntries((m) => isAbilityMod(m) && ABILITY_ARGS.includes(String(modArgs(m)[0]))),
      render: ({ name, action }) => (
        <Fieldset legend={name} look="section" action={action}>
          <FieldRow>
            {ABILITIES.map(({ ability, arg }) =>
              modRow(
                ability.toUpperCase(),
                [
                  { key: "ability-override", text: "Becomes at least" },
                  { key: "ability", text: "Increases by" },
                ],
                (m) => isAbilityMod(m) && modArgs(m)[0] === arg,
                [arg],
              ),
            )}
          </FieldRow>
        </Fieldset>
      ),
    },
    {
      id: "saving-throw-bonus",
      name: "Saving throw bonus",
      example: "+1 to Dexterity saving throws",
      ...modEntries((m) => isSaveMod(m) && ABILITY_ARGS.includes(String(modArgs(m)[0]))),
      render: ({ name, action }) => (
        <Fieldset legend={name} name="Saving throws" look="section" action={action}>
          <FieldRow>
            {ABILITIES.map(({ ability, arg }) =>
              modRow(`${ability.toUpperCase()} save`, [{ key: "saving-throw-bonus", text: "Increases by" }], (m) => isSaveMod(m) && modArgs(m)[0] === arg, [arg]),
            )}
          </FieldRow>
        </Fieldset>
      ),
    },
    {
      id: "speed",
      name: "Speed bonus",
      example: "+10 ft. walking speed, a flying speed",
      ...modEntries((m) => speedKeys.some((keys) => keys.some((k) => k.key === modKey(m)))),
      render: ({ name, action }) => (
        <Fieldset legend={name} name="Speeds" look="section" action={action}>
          <FieldRow>{SPEEDS.map(({ label }, i) => modRow(label, speedKeys[i], (m) => speedKeys[i].some((k) => k.key === modKey(m)), []))}</FieldRow>
        </Fieldset>
      ),
    },
    toggleModifier("damage-resistance", "Damage resistances", "Fire, cold …", DAMAGE_CHOICES, "Add a damage resistance"),
    toggleModifier("damage-vulnerability", "Damage vulnerabilities", "Radiant, necrotic …", DAMAGE_CHOICES, "Add a damage vulnerability"),
    toggleModifier("damage-immunity", "Damage immunities", "Poison, psychic …", DAMAGE_CHOICES, "Add a damage immunity"),
    toggleModifier("condition-immunity", "Condition immunities", "Charmed, frightened …", CONDITION_CHOICES, "Add a condition"),
  ];

  return (
    <WithChoices>
      {({ weapons, classes }) => (
        <FormColumn>
          {field("name", "Name", <TextInput value={String(get("name") ?? "")} onValueChange={(text) => change({ name: text })} />)}
          {field(
            "description",
            "Description",
            <TextArea value={String(get("description") ?? "")} onValueChange={(text) => change({ description: text })} rows={6} />,
          )}
          <FieldRow>
            {/* As the old set-item-type, a new type drops the subtypes. */}
            {field("type", "Type", select("type", TYPES, title, (v) => change({ type: tag(v), subtypes: undefined })))}
            {field("rarity", "Rarity", select("rarity", RARITIES, title, (v) => change({ rarity: tag(v) })))}
          </FieldRow>
          {(type === "weapon" || type === "armor") && <BaseItem type={type} subtypes={subtypes} weapons={weapons} legend={baseLegend} errors={fieldErrors(problems, MI + "subtypes", baseLegend)} onToggle={toggleSubtype} onSpecific={specific} />}
          {type === "weapon" && subtypes.includes(tag("other")) && (
            <Checks
              legend="Base weapon details"
              items={WEAPON_PROPERTIES}
              // As the old toggles: Versatile is a map of its damage dice or absent, and each other property is true or false.
              checked={(key) => (key === "versatile?" ? versatile !== undefined : edit.get(W + key) === true)}
              onToggle={(key) => (key === "versatile?" ? edit.set([W + "versatile"], versatile === undefined ? {} : undefined) : edit.toggle([W + key]))}
            >
              <div className="mt-[10px]">
                <FieldRow>
                  <SelectField label="Damage die number" value={edit.get(W + "damage-die-count")} options={numbers(range(1, 10))} onSelect={(n) => edit.set([W + "damage-die-count"], n)} />
                  <SelectField label="Damage die" value={edit.get(W + "damage-die")} options={DICE} onSelect={(die) => edit.set([W + "damage-die"], die)} />
                  {versatile !== undefined && (
                    <>
                      <SelectField
                        label="Versatile damage die number"
                        value={edit.get(W + "versatile", W + "damage-die-count")}
                        options={numbers(range(1, 10))}
                        onSelect={(n) => edit.set([W + "versatile", W + "damage-die-count"], n)}
                      />
                      <SelectField label="Versatile damage die" value={edit.get(W + "versatile", W + "damage-die")} options={DICE} onSelect={(die) => edit.set([W + "versatile", W + "damage-die"], die)} />
                    </>
                  )}
                  <SelectField label="Simple / martial" value={edit.get(W + "type")} options={["simple", "martial"].map((v) => [tag(v), title(v)])} onSelect={(v) => edit.set([W + "type"], v)} />
                  <SelectField
                    label="Melee / ranged"
                    value={edit.get(W + "melee?") === true ? "melee" : ranged ? "ranged" : undefined}
                    options={["melee", "ranged"].map((v) => [v, title(v)])}
                    onSelect={(v) => onChange({ ...record, [tag(W + "melee?")]: v === "melee", [tag(W + "ranged?")]: v === "ranged" })}
                  />
                  {ranged &&
                    ["min", "max"].map((end) => (
                      <FieldLabel key={end} label={`Range ${end}`}>
                        {/* Only a whole number of 0 or more is a value. */}
                        <NumberField
                          value={numberOrNull(edit.get(W + "range", W + end))}
                          onValueChange={(n) => edit.set([W + "range", W + end], n !== null && n >= 0 ? n : undefined)}
                        />
                      </FieldLabel>
                    ))}
                  <SelectField label="Damage type" value={edit.get(W + "damage-type")} options={DAMAGE_TYPES.map((v) => [tag(v), v])} onSelect={(v) => edit.set([W + "damage-type"], v)} />
                </FieldRow>
              </div>
            </Checks>
          )}
          <Fieldset legend="Attunement" look="section" errors={fieldErrors(problems, MI + "attunement", "Attunement")}>
            <Checkbox label="Requires attunement" checked={attunement.length > 0} onCheckedChange={() => change({ attunement: attunement.length > 0 ? undefined : [tag("any")] })} />
            {attunement.length > 0 && <AttunementLimits attunement={attunement} classes={classes} onToggle={toggleAttunement} />}
          </Fieldset>
          <Fieldset legend="Item properties" look="section">
            <FieldRow>
              {type === "weapon" && bonus("magical-attack-bonus", "Magical attack bonus")}
              {type === "weapon" && bonus("magical-damage-bonus", "Magical damage bonus")}
              {bonus("magical-ac-bonus", "Magical AC bonus")}
            </FieldRow>
          </Fieldset>
          <Modifiers record={record} onChange={onChange} modifiers={modifiers} />
          <FieldErrors label="Modifiers" errors={fieldErrors(problems, MI + "modifiers", "Modifiers")} />
        </FormColumn>
      )}
    </WithChoices>
  );
}

export const magicItemBuilder: BuilderType = {
  validator: "magicItem",
  one: "magic item",
  // The old builder's new item (events.cljs ::mi/reset-item).
  empty: { [tag(MI + "type")]: tag("wondrous-item"), [tag(MI + "rarity")]: tag("common") },
  fields: ["name", "type", "rarity", "description", "subtypes", "attunement", "magical-attack-bonus", "magical-damage-bonus", "magical-ac-bonus", "modifiers"].map(
    (name) => MI + name,
  ),
  Form: MagicItemForm,
  /**
   * Stores the item in the magic items store: an item with a stored key
   * replaces it and keeps its enabled flag, and a new item is enabled. A
   * rename changes the key, so the item under the old key is removed, and
   * the renamed item keeps its enabled flag.
   */
  async save(item, storedKey) {
    const homebrew = useHomebrew.getState();
    const key = magicItemKey(item);
    const old = storedKey === undefined || storedKey === key ? undefined : homebrew.magicItems.find((r) => r.id === storedKey);
    // As the old save (entity.cljc remove-empty-fields), an empty map, such as :versatile without its dice, is not stored.
    const filled = Object.fromEntries(Object.entries(item).filter(([, value]) => !(typeof value === "object" && value !== null && Object.keys(value).length === 0)));
    await homebrew.loadMagicItems([filled]);
    if (old !== undefined) {
      if (!old.enabled) await useHomebrew.getState().setMagicItemEnabled(key, false);
      await useHomebrew.getState().removeMagicItem(old.id);
    }
  },
  load: (key) => useHomebrew.getState().magicItems.find((r) => r.id === key)?.item as ItemRecord | undefined,
  // A new or renamed item must not replace another stored item with its key.
  check(item, storedKey) {
    const key = magicItemKey(item);
    if (key === storedKey || !useHomebrew.getState().magicItems.some((r) => r.id === key)) return [];
    const name = String((item as ItemRecord)[tag(MI + "name")] ?? key);
    return [{ path: [MI + "name"], text: `A magic item named ${name} already exists. Change the name.` }];
  },
};
