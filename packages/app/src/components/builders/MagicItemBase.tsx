// The base weapon or armor section of the magic item form, and the details of a New weapon.
import { FieldLabel, Fieldset, NumberField, Picker, Select } from "@orc-alchemy/ui";
import type { Choice } from "../../engine/builder-choices.ts";
import { tag, untag } from "../../engine/content.ts";
import { Checks, DAMAGE_TYPES, editor, FieldRow, type FormProps, numberOrNull, numbers, type Options, range, SelectField, title } from "./fields.tsx";
import { type PickItem, pickedText, withOthers } from "./picker-fields.tsx";

const W = "orcpub.dnd.e5.weapons/";

/** The SRD armor of the engine's content (content/armor.json), as key and name. */
const ARMOR: [string, string][] = [
  ["shield", "Shield"],
  ["padded", "Padded"],
  ["leather", "Leather"],
  ["studded", "Studded"],
  ["hide", "Hide"],
  ["chain-shirt", "Chain Shirt"],
  ["scale-mail", "Scale mail"],
  ["breastplate", "Breastplate"],
  ["half-plate", "Half plate"],
  ["ring-mail", "Ring mail"],
  ["chain-mail", "Chain mail"],
  ["splint", "Splint"],
  ["plate", "Plate"],
  ["spiked-armor", "Spiked Armor"],
];
/**
 * The base weapon or armor select. Any is the subtype :all, and New weapon
 * the subtype :other, a weapon with its own details (the old "Custom").
 * Specific is the other subtypes, picked with a picker.
 */
const WEAPON_BASES: [string, string][] = [
  ["all", "Any"],
  ["specific", "Specific"],
  ["other", "New weapon"],
];
const ARMOR_BASES: [string, string][] = [
  ["all", "Any"],
  ["specific", "Specific"],
];
/** The kinds that the old weapon selector offers after Custom and All (now New weapon and Any). The weapons follow, sorted by name. */
const WEAPON_KINDS: PickItem[] = [
  ["sword", "All Swords"],
  ["axe", "All Axes"],
].map(([key, name]) => ({ key, name, group: "Kinds" }));
/** The old armor selector's choices after All (now Any): the kinds, then the armor. */
const ARMOR_ITEMS: PickItem[] = [
  ...[
    ["light", "All light"],
    ["medium", "All medium"],
    ["heavy", "All heavy"],
  ].map(([key, name]) => ({ key, name, group: "Kinds" })),
  ...ARMOR.map(([key, name]) => ({ key, name, group: "Armor" })),
];
/** The properties of a New weapon, each with its field as key and its checkbox name. */
const WEAPON_PROPERTIES = ["Finesse", "Versatile", "Reach", "Two-Handed", "Thrown", "Heavy", "Light", "Ammunition", "Special", "Loading"].map((name) => ({
  key: `${name.toLowerCase()}?`,
  name: `${name}?`,
}));
/** The fields of a New weapon, which each subtype toggle removes (magic_items.cljc remove-custom-weapon-fields). */
export const WEAPON_FIELDS = [
  ...WEAPON_PROPERTIES.map((p) => p.key),
  "damage-die-count",
  "damage-die",
  "versatile",
  "melee?",
  "ranged?",
  "type",
  "range",
  "damage-type",
];
const DICE: Options = [4, 6, 8, 10, 12, 20, 100].map((die) => [die, `d${die}`]);

/** The one key that a picker's change adds or removes. A picker change is one pick or one removed token. */
const toggledKey = (before: string[], after: string[]) => after.find((key) => !before.includes(key)) ?? before.find((key) => !after.includes(key));

/**
 * A picker whose every pick or removed token toggles one key (onToggle),
 * as the old checkboxes of the form did. value is the stored keys; a key
 * that is no item shows as a token named by its key, and a key stored
 * twice is one token.
 */
export function TogglePicker({
  label,
  items,
  value,
  search,
  onToggle,
  className,
}: {
  label: string;
  items: PickItem[];
  value: string[];
  search?: boolean;
  onToggle: (key: string) => void;
  className?: string;
}) {
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
export function BaseItem({
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
    type === "weapon" ? [...WEAPON_KINDS, ...[...weapons].sort((a, b) => a.name.localeCompare(b.name)).map((w) => ({ ...w, group: "Weapons" }))] : ARMOR_ITEMS;
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
        <TogglePicker
          label={type === "weapon" ? "Add a base weapon" : "Add a base armor"}
          items={items}
          value={value}
          search={type === "weapon"}
          onToggle={onToggle}
          className="mt-[10px]"
        />
      )}
    </Fieldset>
  );
}

/** The details of a New weapon: its properties, its damage, its kind and its range, in :orcpub.dnd.e5.weapons/ fields. */
export function NewWeaponDetails({ record, onChange }: Pick<FormProps, "record" | "onChange">) {
  const edit = editor(record, onChange);
  const versatile = edit.get(W + "versatile");
  const ranged = edit.get(W + "melee?") !== true && edit.get(W + "ranged?") === true;
  return (
    <Checks
      legend="Base weapon details"
      items={WEAPON_PROPERTIES}
      // As the old toggles: Versatile is a map of its damage dice or absent, and each other property is true or false.
      checked={(key) => (key === "versatile?" ? versatile !== undefined : edit.get(W + key) === true)}
      onToggle={(key) => (key === "versatile?" ? edit.set([W + "versatile"], versatile === undefined ? {} : undefined) : edit.toggle([W + key]))}
    >
      <div className="mt-[10px]">
        <FieldRow>
          <SelectField
            label="Damage die number"
            value={edit.get(W + "damage-die-count")}
            options={numbers(range(1, 10))}
            onSelect={(n) => edit.set([W + "damage-die-count"], n)}
          />
          <SelectField label="Damage die" value={edit.get(W + "damage-die")} options={DICE} onSelect={(die) => edit.set([W + "damage-die"], die)} />
          {versatile !== undefined && (
            <>
              <SelectField
                label="Versatile damage die number"
                value={edit.get(W + "versatile", W + "damage-die-count")}
                options={numbers(range(1, 10))}
                onSelect={(n) => edit.set([W + "versatile", W + "damage-die-count"], n)}
              />
              <SelectField
                label="Versatile damage die"
                value={edit.get(W + "versatile", W + "damage-die")}
                options={DICE}
                onSelect={(die) => edit.set([W + "versatile", W + "damage-die"], die)}
              />
            </>
          )}
          <SelectField
            label="Simple / martial"
            value={edit.get(W + "type")}
            options={["simple", "martial"].map((v) => [tag(v), title(v)])}
            onSelect={(v) => edit.set([W + "type"], v)}
          />
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
          <SelectField
            label="Damage type"
            value={edit.get(W + "damage-type")}
            options={DAMAGE_TYPES.map((v) => [tag(v), v])}
            onSelect={(v) => edit.set([W + "damage-type"], v)}
          />
        </FieldRow>
      </div>
    </Checks>
  );
}
