// The Equipment step (ORC-59): the inventory lists, custom items, hands and
// attunement, read from the strict entity, and the writes the old builder
// and sheet make. Only this file knows their Transit keys.
import type { Content, Engine, StrictEntity } from "./engine.ts";

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
type StrictOption = { "~:orcpub.entity.strict/key": string; "~:orcpub.entity.strict/map-value"?: ItemValue };
type Strict = {
  "~:orcpub.entity.strict/selections"?: { "~:orcpub.entity.strict/key": string; "~:orcpub.entity.strict/options"?: StrictOption[] }[];
  "~:orcpub.entity.strict/values"?: Record<string, unknown>;
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

const strict = (entity: StrictEntity) => (typeof entity === "string" ? JSON.parse(entity) : entity) as Strict;
const unkeyword = (key: string) => key.replace(/^~:/, "");

function storedValues(entity: StrictEntity, list: string): [key: string, value: ItemValue][] {
  const selection = strict(entity)["~:orcpub.entity.strict/selections"]?.find((s) => s["~:orcpub.entity.strict/key"] === `~:${list}`);
  return (selection?.["~:orcpub.entity.strict/options"] ?? []).map((o) => [
    unkeyword(o["~:orcpub.entity.strict/key"]),
    o["~:orcpub.entity.strict/map-value"] ?? {},
  ]);
}

/** The items stored in an inventory list, such as "armor", in the entity's order. */
export const storedItems = (entity: StrictEntity, list: string): Item[] =>
  storedValues(entity, list).map(([key, value]) => ({ key, quantity: Number(value[QUANTITY] ?? 1), equipped: value[EQUIPPED] === true }));

/** A character value, such as "worn-armor", as stored. */
const value = (entity: StrictEntity, key: string) => strict(entity)["~:orcpub.entity.strict/values"]?.[`~:orcpub.dnd.e5.character/${key}`];

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
  return e.setValue(entity, "attuned-magic-items", (attuned ? [...others, itemKey] : others).map((k) => `~:${k}`));
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

/** Removes the custom items with the name, as the old builder. */
export const removeCustomItem = (e: Engine, entity: StrictEntity, valueKey: string, name: string) =>
  e.setValue(
    entity,
    valueKey,
    customValues(entity, valueKey).filter((item) => item[NAME] !== name),
  );
