// The magic item form of the homebrew builder, with the fields of the old
// app's item builder (views.cljs item-builder). The item is stored as the
// old server stored it, in the form readServerEdn returns (magic_items.cljc
// from-internal-item): namespaced keys, keyword values, :subtypes and
// :attunement as keyword vectors, and :modifiers as mod-cfg maps of a
// :orcpub.modifiers/key and its keyword or int args. The engine expands a
// weapon or armor with subtypes into one option for each base item. A
// Custom base weapon (the subtype :other) has its own details in
// :orcpub.dnd.e5.weapons/ fields. Magic items are not in packs: save and
// load use the magic items store.
import { Checkbox, Field, FieldErrors, Fieldset, NumberField, Select } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import { tag, untag } from "../../engine/content.ts";
import { magicItemKey } from "../../engine/import.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { CONDITIONS, DAMAGE_TYPES, editor, fieldErrors, nameToKw, numberOrNull, numbers, orFirst, range, SelectField, title, WithChoices, type BuilderType, type FormProps, type ItemRecord, type Options } from "./fields.tsx";

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
/** The choices the old weapon selector offers before the weapons, which follow sorted by name. */
const WEAPON_SUBTYPES: [string, string][] = [["other", "Custom"], ["all", "All"], ["sword", "All Swords"], ["axe", "All Axes"]];
/** The choices the old armor selector offers: its "All" choices, then the armor. */
const ARMOR_SUBTYPES: [string, string][] = [["all", "All"], ["light", "All light"], ["medium", "All medium"], ["heavy", "All heavy"], ...ARMOR];
/** The properties of a Custom base weapon, each with its checkbox name and its field. */
const WEAPON_PROPERTIES = ["Finesse", "Versatile", "Reach", "Two-Handed", "Thrown", "Heavy", "Light", "Ammunition", "Special", "Loading"].map((name) => ({ name, field: `${name.toLowerCase()}?` }));
/** The fields of a Custom base weapon, which each subtype toggle removes (magic_items.cljc remove-custom-weapon-fields). */
const WEAPON_FIELDS = [...WEAPON_PROPERTIES.map((p) => p.field), "damage-die-count", "damage-die", "versatile", "melee?", "ranged?", "type", "range", "damage-type"];
const DICE: Options = [4, 6, 8, 10, 12, 20, 100].map((die) => [die, `d${die}`]);
const ALIGNMENTS = ["Lawful Good", "Lawful Neutral", "Lawful Evil", "Neutral Good", "Neutral", "Neutral Evil", "Chaotic Good", "Chaotic Neutral", "Chaotic Evil"];
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
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
  const mods = (get("modifiers") ?? []) as Mod[];
  // The details of a Custom base weapon.
  const edit = editor(record, onChange);
  const versatile = edit.get(W + "versatile");
  const ranged = edit.get(W + "melee?") !== true && edit.get(W + "ranged?") === true;

  /** Replaces the first modifier that matches with next, or removes it with null, or adds next. */
  function setMod(match: (mod: Mod) => boolean, next: Mod | null) {
    const i = mods.findIndex(match);
    const changed = i < 0 ? (next ? [...mods, next] : mods) : next ? mods.map((m, j) => (j === i ? next : m)) : mods.filter((_, j) => j !== i);
    change({ modifiers: changed.length === 0 ? undefined : changed });
  }
  const findMod = (match: (mod: Mod) => boolean) => mods.find(match);

  /**
   * As the old toggle-subtype (magic_items.cljc apply-subtype-toggle): Custom
   * and All each replace the others, each toggle removes the details of a
   * Custom weapon, and Custom sets its first details.
   */
  function toggleSubtype(key: string) {
    const clean = subtypes.filter((s) => s !== tag("all") && s !== tag("other"));
    const nextSubtypes = key === "other" || key === "all" ? [tag(key)] : clean.includes(tag(key)) ? clean.filter((s) => s !== tag(key)) : [...clean, tag(key)];
    const next = { ...record, [tag(MI + "subtypes")]: nextSubtypes };
    if (nextSubtypes.length === 0) delete next[tag(MI + "subtypes")];
    for (const field of WEAPON_FIELDS) delete next[tag(W + field)];
    if (key === "other") {
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
      <label className="block">
        {label} {control}
      </label>
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
  const check = (label: string, checked: boolean, onToggle: () => void, disabled = false) => (
    <Checkbox key={label} label={label} checked={checked} disabled={disabled} onCheckedChange={onToggle} className="mr-4" />
  );
  /** A modifier with one keyword arg, on or off, such as a damage resistance (magic_items.cljc toggle-mods). */
  const toggles = (legend: string, key: string, values: string[]) => (
    <Fieldset legend={legend}>
      {values.map((value) => {
        const match = (m: Mod) => modKey(m) === key && modArgs(m)[0] === value;
        return check(title(value), findMod(match) !== undefined, () => setMod(match, findMod(match) ? null : modCfg(key, value)));
      })}
    </Fieldset>
  );
  /** A number with how it changes: a select of the modifier key, and its int value. */
  const modRow = (label: string, keys: { key: string; text: string; noValue?: boolean }[], match: (m: Mod) => boolean, args: string[]) => {
    const mod = findMod(match);
    const current = keys.find((k) => mod && modKey(mod) === k.key);
    const value = mod ? modArgs(mod)[args.length] : undefined;
    return (
      <div key={label}>
        <label>
          {label}{" "}
          <Select
            aria-label={`${label} change`}
            value={current?.key ?? ""}
            options={[["", "None"], ...keys.map((k): [string, string] => [k.key, k.text])]}
            onValueChange={(next) => {
              const k = keys.find((k) => k.key === next);
              setMod(match, k ? (k.noValue ? modCfg(k.key, ...args) : modCfg(k.key, ...args, typeof value === "number" ? value : 0)) : null);
            }}
          />
        </label>{" "}
        {current && !current.noValue && (
          <NumberField
            aria-label={`${label} value`}
            value={numberOrNull(value)}
            onValueChange={(n) => setMod(match, modCfg(current.key, ...args, n ?? 0))}
          />
        )}
      </div>
    );
  };

  return (
    <WithChoices>
      {({ weapons, classes }) => (
        <div className="space-y-3">
          {field(
            "name",
            "Name",
            <input type="text" value={String(get("name") ?? "")} onChange={(e) => change({ name: e.target.value })} className="border border-black px-1" />,
          )}
          {/* As the old set-item-type, a new type drops the subtypes. */}
          {field("type", "Type", select("type", TYPES, title, (v) => change({ type: tag(v), subtypes: undefined })))}
          {field("rarity", "Rarity", select("rarity", RARITIES, title, (v) => change({ rarity: tag(v) })))}
          {field(
            "description",
            "Description",
            <textarea value={String(get("description") ?? "")} onChange={(e) => change({ description: e.target.value })} className="block w-full border border-black" rows={6} />,
          )}
          {(type === "weapon" || type === "armor") && (
            <Fieldset legend={baseLegend} errors={fieldErrors(problems, MI + "subtypes", baseLegend)}>
              {(type === "weapon" ? WEAPON_SUBTYPES : ARMOR_SUBTYPES).map(([key, name]) => check(name, subtypes.includes(tag(key)), () => toggleSubtype(key)))}
              {type === "weapon" && [...weapons].sort((a, b) => a.name.localeCompare(b.name)).map(({ key, name }) => check(name, subtypes.includes(tag(key)), () => toggleSubtype(key)))}
            </Fieldset>
          )}
          {type === "weapon" && subtypes.includes(tag("other")) && (
            <Fieldset legend="Base weapon details">
              <div>
                {/* As the old toggles: Versatile is a map of its damage dice or absent, and each other property is true or false. */}
                {WEAPON_PROPERTIES.map(({ name, field }) =>
                  name === "Versatile"
                    ? check("Versatile?", versatile !== undefined, () => edit.set([W + "versatile"], versatile === undefined ? {} : undefined))
                    : check(`${name}?`, edit.get(W + field) === true, () => edit.toggle([W + field])),
                )}
              </div>
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
                  <label key={end} className="mr-4 inline-block">
                    Range {end}{" "}
                    {/* Only a whole number of 0 or more is a value. */}
                    <NumberField
                      value={numberOrNull(edit.get(W + "range", W + end))}
                      onValueChange={(n) => edit.set([W + "range", W + end], n !== null && n >= 0 ? n : undefined)}
                    />
                  </label>
                ))}
              <SelectField label="Damage type" value={edit.get(W + "damage-type")} options={DAMAGE_TYPES.map((v) => [tag(v), v])} onSelect={(v) => edit.set([W + "damage-type"], v)} />
            </Fieldset>
          )}
          <Fieldset legend="Attunement" errors={fieldErrors(problems, MI + "attunement", "Attunement")}>
            {check("Requires attunement", attunement.length > 0, () => change({ attunement: attunement.length > 0 ? undefined : [tag("any")] }))}
            {attunement.length > 0 && (
              <div>
                {check("Any", attunement.length === 1 && attunement[0] === tag("any"), () => {}, true)}
                <div>
                  Class:{" "}
                  {check("Spellcaster", attunement.includes(tag("spellcaster")), () => toggleAttunement("spellcaster"))}
                  {classes.map(({ key, name }) => check(name, attunement.includes(tag(key)), () => toggleAttunement(key)))}
                </div>
                <div>
                  Alignment:{" "}
                  {["Good", "Evil", ...ALIGNMENTS].map((name) => check(name, attunement.includes(tag(nameToKw(name))), () => toggleAttunement(nameToKw(name))))}
                </div>
              </div>
            )}
          </Fieldset>
          <Fieldset legend="Item properties">
            {type === "weapon" && bonus("magical-attack-bonus", "Magical attack bonus")}
            {type === "weapon" && bonus("magical-damage-bonus", "Magical damage bonus")}
            {bonus("magical-ac-bonus", "Magical AC bonus")}
          </Fieldset>
          <Fieldset legend="Ability scores">
            {ABILITIES.map((ability) => {
              const arg = `orcpub.dnd.e5.character/${ability}`;
              return modRow(
                ability.toUpperCase(),
                [
                  { key: "ability-override", text: "Becomes at least" },
                  { key: "ability", text: "Increases by" },
                ],
                (m) => (modKey(m) === "ability" || modKey(m) === "ability-override") && modArgs(m)[0] === arg,
                [arg],
              );
            })}
          </Fieldset>
          <Fieldset legend="Saving throw bonus" name="Saving throws">
            {ABILITIES.map((ability) => {
              const arg = `orcpub.dnd.e5.character/${ability}`;
              return modRow(`${ability.toUpperCase()} save`, [{ key: "saving-throw-bonus", text: "Increases by" }], (m) => modKey(m) === "saving-throw-bonus" && modArgs(m)[0] === arg, [arg]);
            })}
          </Fieldset>
          <Fieldset legend="Speed bonus" name="Speeds">
            {SPEEDS.map(({ label, increases, atLeast, walking }) => {
              const keys = [
                { key: atLeast, text: "Becomes at least" },
                { key: increases, text: "Increases by" },
                ...(walking ? [{ key: walking, text: "Equals walking speed", noValue: true }] : []),
              ];
              return modRow(label, keys, (m) => keys.some((k) => k.key === modKey(m)), []);
            })}
          </Fieldset>
          {toggles("Damage resistances", "damage-resistance", DAMAGE_TYPES)}
          {toggles("Damage vulnerabilities", "damage-vulnerability", DAMAGE_TYPES)}
          {toggles("Damage immunities", "damage-immunity", DAMAGE_TYPES)}
          {toggles("Condition immunities", "condition-immunity", CONDITIONS.map(nameToKw))}
          <FieldErrors label="Modifiers" errors={fieldErrors(problems, MI + "modifiers", "Modifiers")} />
        </div>
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
