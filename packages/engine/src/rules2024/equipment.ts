// Equipment from the equipment records of the content (ORC-228): the armor,
// the Shield and the weapons that the character uses, the items that the
// character carries, Weapon Mastery, and starting equipment (SRD 5.2.1 p89
// to p103).
//
// The base of the built character cannot read the content, so each option
// puts the numbers of its record on the sheet: the armor table row, or the
// weapon table row. The derived values read them there.

import type { z } from "zod";
import type { ModifierOptions } from "../core/modifiers.ts";
import { type Option, type OptionParts, option, type Selection, selection } from "../core/template.ts";
import { parseReference, referenceTo, SRD_PACK } from "../format/keys.ts";
import type { EquipmentItem, EquipmentOption, Records } from "../format/schema.ts";
import { ADD_ORDER, type ArmorStats, type Built2024, m, type WeaponStats } from "./built.ts";
import { type Content, findRecord, recordsOf } from "./content.ts";

type EquipmentRecord = Records["equipment"];

const equipmentOf = (content: Content, test: (record: EquipmentRecord) => boolean) => recordsOf(content, "equipment").filter(({ record }) => test(record));

/** The equipment records of a category, for example "gaming-set". */
export const equipmentInCategory = (content: Content, category: string) => equipmentOf(content, (record) => record.category === category);

/** The armor options: each one wears the armor (SRD 5.2.1 p92). */
export function armorOptions(content: Content): Option<Built2024>[] {
  return equipmentOf(content, (record) => record.armor !== undefined && record.armor.category !== "shield").map(({ reference, record }) => {
    const stats: ArmorStats = { key: reference, name: record.name, ...(record.armor as NonNullable<EquipmentRecord["armor"]>) };
    const { base, dexLimit, strength } = stats;
    return option<Built2024>({
      key: reference,
      name: record.name,
      modifiers: [
        m.set("wornArmor", reference),
        m.set("wornArmorStats", stats),
        // The base of the armor, with the Dexterity modifier up to the limit of the armor.
        // Heavy armor (limit 0) has no Dexterity term, so a penalty does not apply to it.
        m.add("baseArmorClass", (q) => base + (dexLimit === 0 ? 0 : Math.min(q("abilityModifiers").dex, dexLimit ?? Number.POSITIVE_INFINITY)), {
          deps: ["abilityModifiers"],
        }),
        // Without the Strength score of the armor, the Speed is 10 feet less.
        ...(strength
          ? [
              m.add("speed", -10, {
                deps: ["abilities"],
                when: (q) => q("abilities").str < strength,
                name: `${record.name}: Strength ${strength}`,
                order: ADD_ORDER,
              }),
            ]
          : []),
      ],
    });
  });
}

/** The Shield options. A Shield adds its bonus only with Shield training (SRD 5.2.1 p92). */
export function shieldOptions(content: Content): Option<Built2024>[] {
  return equipmentOf(content, (record) => record.armor?.category === "shield").map(({ reference, record }) =>
    option<Built2024>({
      key: reference,
      name: record.name,
      modifiers: [
        m.set("shield", true),
        m.add("armorClass", record.armor?.base ?? 0, { deps: ["armorTraining"], when: (q) => q("armorTraining").includes("shield") }),
      ],
    }),
  );
}

const weaponRecords = (content: Content) => equipmentOf(content, (record) => record.weapon !== undefined);

/**
 * The damage type reference of a weapon. The weapon record names the type by
 * its key: the type of the pack of the weapon, else of any loaded pack. When
 * no loaded pack has the type, the reference names the SRD pack, which has
 * the damage types of the rules.
 */
function damageTypeOf(content: Content, weapon: string, key: string): string {
  const own = referenceTo(parseReference(weapon).pack, key);
  if (findRecord(content, "damageTypes", own)) return own;
  return recordsOf(content, "damageTypes").find(({ record }) => record.key === key)?.reference ?? referenceTo(SRD_PACK, key);
}

/** The weapon options: each one puts the weapon among the weapons that the character uses. */
export function weaponOptions(content: Content): Option<Built2024>[] {
  return weaponRecords(content).map(({ reference, record }) => {
    const weapon = record.weapon as NonNullable<EquipmentRecord["weapon"]>;
    const stats: WeaponStats = { key: reference, name: record.name, ...weapon, damageType: damageTypeOf(content, reference, weapon.damage.type) };
    return option<Built2024>({ key: reference, name: record.name, modifiers: [m.push("weapons", stats)] });
  });
}

/**
 * The items that the character carries. The value of an option is the
 * quantity, 1 when the option has none.
 */
export function carriedItemOptions(content: Content): Option<Built2024>[] {
  return recordsOf(content, "equipment").map(({ reference, record }) =>
    option<Built2024>({
      key: reference,
      name: record.name,
      modifiers: [
        m.deferred(
          (value) => m.push("inventory", { item: reference, quantity: typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1 }),
          1,
        ),
      ],
    }),
  );
}

/**
 * The Weapon Mastery choice of a class: `count` kinds of weapons. Every
 * occurrence stores its choices at the same ref, so the counts of the class
 * levels add up to one pool. A player changes a choice on a Long Rest by
 * choosing the same selection again. With `melee`, the options are the
 * Melee weapons only, as for the Barbarian (SRD 5.2.1 p29).
 */
export function weaponMasterySelection(content: Content, count: number, { melee = false }: { melee?: boolean } = {}): Selection<Built2024> {
  return selection({
    name: "Weapon Mastery",
    ref: ["weapon-mastery"],
    min: count,
    max: count,
    multiselect: true,
    tags: ["weapon-mastery"],
    options: weaponRecords(content)
      .filter(({ record }) => !melee || record.weapon?.ranged === false)
      .map(({ reference, record }) => option<Built2024>({ key: reference, name: record.name, modifiers: [m.push("weaponMasteries", reference)] })),
  });
}

/** "Holy Symbol" for the category key "holy-symbol". */
function categoryName(category: string): string {
  return category
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The starting equipment choice of a class or a background: option A, B or
 * C, each with its items and gold (SRD 5.2.1 p23). An item can be one of an
 * equipment category, which opens a choice, or the tool that the player chose
 * in the typed tool field of the record (`chosenTools`). Only the first class
 * of a character gives its starting equipment (SRD 5.2.1 p24), so with
 * `firstClass` the choice is offered, and its items given, only when the
 * record is the first class.
 */
export function startingEquipmentSelection(
  content: Content,
  reference: string,
  options: readonly z.infer<typeof EquipmentOption>[],
  { firstClass = false }: { firstClass?: boolean } = {},
): Selection<Built2024> {
  const gate: Required<Pick<ModifierOptions<Built2024>, "deps">> & ModifierOptions<Built2024> = firstClass
    ? { deps: ["classes"], when: (q) => q("classes")[0] === reference }
    : { deps: [] };
  const given = (item: string, quantity: number) => m.push("inventory", { item, quantity, source: reference }, gate);
  const itemName = ({ item, quantity }: z.infer<typeof EquipmentItem>) => {
    const name =
      typeof item === "string" ? (findRecord(content, "equipment", item)?.name ?? item) : "category" in item ? categoryName(item.category) : "the chosen tool";
    return quantity === 1 ? name : `${quantity} ${name}`;
  };
  /** `repeat` counts the items of the same category before this one in the option, so that each choice has a key of its own. */
  const itemParts = ({ item, quantity }: z.infer<typeof EquipmentItem>, repeat: number): OptionParts<Built2024> => {
    if (typeof item === "string") return { modifiers: [given(item, quantity)], selections: [] };
    if ("chosen" in item) {
      return {
        modifiers: [
          m.update("inventory", (items, q) => [...items, ...(q("chosenTools")[reference] ?? []).map((tool) => ({ item: tool, quantity, source: reference }))], {
            deps: ["chosenTools", ...gate.deps],
            when: (q) => (q("chosenTools")[reference] ?? []).length > 0 && (!gate.when || gate.when(q)),
          }),
        ],
        selections: [],
      };
    }
    return {
      modifiers: [],
      selections: [
        selection<Built2024>({
          name: categoryName(item.category),
          key: repeat ? `${item.category}-${repeat + 1}` : item.category,
          options: equipmentInCategory(content, item.category).map(({ reference: ref, record }) =>
            option<Built2024>({ key: ref, name: record.name, modifiers: [given(ref, quantity)] }),
          ),
        }),
      ],
    };
  };
  return selection({
    name: "Starting Equipment",
    ...(firstClass ? { prereq: (built: Built2024) => built.classes[0] === reference } : {}),
    options: options.map((entry, i) => {
      const items = entry.items ?? [];
      const categoryOf = ({ item }: z.infer<typeof EquipmentItem>) => (typeof item === "object" && "category" in item ? item.category : undefined);
      const parts = items.map((current, j) =>
        itemParts(current, items.slice(0, j).filter((earlier) => categoryOf(earlier) !== undefined && categoryOf(earlier) === categoryOf(current)).length),
      );
      const gold = entry.gold ?? 0;
      return option<Built2024>({
        // "a" for option A, "b" for option B, and so on.
        key: String.fromCharCode(97 + i),
        name: [...items.map(itemName), ...(gold ? [`${gold} GP`] : [])].join(", "),
        modifiers: [...parts.flatMap((p) => p.modifiers), ...(gold ? [m.add("gold", gold, { ...gate, name: "Starting Equipment" })] : [])],
        selections: parts.flatMap((p) => p.selections),
      });
    }),
  });
}
