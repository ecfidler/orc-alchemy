// The play state of the sheet (ORC-313, docs/design/sheet-interactivity.md
// "The record"): hit points, death saves, spent hit dice, spent uses, the
// concentration mark, conditions, exhaustion, inspiration and the AC pick,
// read from and written to the strict entity. built does not report these
// values. Only this file knows their Transit keys.
//
// Each reader gives the empty state for a value that is not valid, and a
// count above its limit reads as the limit. Each writer writes the empty
// state as null or as no entry, so that the record stays small: the engine
// removes null and each empty collection, also in a nested map. It keeps 0
// and false. Each writer is a pure function for sheetChange of useCharacter.
import { asSet, intKey, isMap, setItems, strictValues, tag, untag } from "./content.ts";
import type { Engine, StrictEntity } from "./engine.ts";

/** The keys, as setValue takes them: with the full namespace and without "~:". */
const CURRENT_HIT_POINTS = "orcpub.dnd.e5.character/current-hit-points";
const TEMP_HIT_POINTS = "orc-alchemy.play/temp-hit-points";
const DEATH_SAVES = "orc-alchemy.play/death-saves";
const HIT_DICE_SPENT = "orc-alchemy.play/hit-dice-spent";
const USES_SPENT = "orc-alchemy.play/uses-spent";
const CONCENTRATION = "orc-alchemy.play/concentration";
const CONDITIONS = "orc-alchemy.play/conditions";
const EXHAUSTION = "orc-alchemy.play/exhaustion";
const INSPIRATION = "orc-alchemy.play/inspiration";
const AC_PICK = "orc-alchemy.play/ac-pick";

const SUCCESSES = "~:successes";
const FAILURES = "~:failures";
const ARMOR = "~:armor";
const SHIELD = "~:shield";
const DIE_KEY = /^~i(\d+)$/;

/** The stored value of a key. */
const stored = (entity: StrictEntity, key: string): unknown => strictValues(entity)[tag(key)];

/** A count: an integer from 0 to the limit. A value that is not an integer reads as 0. */
const count = (value: unknown, limit = Number.POSITIVE_INFINITY): number =>
  Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, Math.max(0, limit)) : 0;

/**
 * A string as a Transit map key. Transit gives a meaning to a first
 * character "~", "^" or "`", so such a string gets a "~" before it. The
 * engine reads "^x" as a cache reference and loses it.
 */
const escapeKey = (text: string) => (/^[~^`]/.test(text) ? `~${text}` : text);
/** A Transit map key as its string: the inverse of escapeKey. */
const unescapeKey = (key: string) => (/^~[~^`]/.test(key) ? key.slice(1) : key);

// Hit points.

/**
 * The current hit points: null for full hit points, or for a value that is
 * not an integer from 0. With `max`, a value above it reads as `max`.
 */
export function currentHitPoints(entity: StrictEntity, max?: number): number | null {
  const value = stored(entity, CURRENT_HIT_POINTS);
  if (!Number.isInteger(value) || (value as number) < 0) return null;
  return max === undefined ? (value as number) : Math.min(value as number, Math.max(0, max));
}

/**
 * Writes the current hit points. null means full hit points and removes the
 * key. A number below 0 is written as 0, and a fraction is cut to an
 * integer. The caller gives null at the maximum: with exhaustion level 4, the
 * stored value at the halved maximum stays as it is (spec, "Exhaustion").
 */
export function setCurrentHitPoints(e: Engine, entity: StrictEntity, hitPoints: number | null) {
  return e.setValue(entity, CURRENT_HIT_POINTS, hitPoints === null || Number.isNaN(hitPoints) ? null : Math.max(0, Math.trunc(hitPoints)));
}

/** The temporary hit points: 0 when there are none, or for a value that is not an integer above 0. */
export function tempHitPoints(entity: StrictEntity): number {
  return count(stored(entity, TEMP_HIT_POINTS));
}

/** Writes the temporary hit points. 0 or less removes the key. A fraction is cut to an integer. */
export function setTempHitPoints(e: Engine, entity: StrictEntity, hitPoints: number) {
  const value = Math.trunc(hitPoints);
  return e.setValue(entity, TEMP_HIT_POINTS, value > 0 ? value : null);
}

// Death saves.

/** The two counts of the death saves, each from 0 to 3. */
export interface DeathSaves {
  successes: number;
  failures: number;
}

/** The highest count of successes and of failures. */
export const DEATH_SAVE_LIMIT = 3;

/** The death saves. A count that is not valid reads as 0, and a count above 3 reads as 3. */
export function deathSaves(entity: StrictEntity): DeathSaves {
  const value = stored(entity, DEATH_SAVES);
  const saves = isMap(value) ? value : {};
  return { successes: count(saves[SUCCESSES], DEATH_SAVE_LIMIT), failures: count(saves[FAILURES], DEATH_SAVE_LIMIT) };
}

/** Writes the death saves, each count kept from 0 to 3. Two counts of 0 remove the key. */
export function setDeathSaves(e: Engine, entity: StrictEntity, saves: DeathSaves) {
  const successes = count(Math.trunc(saves.successes), DEATH_SAVE_LIMIT);
  const failures = count(Math.trunc(saves.failures), DEATH_SAVE_LIMIT);
  return e.setValue(entity, DEATH_SAVES, successes === 0 && failures === 0 ? null : { [SUCCESSES]: successes, [FAILURES]: failures });
}

// Hit dice.

/** Spent hit dice, as die size (10 for a d10) to the number spent. Only counts above 0 are in it. */
export type HitDiceSpent = ReadonlyMap<number, number>;

/**
 * The spent hit dice. The record keeps them as a map of an integer key to a
 * count: { "~i10": 2, "~i6": 1 }. An entry that is not valid is left out.
 * With `limits`, as die size to the hit dice of that size, a count above its
 * limit reads as the limit, and a die without a limit is left out.
 */
export function hitDiceSpent(entity: StrictEntity, limits?: HitDiceSpent): HitDiceSpent {
  const value = stored(entity, HIT_DICE_SPENT);
  const spent = new Map<number, number>();
  if (!isMap(value)) return spent;
  for (const [key, n] of Object.entries(value)) {
    const die = DIE_KEY.exec(key)?.[1];
    if (die === undefined) continue;
    const limit = limits === undefined ? undefined : (limits.get(Number(die)) ?? 0);
    const c = count(n, limit);
    if (c > 0) spent.set(Number(die), c);
  }
  return spent;
}

/**
 * Writes the spent hit dice. The value replaces the full map, so give each
 * die. A die with 0 spent is left out; with none at all the key goes.
 */
export function setHitDiceSpent(e: Engine, entity: StrictEntity, spent: HitDiceSpent) {
  const value = Object.fromEntries(
    [...spent]
      .filter(([die, n]) => Number.isInteger(die) && die > 0 && count(Math.trunc(n)) > 0)
      .sort(([a], [b]) => b - a)
      .map(([die, n]) => [intKey(die), Math.trunc(n)]),
  );
  return e.setValue(entity, HIT_DICE_SPENT, value);
}

// Feature uses.

/** The recharge group of a feature with no unit. */
export const NO_RECHARGE = "orc-alchemy.play/no-recharge";

/**
 * The recharge group of a feature: its unit as built gives it, for example
 * "orcpub.dnd.e5.units/long-rest", or NO_RECHARGE for a feature with no unit.
 * A tagged unit ("~:…") is taken too.
 */
export function rechargeGroup(units: string | null | undefined): string {
  return typeof units === "string" && untag(units) !== "" ? untag(units) : NO_RECHARGE;
}

/**
 * Spent uses, as recharge group (see rechargeGroup) to feature name to the
 * number spent. Two features with the same name and group share one count.
 * Only counts above 0 are in it.
 */
export type UsesSpent = ReadonlyMap<string, ReadonlyMap<string, number>>;

/**
 * The spent uses. The record keeps them as a map of the tagged group to a
 * map of the feature name to a count:
 * { "~:orcpub.dnd.e5.units/long-rest": { "Channel Divinity": 1 } }.
 * An entry that is not valid is left out. A count is as stored: use
 * featureUsesSpent for a count against the amount of a feature.
 */
export function usesSpent(entity: StrictEntity): UsesSpent {
  const value = stored(entity, USES_SPENT);
  const spent = new Map<string, Map<string, number>>();
  if (!isMap(value)) return spent;
  for (const [groupKey, features] of Object.entries(value)) {
    if (!groupKey.startsWith("~:") || !isMap(features)) continue;
    const group = new Map<string, number>();
    for (const [name, n] of Object.entries(features)) if (count(n) > 0) group.set(unescapeKey(name), n as number);
    if (group.size > 0) spent.set(untag(groupKey), group);
  }
  return spent;
}

/**
 * The spent uses of one feature, by its name and its unit as built gives
 * it. With `amount`, the uses of the feature, a count above it reads as the
 * amount ("all spent"); the stored count stays.
 */
export function featureUsesSpent(entity: StrictEntity, units: string | null | undefined, name: string, amount?: number): number {
  return count(usesSpent(entity).get(rechargeGroup(units))?.get(name), amount);
}

/**
 * Writes the spent uses. The value replaces the full map, so give each
 * group. A feature with 0 spent and a group with no feature are left out;
 * with none at all the key goes. A rest writes this with its groups cleared.
 */
export function setUsesSpent(e: Engine, entity: StrictEntity, spent: UsesSpent) {
  const value: Record<string, Record<string, number>> = {};
  for (const [group, features] of spent) {
    const entries = [...features].filter(([, n]) => count(Math.trunc(n)) > 0).map(([name, n]) => [escapeKey(name), Math.trunc(n)]);
    if (entries.length > 0) value[tag(rechargeGroup(group))] = Object.fromEntries(entries);
  }
  return e.setValue(entity, USES_SPENT, value);
}

/** Writes the spent uses of one feature, by its name and its unit as built gives it. 0 or less removes its entry. */
export function setFeatureUsesSpent(e: Engine, entity: StrictEntity, units: string | null | undefined, name: string, spent: number) {
  const all = new Map([...usesSpent(entity)].map(([group, features]) => [group, new Map(features)]));
  const group = rechargeGroup(units);
  const features = all.get(group) ?? new Map<string, number>();
  features.set(name, spent);
  all.set(group, features);
  return setUsesSpent(e, entity, all);
}

// Concentration.

/** The spell key of the concentration mark, such as "bless"; null without a mark. */
export function concentration(entity: StrictEntity): string | null {
  const value = stored(entity, CONCENTRATION);
  return typeof value === "string" && value.startsWith("~:") && value.length > 2 ? untag(value) : null;
}

/** Writes the concentration mark: a spell key, or null (or "") to remove it. */
export function setConcentration(e: Engine, entity: StrictEntity, spellKey: string | null) {
  return e.setValue(entity, CONCENTRATION, spellKey ? tag(spellKey) : null);
}

// Conditions.

/** The 14 conditions of the SRD, in their order on the sheet. There are no others. */
export const CONDITION_KEYS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;

/** A condition of the SRD. */
export type Condition = (typeof CONDITION_KEYS)[number];

const isCondition = (key: string): key is Condition => (CONDITION_KEYS as readonly string[]).includes(key);

/** The conditions that are set. A condition that is not in the SRD list reads as not set. */
export function conditions(entity: StrictEntity): ReadonlySet<Condition> {
  const items = setItems(stored(entity, CONDITIONS));
  const keys = (Array.isArray(items) ? items : []).filter((item): item is string => typeof item === "string" && item.startsWith("~:")).map(untag);
  return new Set(keys.filter(isCondition));
}

/**
 * Writes the conditions that are set. The value replaces the full set. A
 * key that is not in the SRD list is left out; with none the key goes.
 */
export function setConditions(e: Engine, entity: StrictEntity, set: Iterable<string>) {
  const keys = new Set(set);
  return e.setValue(entity, CONDITIONS, asSet(CONDITION_KEYS.filter((key) => keys.has(key)).map(tag)));
}

// Exhaustion.

/** The highest exhaustion level: death. */
export const EXHAUSTION_LIMIT = 6;

/** The exhaustion level, from 0 to 6. A value that is not valid reads as 0, and a level above 6 reads as 6. */
export function exhaustion(entity: StrictEntity): number {
  return count(stored(entity, EXHAUSTION), EXHAUSTION_LIMIT);
}

/** Writes the exhaustion level, kept from 0 to 6. Level 0 removes the key. */
export function setExhaustion(e: Engine, entity: StrictEntity, level: number) {
  const value = count(Math.trunc(level), EXHAUSTION_LIMIT);
  return e.setValue(entity, EXHAUSTION, value > 0 ? value : null);
}

// Inspiration.

/** True when the character has inspiration. Only a stored true counts. */
export function inspiration(entity: StrictEntity): boolean {
  return stored(entity, INSPIRATION) === true;
}

/** Writes inspiration: true, or no key without it. */
export function setInspiration(e: Engine, entity: StrictEntity, on: boolean) {
  return e.setValue(entity, INSPIRATION, on ? true : null);
}

// AC pick.

/** The armor and shield that the Armor Class box shows, as item keys; null for none of the two. */
export interface AcPick {
  armor: string | null;
  shield: string | null;
}

/** An item key from its tagged value: undefined for a value that is not valid. */
const itemKey = (value: unknown): string | null | undefined =>
  value === null || value === undefined ? null : typeof value === "string" && value.startsWith("~:") && value.length > 2 ? untag(value) : undefined;

/**
 * The AC pick; null without one, which means the worn armor. A value that is
 * not a map with valid keys reads as null. This does not check that the
 * pair is in the table "AC by armor": the caller ignores a pair that is not.
 */
export function acPick(entity: StrictEntity): AcPick | null {
  const value = stored(entity, AC_PICK);
  if (!isMap(value) || !(ARMOR in value || SHIELD in value)) return null;
  const armor = itemKey(value[ARMOR]);
  const shield = itemKey(value[SHIELD]);
  return armor === undefined || shield === undefined ? null : { armor, shield };
}

/** Writes the AC pick; null removes it, so that the worn armor shows. */
export function setAcPick(e: Engine, entity: StrictEntity, pick: AcPick | null) {
  return e.setValue(entity, AC_PICK, pick === null ? null : { [ARMOR]: pick.armor ? tag(pick.armor) : null, [SHIELD]: pick.shield ? tag(pick.shield) : null });
}
