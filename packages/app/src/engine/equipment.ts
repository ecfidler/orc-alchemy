// The Equipment step (ORC-59): the inventory lists, custom items, hands and
// attunement, read from the strict entity, and the writes the old builder
// and sheet make. Only this file knows the Transit keys of the items; the
// keys of the strict entity are in strict.ts.
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { srdList } from "./srd-lists.ts";
import { KEY, MAP_VALUE, OPTIONS, rootOf, SELECTIONS, unkeyword, VALUES } from "./strict.ts";

const QUANTITY = "~:orcpub.dnd.e5.character.equipment/quantity";
const EQUIPPED = "~:orcpub.dnd.e5.character.equipment/equipped?";
const NAME = "~:orcpub.dnd.e5.character.equipment/name";
const BACKGROUND_STARTING = "~:orcpub.dnd.e5.character.equipment/background-starting-equipment?";
const CLASS_STARTING = "~:orcpub.dnd.e5.character.equipment/class-starting-equipment?";

/** The inventory lists with custom items: "equipment" holds custom-equipment, and "treasure" custom-treasure. */
export const CUSTOM_VALUES: Record<string, string> = { equipment: "custom-equipment", treasure: "custom-treasure" };

/** The value keys of the hands, without their namespace. */
export type Hand = "worn-armor" | "wielded-shield" | "main-hand-weapon" | "off-hand-weapon";

type ItemValue = Record<string, unknown>;
type StrictOption = { [KEY]: string; [MAP_VALUE]?: ItemValue };
type Strict = {
  [SELECTIONS]?: { [KEY]: string; [OPTIONS]?: StrictOption[] }[];
  [VALUES]?: Record<string, unknown>;
};

export interface Item {
  key: string;
  quantity: number;
  equipped: boolean;
}

export interface CustomItem {
  name: string;
  quantity: number;
  equipped: boolean;
  /** From a class or background's starting equipment; the old builder does not let its name change. */
  starting: boolean;
}

const strict = (entity: StrictEntity) => rootOf(entity) as Strict;

function storedValues(entity: StrictEntity, list: string): [key: string, value: ItemValue][] {
  const selection = strict(entity)[SELECTIONS]?.find((s) => s[KEY] === `~:${list}`);
  return (selection?.[OPTIONS] ?? []).map((o) => [unkeyword(o[KEY]), o[MAP_VALUE] ?? {}]);
}

/** The items stored in an inventory list, such as "armor", in the entity's order. */
export const storedItems = (entity: StrictEntity, list: string): Item[] =>
  storedValues(entity, list).map(([key, value]) => ({ key, quantity: Number(value[QUANTITY] ?? 1), equipped: value[EQUIPPED] === true }));

/** A character value, such as "worn-armor", as stored. */
const value = (entity: StrictEntity, key: string) => strict(entity)[VALUES]?.[`~:orcpub.dnd.e5.character/${key}`];

/** The item key in a hand; "none" when set to nothing, and null when not set. */
export function hand(entity: StrictEntity, key: Hand): string | null {
  const stored = value(entity, key);
  return typeof stored === "string" ? unkeyword(stored) : null;
}

/** The attuned magic item keys. */
export const attunedItems = (entity: StrictEntity): string[] => ((value(entity, "attuned-magic-items") ?? []) as string[]).map(unkeyword);

const customValues = (entity: StrictEntity, valueKey: string) => (value(entity, valueKey) ?? []) as ItemValue[];

/** The custom items in custom-equipment or custom-treasure. */
export const customItems = (entity: StrictEntity, valueKey: string): CustomItem[] =>
  customValues(entity, valueKey).map((item) => ({
    name: String(item[NAME] ?? ""),
    quantity: Number(item[QUANTITY] ?? 1),
    equipped: item[EQUIPPED] === true,
    starting: item[BACKGROUND_STARTING] === true || item[CLASS_STARTING] === true,
  }));

/** Sets whether an item is carried, as the old builder: the other keys stay. */
export function setCarried(e: Engine, entity: StrictEntity, list: string, key: string, equipped: boolean, content?: Content) {
  const [, item] = storedValues(entity, list).find(([k]) => k === key)!;
  return e.setField(entity, [list, key], { ...item, [EQUIPPED]: equipped }, content);
}

/** Sets an item's quantity, as the old builder: it keeps only equipped?, so the starting-equipment flags go. */
export function setQuantity(e: Engine, entity: StrictEntity, list: string, key: string, quantity: number, content?: Content) {
  const [, item] = storedValues(entity, list).find(([k]) => k === key)!;
  return e.setField(entity, [list, key], { [EQUIPPED]: item[EQUIPPED] === true, [QUANTITY]: quantity }, content);
}

/** Puts an item key, or "none", in a hand. The main hand also sets the off hand to none, as the old sheet. */
export function wield(e: Engine, entity: StrictEntity, key: Hand, itemKey: string) {
  const next = e.setValue(entity, key, `~:${itemKey}`);
  return key === "main-hand-weapon" ? e.setValue(next, "off-hand-weapon", "~:none") : next;
}

/** Adds or removes an item from the attuned magic items. */
export function setAttuned(e: Engine, entity: StrictEntity, itemKey: string, attuned: boolean) {
  const others = attunedItems(entity).filter((k) => k !== itemKey);
  return e.setValue(
    entity,
    "attuned-magic-items",
    (attuned ? [...others, itemKey] : others).map((k) => `~:${k}`),
  );
}

/** Adds a custom item, as the old "Add Custom Item". */
export const addCustomItem = (e: Engine, entity: StrictEntity, valueKey: string) =>
  e.setValue(entity, valueKey, [...customValues(entity, valueKey), { [NAME]: "New Custom Item", [QUANTITY]: 1, [EQUIPPED]: true }]);

/**
 * Changes the custom item at index, as the old builder: a name or carried
 * change keeps the other keys; a quantity change keeps only the name and
 * equipped?, so the starting-equipment flags go.
 */
export function changeCustomItem(
  e: Engine,
  entity: StrictEntity,
  valueKey: string,
  index: number,
  change: { name: string } | { equipped: boolean } | { quantity: number },
) {
  const items = customValues(entity, valueKey).map((item, i) => {
    if (i !== index) return item;
    if ("name" in change) return { ...item, [NAME]: change.name };
    if ("equipped" in change) return { ...item, [EQUIPPED]: change.equipped };
    return { [NAME]: item[NAME], [EQUIPPED]: item[EQUIPPED] === true, [QUANTITY]: change.quantity };
  });
  return e.setValue(entity, valueKey, items);
}

/**
 * Removes each item of a class's starting equipment: the items of the inventory lists and the custom items with the
 * class-starting-equipment flag. The other items stay.
 */
export function withoutClassStartingEquipment(e: Engine, entity: StrictEntity): StrictEntity {
  let next = entity;
  for (const selection of strict(entity)[SELECTIONS] ?? []) {
    const list = unkeyword(selection[KEY]);
    for (const [key, item] of storedValues(entity, list)) if (item[CLASS_STARTING] === true) next = e.removeInventoryItem(next, list, key);
  }
  for (const valueKey of Object.values(CUSTOM_VALUES)) {
    const items = customValues(next, valueKey);
    if (items.some((item) => item[CLASS_STARTING] === true))
      next = e.setValue(
        next,
        valueKey,
        items.filter((item) => item[CLASS_STARTING] !== true),
      );
  }
  return next;
}

/** Removes the custom items with the name, as the old builder. */
export const removeCustomItem = (e: Engine, entity: StrictEntity, valueKey: string, name: string) =>
  e.setValue(
    entity,
    valueKey,
    customValues(entity, valueKey).filter((item) => item[NAME] !== name),
  );

const FRACTIONS: Record<string, number> = { "": 0, "½": 0.5, "¼": 0.25, "/2": 0.5, "/4": 0.25 };

/**
 * The pounds of a weight in the engine's content lists: a number, such as 65 for Plate, or a text, such as "1 lb.",
 * "1½ lb." or "1/2 lb." (ORC-374). Null for "—" and for no weight.
 */
function pounds(weight: unknown): number | null {
  if (typeof weight === "number") return weight;
  const match = typeof weight === "string" ? /^(\d+)?(½|¼|\/2|\/4)? lb\./.exec(weight) : null;
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  const whole = Number(match[1] ?? 0);
  // "1/2 lb." is a half pound, not one and a half.
  return match[2]?.startsWith("/") ? whole * FRACTIONS[match[2]] : whole + FRACTIONS[match[2] ?? ""];
}

let weights: Promise<Map<string, number>> | undefined;

/**
 * The weight in pounds of one of each SRD item with a weight, by key: from the engine's armor, equipment and magic
 * item lists. The weight of ammunition is for its bundle, for example 20 arrows, so one piece has a part of it. The
 * weapon list has no weights. The map is made once; after a failed load, the next call tries again.
 */
export function itemWeights(): Promise<Map<string, number>> {
  weights ??= Promise.all([srdList("armor"), srdList("equipment"), srdList("magic-items")]).then(
    (lists) => {
      const map = new Map<string, number>();
      for (const item of lists.flat()) {
        const lb = pounds(item.weight);
        const ammunition = item["orcpub.dnd.e5.weapons/type"] === "ammunition" && typeof item["sell-qty"] === "number";
        if (lb !== null) map.set(item.key, ammunition ? lb / (item["sell-qty"] as number) : lb);
      }
      return map;
    },
    (error) => {
      weights = undefined;
      throw error;
    },
  );
  return weights;
}
