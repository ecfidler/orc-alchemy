// The magic item form of the homebrew builder, with the fields of the old
// app's item builder (views.cljs item-builder). The item is stored as the
// old server stored it, in the form readServerEdn returns (magic_items.cljc
// from-internal-item): namespaced keys, keyword values, :subtypes and
// :attunement as keyword vectors, and :modifiers as mod-cfg maps of a
// :orcpub.modifiers/key and its keyword or int args. The engine expands a
// weapon or armor with subtypes into one option for each base item. Magic
// items are not in packs: save and load use the magic items store.
import type { ReactNode } from "react";
import { tag, untag } from "../../engine/content.ts";
import { magicItemKey } from "../../engine/import.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { CONDITIONS, DAMAGE_TYPES, FieldProblems, nameToKey, title, type BuilderType, type FormProps, type ItemRecord } from "./fields.tsx";

const MI = "orcpub.dnd.e5.magic-items/";

/** The old builder's types and rarities (subs.cljs ::mi/item-types, ::mi/rarities). */
const TYPES = ["wondrous-item", "weapon", "armor", "ring", "wand", "rod", "scroll", "potion", "other"];
const RARITIES = ["common", "uncommon", "rare", "very-rare", "legendary", "varies"];
/** The SRD weapons and armor of the engine's content (content/weapons.json, content/armor.json), as key and name. */
const WEAPONS: [string, string][] = [
  ["crossbow-light", "Crossbow, light"], ["dart", "Dart"], ["shortbow", "Shortbow"], ["sling", "Sling"], ["club", "Club"],
  ["dagger", "Dagger"], ["greatclub", "Greatclub"], ["handaxe", "Handaxe"], ["javelin", "Javelin"], ["light-hammer", "Light hammer"],
  ["mace", "Mace"], ["quarterstaff", "Quarterstaff"], ["sickle", "Sickle"], ["spear", "Spear"], ["battleaxe", "Battleaxe"],
  ["flail", "Flail"], ["glaive", "Glaive"], ["greataxe", "Greataxe"], ["greatsword", "Greatsword"], ["halberd", "Halberd"],
  ["lance", "Lance"], ["longsword", "Longsword"], ["maul", "Maul"], ["morningstar", "Morningstar"], ["pike", "Pike"],
  ["rapier", "Rapier"], ["scimitar", "Scimitar"], ["shortsword", "Shortsword"], ["trident", "Trident"], ["war-pick", "War pick"],
  ["warhammer", "Warhammer"], ["whip", "Whip"], ["blowgun", "Blowgun"], ["crossbow-hand", "Crossbow, hand"],
  ["crossbow-heavy", "Crossbow, heavy"], ["longbow", "Longbow"], ["net", "Net"], ["firearm-hand", "Firearm, Hand (DMV)"],
  ["firearm-burst", "Firearm, Burst (DMV)"], ["firearm-long", "Firearm, Long (DMV)"],
];
const ARMOR: [string, string][] = [
  ["shield", "Shield"], ["padded", "Padded"], ["leather", "Leather"], ["studded", "Studded"], ["hide", "Hide"],
  ["chain-shirt", "Chain Shirt"], ["scale-mail", "Scale mail"], ["breastplate", "Breastplate"], ["half-plate", "Half plate"],
  ["ring-mail", "Ring mail"], ["chain-mail", "Chain mail"], ["splint", "Splint"], ["plate", "Plate"], ["spiked-armor", "Spiked Armor"],
];
/** The base items each subtype selector offers, after its "All" choices, as the old selectors list them. */
const WEAPON_SUBTYPES: [string, string][] = [["all", "All"], ["sword", "All Swords"], ["axe", "All Axes"], ...[...WEAPONS].sort((a, b) => a[1].localeCompare(b[1]))];
const ARMOR_SUBTYPES: [string, string][] = [["all", "All"], ["light", "All light"], ["medium", "All medium"], ["heavy", "All heavy"], ...ARMOR];
const CLASSES = ["barbarian", "bard", "cleric", "druid", "fighter", "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"];
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
  const subtypes = (get("subtypes") ?? []) as string[];
  const attunement = (get("attunement") ?? []) as string[];
  const mods = (get("modifiers") ?? []) as Mod[];

  /** Replaces the first modifier that matches with next, or removes it with null, or adds next. */
  function setMod(match: (mod: Mod) => boolean, next: Mod | null) {
    const i = mods.findIndex(match);
    const changed = i < 0 ? (next ? [...mods, next] : mods) : next ? mods.map((m, j) => (j === i ? next : m)) : mods.filter((_, j) => j !== i);
    change({ modifiers: changed.length === 0 ? undefined : changed });
  }
  const findMod = (match: (mod: Mod) => boolean) => mods.find(match);

  /** As the old toggle-subtype (magic_items.cljc apply-subtype-toggle): All replaces the others. */
  function toggleSubtype(key: string) {
    const clean = subtypes.filter((s) => s !== tag("all") && s !== tag("other"));
    const next = key === "all" ? [tag("all")] : clean.includes(tag(key)) ? clean.filter((s) => s !== tag(key)) : [...clean, tag(key)];
    change({ subtypes: next.length === 0 ? undefined : next });
  }
  /** As the old toggle-attunement-value: with no value left, the item can be attuned by any creature. */
  function toggleAttunement(key: string) {
    const values = attunement.includes(tag(key)) ? attunement.filter((a) => a !== tag(key)) : [...attunement, tag(key)];
    const clean = values.filter((a) => a !== tag("any"));
    change({ attunement: clean.length === 0 ? [tag("any")] : clean });
  }

  const field = (name: string, label: string, control: ReactNode) => (
    <div>
      <label className="block">
        {label} {control}
      </label>
      <FieldProblems problems={problems} field={MI + name} label={label} />
    </div>
  );
  const select = (name: string, values: string[], names: (v: string) => string, onSelect: (v: string) => void) => (
    <select value={untag(get(name))} onChange={(e) => onSelect(e.target.value)} className="border border-black">
      {values.map((v) => (
        <option key={v} value={v}>
          {names(v)}
        </option>
      ))}
    </select>
  );
  const bonus = (name: string, label: string) =>
    field(
      name,
      label,
      <input
        type="number"
        value={String(get(name) ?? "")}
        onChange={(e) => change({ [name]: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })}
        className="w-16 border border-black px-1"
      />,
    );
  const check = (label: string, checked: boolean, onToggle: () => void, disabled = false) => (
    <label key={label} className="mr-4 inline-block">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} /> {label}
    </label>
  );
  /** A modifier with one keyword arg, on or off, such as a damage resistance (magic_items.cljc toggle-mods). */
  const toggles = (legend: string, key: string, values: string[]) => (
    <fieldset aria-label={legend}>
      <legend>{legend}</legend>
      {values.map((value) => {
        const match = (m: Mod) => modKey(m) === key && modArgs(m)[0] === value;
        return check(title(value), findMod(match) !== undefined, () => setMod(match, findMod(match) ? null : modCfg(key, value)));
      })}
    </fieldset>
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
          <select
            aria-label={`${label} change`}
            value={current?.key ?? ""}
            onChange={(e) => {
              const k = keys.find((k) => k.key === e.target.value);
              setMod(match, k ? (k.noValue ? modCfg(k.key, ...args) : modCfg(k.key, ...args, typeof value === "number" ? value : 0)) : null);
            }}
            className="border border-black"
          >
            <option value="">None</option>
            {keys.map((k) => (
              <option key={k.key} value={k.key}>
                {k.text}
              </option>
            ))}
          </select>
        </label>{" "}
        {current && !current.noValue && (
          <input
            type="number"
            aria-label={`${label} value`}
            value={typeof value === "number" ? String(value) : ""}
            onChange={(e) => setMod(match, modCfg(current.key, ...args, parseInt(e.target.value, 10) || 0))}
            className="w-16 border border-black px-1"
          />
        )}
      </div>
    );
  };

  return (
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
        <fieldset aria-label={type === "weapon" ? "Base weapon" : "Base armor"}>
          <legend>{type === "weapon" ? "Base weapon" : "Base armor"}</legend>
          {(type === "weapon" ? WEAPON_SUBTYPES : ARMOR_SUBTYPES).map(([key, name]) => check(name, subtypes.includes(tag(key)), () => toggleSubtype(key)))}
          <FieldProblems problems={problems} field={MI + "subtypes"} label="Base item" />
        </fieldset>
      )}
      <fieldset aria-label="Attunement">
        <legend>Attunement</legend>
        {check("Requires attunement", attunement.length > 0, () => change({ attunement: attunement.length > 0 ? undefined : [tag("any")] }))}
        {attunement.length > 0 && (
          <div>
            {check("Any", attunement.length === 1 && attunement[0] === tag("any"), () => {}, true)}
            <div>
              Class:{" "}
              {["spellcaster", ...CLASSES].map((key) => check(title(key), attunement.includes(tag(key)), () => toggleAttunement(key)))}
            </div>
            <div>
              Alignment:{" "}
              {["Good", "Evil", ...ALIGNMENTS].map((name) => check(name, attunement.includes(tag(nameToKey(name))), () => toggleAttunement(nameToKey(name))))}
            </div>
          </div>
        )}
        <FieldProblems problems={problems} field={MI + "attunement"} label="Attunement" />
      </fieldset>
      <fieldset>
        <legend>Item properties</legend>
        {type === "weapon" && bonus("magical-attack-bonus", "Magical attack bonus")}
        {type === "weapon" && bonus("magical-damage-bonus", "Magical damage bonus")}
        {bonus("magical-ac-bonus", "Magical AC bonus")}
      </fieldset>
      <fieldset aria-label="Ability scores">
        <legend>Ability scores</legend>
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
      </fieldset>
      <fieldset aria-label="Saving throws">
        <legend>Saving throw bonus</legend>
        {ABILITIES.map((ability) => {
          const arg = `orcpub.dnd.e5.character/${ability}`;
          return modRow(`${ability.toUpperCase()} save`, [{ key: "saving-throw-bonus", text: "Increases by" }], (m) => modKey(m) === "saving-throw-bonus" && modArgs(m)[0] === arg, [arg]);
        })}
      </fieldset>
      <fieldset aria-label="Speeds">
        <legend>Speed bonus</legend>
        {SPEEDS.map(({ label, increases, atLeast, walking }) => {
          const keys = [
            { key: atLeast, text: "Becomes at least" },
            { key: increases, text: "Increases by" },
            ...(walking ? [{ key: walking, text: "Equals walking speed", noValue: true }] : []),
          ];
          return modRow(label, keys, (m) => keys.some((k) => k.key === modKey(m)), []);
        })}
      </fieldset>
      {toggles("Damage resistances", "damage-resistance", DAMAGE_TYPES)}
      {toggles("Damage vulnerabilities", "damage-vulnerability", DAMAGE_TYPES)}
      {toggles("Damage immunities", "damage-immunity", DAMAGE_TYPES)}
      {toggles("Condition immunities", "condition-immunity", CONDITIONS.map(nameToKey))}
      <FieldProblems problems={problems} field={MI + "modifiers"} label="Modifiers" />
    </div>
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
    await homebrew.loadMagicItems([item]);
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
