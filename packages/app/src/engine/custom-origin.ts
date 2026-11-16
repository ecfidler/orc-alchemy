// Custom Origin (ORC-138): a guided copy of a race for one character. The
// user picks a base race, then moves its ability score increases to other
// abilities, and swaps each of its languages and its skill, tool and weapon
// proficiencies for another one. The copy is a race in the character's
// custom content, as a Customize copy is (custom.ts), with one more key,
// CUSTOM_ORIGIN, that names the base race. Edit finds the earlier picks by
// a comparison of the copy with the base race's record (originPicks), so
// the picks are never stored apart from the values that they make.

import { asSet, isMap, setItems, tag, untag } from "./content.ts";
import { characterContent, formRecord, isCustomCopy, optionOrigin, type SavedCopy, saveCopy, srdRaceRecord, storedCopy } from "./custom.ts";
import { type Content, type ContentType, engine, type StrictEntity } from "./engine.ts";
import { withoutOption } from "./reconcile.ts";
import { ABILITIES, ABILITY_NAMES, type Ability } from "./sheet.ts";

export const RACE_TYPE: ContentType = "orcpub.dnd.e5/races";

/** The key of a Custom Origin copy that names its base race, as a keyword: {:custom-origin :elf}. The validator, the engine and the file export keep it. */
export const CUSTOM_ORIGIN = tag("custom-origin");

/** The name of the Custom Origin copy of the race with the name. */
export const originName = (raceName: string) => `${raceName} (Custom Origin)`;

/** The key of the base race of a Custom Origin copy, or undefined for another item. */
export function originBase(item: unknown): string | undefined {
  const base = isMap(item) ? item[CUSTOM_ORIGIN] : undefined;
  return typeof base === "string" && base.startsWith("~:") ? untag(base) : undefined;
}

/**
 * The kinds of what a race gives that Custom Origin changes. A weapon can
 * become another weapon or a tool; each other kind stays of its kind.
 */
export type OriginKind = "ability" | "language" | "skill" | "tool" | "weapon";

/**
 * One thing that the race gives, and what the character gets in its place.
 * A pick is "{kind}:{key}", such as "skill:perception", "ability:str" or
 * "language:Elvish" (a race stores a language by its name).
 */
export interface OriginSlot {
  kind: OriginKind;
  /** The bonus of an ability slot, such as 2. */
  amount?: number;
  /** What the race gives. */
  race: string;
  /** What the character gets: race, or the pick that the user made. */
  value: string;
}

export const pickId = (kind: OriginKind, key: string) => `${kind}:${key}`;

/** The kind and the key of a pick. */
export function pickOf(id: string): { kind: OriginKind; key: string } {
  const at = id.indexOf(":");
  return { kind: id.slice(0, at) as OriginKind, key: id.slice(at + 1) };
}

const ABILITY_PREFIX = tag("orcpub.dnd.e5.character/");

/** Where a record stores each kind but the languages: a map of key to true, or for an ability to its bonus. */
const MAP_PATHS: Record<Exclude<OriginKind, "language">, string[]> = {
  ability: [tag("abilities")],
  skill: [tag("props"), tag("skill-prof")],
  tool: [tag("profs"), tag("tool")],
  weapon: [tag("props"), tag("weapon-prof")],
};
const LANGUAGES = tag("languages");
const SLOT_ORDER: OriginKind[] = ["ability", "language", "skill", "tool", "weapon"];

const entryKey = (kind: OriginKind, key: string) => (kind === "ability" ? `${ABILITY_PREFIX}${key}` : tag(key));
const keyOfEntry = (kind: OriginKind, entry: string) => (kind === "ability" ? entry.slice(ABILITY_PREFIX.length) : untag(entry));

const mapAt = (record: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined => {
  const value = path.reduce<unknown>((v, k) => (isMap(v) ? v[k] : undefined), record);
  return isMap(value) ? value : undefined;
};

/** What the record gives, in slot order: each positive ability bonus in the order of the sheet, each language, and each skill, tool and weapon proficiency that is true. */
function given(record: Record<string, unknown>): { id: string; amount?: number }[] {
  const out: { id: string; amount?: number }[] = [];
  for (const kind of SLOT_ORDER) {
    if (kind === "language") {
      for (const name of setItems(record[LANGUAGES])) if (typeof name === "string") out.push({ id: pickId(kind, name) });
      continue;
    }
    const entries = Object.entries(mapAt(record, MAP_PATHS[kind]) ?? {});
    if (kind === "ability") {
      const bonuses = entries
        .filter(([, v]) => typeof v === "number" && v > 0)
        .map(([k, v]) => ({ id: pickId(kind, keyOfEntry(kind, k)), amount: v as number }));
      bonuses.sort((a, b) => ABILITIES.indexOf(pickOf(a.id).key as Ability) - ABILITIES.indexOf(pickOf(b.id).key as Ability));
      out.push(...bonuses);
    } else for (const [k, v] of entries) if (v === true) out.push({ id: pickId(kind, keyOfEntry(kind, k)) });
  }
  return out;
}

/** The slots of a base race's record, each with what the race gives as its value. */
export function originSlots(record: Record<string, unknown>): OriginSlot[] {
  return given(record).map(({ id, amount }) => ({ kind: pickOf(id).kind, ...(amount !== undefined && { amount }), race: id, value: id }));
}

/** True when a slot's value is not what the race gives. */
export const changedSlots = (slots: OriginSlot[]) => slots.some((slot) => slot.value !== slot.race);

/** The slots with slot i set to the pick. */
export const withPick = (slots: OriginSlot[], i: number, id: string) => slots.map((slot, j) => (j === i ? { ...slot, value: id } : slot));

/**
 * The slots with slot i back on what the race gives. When another slot of
 * its kind holds that value, the two change places, so no value is held
 * twice.
 */
export function putBack(slots: OriginSlot[], i: number): OriginSlot[] {
  const slot = slots[i];
  return slots.map((other, j) => {
    if (j === i) return { ...other, value: other.race };
    return other.value === slot.race ? { ...other, value: slot.value } : other;
  });
}

/** A list of options of one kind, as the app has it: each key and name, and the small heading of its run in a list. */
export interface OriginChoice {
  key: string;
  name: string;
  group?: string;
}

/** The options of each kind. A language's key is its name, which a race stores. */
export type OriginLists = Record<Exclude<OriginKind, "ability">, OriginChoice[]>;

/** The six abilities, as options. */
const ABILITY_CHOICES: OriginChoice[] = ABILITIES.map((a) => ({ key: a, name: ABILITY_NAMES[a] }));

/** The kinds that a slot of the kind can take. */
const takes = (kind: OriginKind): OriginKind[] => (kind === "weapon" ? ["weapon", "tool"] : [kind]);

/** The choices of the kind, from the lists. */
const choicesOf = (kind: OriginKind, lists: OriginLists): OriginChoice[] => (kind === "ability" ? ABILITY_CHOICES : lists[kind]);

/**
 * Each pick that the record holds that is no slot, such as a negative
 * bonus ("ability:int" for Int -2) or a weapon stored as false.
 */
function fixedPicks(record: Record<string, unknown>): Set<string> {
  const slots = new Set(given(record).map((g) => g.id));
  const all = SLOT_ORDER.flatMap((kind) =>
    kind === "language"
      ? setItems(record[LANGUAGES]).map((name) => pickId(kind, String(name)))
      : Object.keys(mapAt(record, MAP_PATHS[kind]) ?? {}).map((entry) => pickId(kind, keyOfEntry(kind, entry))),
  );
  return new Set(all.filter((id) => !slots.has(id)));
}

/**
 * The picks that slot i can take, as ids with their names, in the order of
 * the lists: each option of its kinds that no other slot holds, and that
 * the base race's record does not hold outside its slots (fixedPicks).
 * Thus two bonuses never go on one ability, and a pick never takes the
 * place of a value of the record. The slot's own value is in the list.
 * A pick in elsewhere (heldElsewhere) is not offered either, but for the
 * slot's own value and what the race gives.
 */
export function slotOptions(
  base: Record<string, unknown>,
  slots: OriginSlot[],
  i: number,
  lists: OriginLists,
  elsewhere: ReadonlySet<string> = new Set(),
): { id: string; name: string; group?: string }[] {
  const { race, value } = slots[i];
  const held = new Set([...slots.filter((_, j) => j !== i).map((slot) => slot.value), ...fixedPicks(base)]);
  return takes(slots[i].kind).flatMap((kind) =>
    choicesOf(kind, lists)
      .map((choice) => ({ id: pickId(kind, choice.key), name: choice.name, ...(choice.group !== undefined && { group: choice.group }) }))
      .filter((option) => !held.has(option.id) && (!elsewhere.has(option.id) || option.id === race || option.id === value)),
  );
}

/**
 * The picks that the character holds without its race: each language,
 * and each skill, tool and weapon proficiency that the engine builds for
 * the entity without the race option with the key selected (as it is
 * when selected is undefined). A swap to one of them gives the character
 * a value twice, and the builder then asks the user to remove a
 * selection. The engine builds a language as its key, and a race stores
 * its name, so languages gives the name of each key. The engine builds
 * the weapons of a class as "simple" and "martial", which are no picks.
 * content is the loaded content, without custom.
 */
export function heldElsewhere(
  entity: StrictEntity,
  custom: object | undefined,
  content: Content,
  selected: string | undefined,
  languages: { key: string; name: string }[],
): Set<string> {
  const others = selected === undefined ? entity : withoutOption(entity, ["race", selected]);
  const { built } = engine().evaluate(others, characterContent(content, custom));
  const names = new Map(languages.map(({ key, name }) => [key, name]));
  return new Set([
    ...(built.languages ?? []).flatMap((key) => (names.has(key) ? [pickId("language", names.get(key) as string)] : [])),
    ...Object.keys(built["skill-profs"] ?? {}).map((key) => pickId("skill", key)),
    ...Object.keys(built["tool-profs"] ?? {}).map((key) => pickId("tool", key)),
    ...(built["weapon-profs"] ?? []).map((key) => pickId("weapon", key)),
  ]);
}

/** The name of a pick in the lists, or its key when no list has it. */
export function slotValueName(id: string, lists: OriginLists): string {
  const { kind, key } = pickOf(id);
  return choicesOf(kind, lists).find((choice) => choice.key === key)?.name ?? key;
}

/** The map at path in the record set to value, or left out when it is empty and the record did not have it. */
function withMapAt(record: Record<string, unknown>, path: string[], value: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(value).length === 0 && mapAt(record, path) === undefined) return record;
  const [k, ...rest] = path;
  const inner = isMap(record[k]) ? (record[k] as Record<string, unknown>) : {};
  return { ...record, [k]: rest.length === 0 ? value : withMapAt(inner, rest, value) };
}

/**
 * The Custom Origin copy of the base race's record with the slots' values,
 * named originName(baseName), with CUSTOM_ORIGIN baseKey. Each value takes
 * the place of what the race gives, in the same place of its map or set; a
 * weapon that becomes a tool goes to the end of the tools. The record's
 * other values stay.
 */
export function originRecord(base: Record<string, unknown>, slots: OriginSlot[], baseKey: string, baseName: string): Record<string, unknown> {
  const slotFor = (id: string) => slots.find((slot) => slot.race === id);
  let record: Record<string, unknown> = { ...base, [tag("name")]: originName(baseName), [CUSTOM_ORIGIN]: tag(baseKey) };
  if (record[LANGUAGES] !== undefined) {
    record[LANGUAGES] = asSet(
      setItems(base[LANGUAGES]).map((name) => {
        const slot = typeof name === "string" ? slotFor(pickId("language", name)) : undefined;
        return slot === undefined ? name : pickOf(slot.value).key;
      }),
    );
  }
  for (const kind of ["ability", "skill", "tool", "weapon"] as const) {
    const entries = Object.entries(mapAt(base, MAP_PATHS[kind]) ?? {}).flatMap(([entry, v]): [string, unknown][] => {
      const slot = slotFor(pickId(kind, keyOfEntry(kind, entry)));
      if (slot === undefined) return [[entry, v]];
      const pick = pickOf(slot.value);
      return pick.kind === kind ? [[entryKey(kind, pick.key), v]] : [];
    });
    // A weapon slot that holds a tool adds it after the tools.
    const moved =
      kind === "tool"
        ? slots
            .filter((slot) => slot.kind === "weapon" && pickOf(slot.value).kind === "tool")
            .map((slot): [string, unknown] => [tag(pickOf(slot.value).key), true])
        : [];
    record = withMapAt(record, MAP_PATHS[kind], Object.fromEntries([...entries, ...moved]));
  }
  return record;
}

/**
 * The slots of the base race's record, with the values that the copy has:
 * a slot whose race value the copy still has (with the same bonus) keeps
 * it, and each other slot takes the first value of the copy that no slot
 * took, of a kind that it can take (an ability with the same bonus). That
 * value can be one that another slot of the race gives, such as a bonus
 * moved onto another of the race's abilities.
 * originRecord with these slots gives the copy again. A slot with no such
 * value keeps what the race gives.
 */
export function originPicks(base: Record<string, unknown>, copy: Record<string, unknown>): OriginSlot[] {
  const slots = originSlots(base);
  const has = given(copy);
  const taken = new Set<string>();
  const kept = slots.map((slot) => {
    const same = has.find((g) => g.id === slot.race && g.amount === slot.amount);
    if (same) taken.add(same.id);
    return same !== undefined;
  });
  return slots.map((slot, i) => {
    if (kept[i]) return slot;
    const next = has.find((g) => !taken.has(g.id) && takes(slot.kind).includes(pickOf(g.id).kind) && g.amount === slot.amount);
    if (next === undefined) return slot;
    taken.add(next.id);
    return { ...slot, value: next.id };
  });
}

/**
 * The record of the race with the key, as the copy starts from it: a pack
 * race's item without its key and option source (formRecord), or the SRD
 * race's record (srdRaceRecord). undefined when neither has it. homebrew
 * is the loaded content's, without the character's custom content.
 */
export async function baseRaceRecord(homebrew: Content["homebrew"], key: string): Promise<Record<string, unknown> | undefined> {
  const origin = optionOrigin(homebrew, undefined, RACE_TYPE, key);
  return origin.from === "pack" ? formRecord(origin.item) : srdRaceRecord(key);
}

/** The names of the choices under the race, such as Subrace, of a character with only the race. */
function raceChoices(key: string, content: Content): Map<string, string> {
  const e = engine();
  const { selections } = e.evaluate(e.select(e.emptyCharacter(), ["race"], key, content), content);
  return new Map(selections.filter((s) => s.path.length === 3 && s.path[0] === "race" && s.path[1] === key).map((s) => [s.path[2], s.name]));
}

/**
 * The names of the choices of the base race that its copy does not have,
 * such as Subrace and Tool Proficiency for the Dwarf. The engine builds a
 * character with only the race, then one with only the copy, and the
 * choices under each are compared. content is the loaded content, without
 * the character's custom content.
 */
export function lostChoices(baseKey: string, copy: Record<string, unknown>, content: Content): string[] {
  const { key, stored } = storedCopy(RACE_TYPE, copy);
  const withCopy = characterContent(content, { [tag(RACE_TYPE)]: { [tag(key)]: stored } });
  const kept = raceChoices(key, withCopy);
  return [...raceChoices(baseKey, content)].filter(([k]) => !kept.has(k)).map(([, name]) => name);
}

/**
 * The save of a Custom Origin copy (saveCopy): the copy takes the place of
 * the character's race, selected is its key. A selected copy in the
 * custom content (a Customize or Custom Origin copy) is replaced, so the
 * character keeps one copy. Without a race, the base race is selected
 * first, so the copy has a pick to take. content is the loaded content,
 * without custom. Throws as saveCopy throws.
 */
export function saveCustomOrigin(
  entity: StrictEntity,
  custom: object | undefined,
  content: Content,
  { item, baseKey, selected }: { item: Record<string, unknown>; baseKey: string; selected: string | undefined },
): SavedCopy {
  if (selected === undefined) {
    const withBase = engine().select(entity, ["race"], baseKey, characterContent(content, custom));
    return saveCopy(withBase, custom, content, { contentType: RACE_TYPE, path: ["race", baseKey], item });
  }
  const replacedKey = isCustomCopy(content.homebrew, custom, RACE_TYPE, selected) ? selected : undefined;
  return saveCopy(entity, custom, content, { contentType: RACE_TYPE, path: ["race", selected], item, replacedKey });
}

/**
 * The key of the base race of the character's race option with the key,
 * when it is a Custom Origin copy in custom (originBase); else undefined.
 * homebrew is the loaded content's, without custom.
 */
export function customOriginBase(homebrew: Content["homebrew"], custom: object | undefined, key: string): string | undefined {
  return customOriginCopy(homebrew, custom, key)?.base;
}

/** The Custom Origin copy with the key in custom, and the key of its base race (customOriginBase); else undefined. */
export function customOriginCopy(
  homebrew: Content["homebrew"],
  custom: object | undefined,
  key: string,
): { base: string; item: Record<string, unknown> } | undefined {
  const origin = optionOrigin(homebrew, custom, RACE_TYPE, key);
  const base = origin.from === "custom" ? originBase(origin.item) : undefined;
  return origin.from === "custom" && base !== undefined ? { base, item: origin.item } : undefined;
}
