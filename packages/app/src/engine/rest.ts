// The rules of the rests (ORC-318, ORC-319, docs/design/sheet-interactivity.md
// "Rests"): what a Short rest, a Long rest and Dawn can change, the limits of
// Arcane Recovery, and the rows of the list "This rest will change". Each
// rule is a pure function of the sheet and of the picks of the dialog. No
// engine and no React: applyRest (rest-apply.ts) writes the changes with
// play.ts and spells.ts.
import { unqualify } from "./content.ts";
import { dieName, type HitDie, hitDieHealing, validRoll } from "./hit-dice.ts";
import { type FeatureUsesKey, rechargeGroup } from "./play.ts";
import { featureUses, ordinal, type Sheet } from "./sheet.ts";

/** An entry of the Rest menu. */
export type RestKind = "short" | "long" | "dawn";

/** The name of each entry of the Rest menu, and the title of its dialog. */
export const REST_NAMES: Record<RestKind, string> = { short: "Short rest", long: "Long rest", dawn: "Dawn" };

/** The unit name of the uses that come back at dawn. The sheet calls the unit `day` "Dawn". */
const DAWN_UNIT = "day";

/** True for a recharge group (play.ts rechargeGroup) whose uses come back at dawn. */
export const dawnGroup = (group: string) => unqualify(group) === DAWN_UNIT;

/** True when the character has one feature or more with Dawn uses, spent or not. */
export const hasDawnUses = (sheet: Pick<Sheet, "features">) => featureUses(sheet).some((u) => dawnGroup(rechargeGroup(u.units)));

/** The entries of the Rest menu for a sheet, in their order: Dawn only with Dawn uses. */
export function restKinds(sheet: Pick<Sheet, "features">): RestKind[] {
  return hasDawnUses(sheet) ? ["short", "long", "dawn"] : ["short", "long"];
}

/** A hit die that the user spends in the Short rest dialog: its size and the number on the die. */
export interface SpentDie {
  die: number;
  roll: number;
}

/** The uses that come back at dawn, as the key of a RestUse to the number that comes back. */
export type DawnBack = ReadonlyMap<string, number>;

/**
 * The picks of a rest dialog, which Finish writes as one sheet change.
 *
 * - Short rest: the hit dice that the user spent, in their order, and the
 *   slots that Arcane Recovery gives back, as slot level to the number of
 *   slots.
 * - Long rest: the checkboxes "Ate and drank" and "Dawn came during the
 *   rest", and the numbers of the Dawn list. A checkbox that does not show
 *   changes nothing.
 * - Dawn: the numbers of the Dawn list.
 */
export type RestAction =
  | { kind: "short"; dice: readonly SpentDie[]; arcaneRecovery: ReadonlyMap<number, number> }
  | { kind: "long"; ate: boolean; dawn: boolean; back: DawnBack }
  | { kind: "dawn"; back: DawnBack };

/** The unit names of the uses that a Short rest gives back. A DMV "rest" is a short or a long rest. */
const SHORT_REST_UNITS = new Set(["short-rest", "rest"]);

/** The unit names of the uses that a Long rest gives back. Round, minute and hour uses do not come back at a rest. */
const LONG_REST_UNITS = new Set(["short-rest", "rest", "long-rest"]);

/** True for a recharge group (play.ts rechargeGroup) whose uses come back at a Short rest. */
export const shortRestGroup = (group: string) => SHORT_REST_UNITS.has(unqualify(group));

/** True for a recharge group (play.ts rechargeGroup) whose uses come back at a Long rest. */
export const longRestGroup = (group: string) => LONG_REST_UNITS.has(unqualify(group));

/** The name of the feature Arcane Recovery, as built gives it. */
export const ARCANE_RECOVERY = "Arcane Recovery";

/** The highest slot level that Arcane Recovery gives back: no slot of 6th level or higher. */
export const ARCANE_RECOVERY_TOP_LEVEL = 5;

/** The sum of the slot levels that Arcane Recovery gives back: half the wizard level, rounded up. */
export const arcaneRecoveryLimit = (wizardLevel: number) => Math.ceil(Math.max(0, wizardLevel) / 2);

/** Arcane Recovery in a Short rest: the key of its use, its limit, and each slot level that it can give back. */
export interface ArcaneRecovery {
  /** The key of the spent count of the feature (play.ts). */
  use: FeatureUsesKey;
  /** The highest sum of the slot levels: half the wizard level, rounded up. */
  limit: number;
  /**
   * Each slot level that it can give back, the lowest first: a level with a
   * spent slot that is not a pact slot, of 5th level or lower, and not above
   * the limit. `spent` is the spent slots of that level.
   */
  slots: { level: number; spent: number }[];
}

/** A spent use that a rest gives back, by feature name. Two features with the same name and group share it. */
export interface RestUse {
  /** A key that no other use of the rest has: the recharge group and the feature name as built gives it. */
  key: string;
  /** The key of the spent count in the record (play.ts). */
  use: FeatureUsesKey;
  /** The feature name that the sheet shows. */
  name: string;
  /** The spent uses, from 0 to the amount. */
  spent: number;
}

/**
 * The uses of the features of a sheet whose recharge group passes `inGroup`,
 * one for each group and feature name, in the order of the sheet. Two
 * features that share a count give one use. Without `all`, only the uses
 * with a spent count.
 */
function restUses(sheet: Pick<Sheet, "features">, inGroup: (group: string) => boolean, all = false): RestUse[] {
  const uses = new Map<string, RestUse>();
  const { actions, bonusActions, reactions, traits } = sheet.features;
  for (const feature of [...actions, ...bonusActions, ...reactions, ...traits]) {
    const u = feature.uses;
    if (!u || (!all && u.spent <= 0) || !inGroup(rechargeGroup(u.units))) continue;
    const key = `${rechargeGroup(u.units)}\n${u.name}`;
    const known = uses.get(key);
    uses.set(key, { key, use: known?.use ?? { units: u.units, name: u.name }, name: known?.name ?? feature.name, spent: Math.max(known?.spent ?? 0, u.spent) });
  }
  return [...uses.values()];
}

/** What a Short rest can change, read from the sheet when the dialog opens. */
export interface ShortRest {
  /** The hit points before the rest, as the sheet shows them, and the maximum. */
  current: number;
  max: number;
  conModifier: number;
  /** The hit dice of each die size, with the dice left before the rest. */
  dice: HitDie[];
  /** The spent Pact Magic slots, which all come back; 0 without Pact Magic. */
  pactSpent: number;
  /** The spent uses of the groups `short-rest` and `rest`, by feature name, in the order of the sheet. */
  uses: RestUse[];
  /** null when the character has no Arcane Recovery, or when its use is spent. */
  arcaneRecovery: ArcaneRecovery | null;
}

/** Arcane Recovery of a sheet, or null: no wizard level, no feature, or its use spent. */
function arcaneRecoveryOf(sheet: Pick<Sheet, "classes" | "features" | "spellcasting">): ArcaneRecovery | null {
  const wizardLevel = sheet.classes.find((c) => c.key === "wizard")?.level ?? 0;
  const uses = featureUses(sheet).find((u) => u.name === ARCANE_RECOVERY);
  if (wizardLevel <= 0 || !uses || uses.spent >= uses.amount) return null;
  const limit = arcaneRecoveryLimit(wizardLevel);
  const slots = (sheet.spellcasting?.slots ?? [])
    .filter(({ level, spent }) => spent > 0 && level <= ARCANE_RECOVERY_TOP_LEVEL && level <= limit)
    .map(({ level, spent }) => ({ level, spent }));
  return { use: { units: uses.units, name: uses.name }, limit, slots };
}

/** What a Short rest can change for a sheet. */
export function shortRest(
  sheet: Pick<Sheet, "currentHitPoints" | "maxHitPoints" | "abilities" | "hitDice" | "spellcasting" | "features" | "classes">,
): ShortRest {
  return {
    current: sheet.currentHitPoints ?? sheet.maxHitPoints,
    max: sheet.maxHitPoints,
    conModifier: sheet.abilities.find((a) => a.ability === "con")?.modifier ?? 0,
    dice: sheet.hitDice,
    pactSpent: sheet.spellcasting?.pact?.spent ?? 0,
    uses: restUses(sheet, shortRestGroup),
    arcaneRecovery: arcaneRecoveryOf(sheet),
  };
}

/** The hit points that the spent dice heal, before the stop at the maximum. */
export const diceHealing = (dice: readonly SpentDie[], conModifier: number) => dice.reduce((sum, { roll }) => sum + hitDieHealing(roll, conModifier), 0);

/** The hit points after the spent dice: they stop at the maximum. */
export const hitPointsAfter = (rest: ShortRest, dice: readonly SpentDie[]) => Math.min(rest.max, rest.current + diceHealing(dice, rest.conModifier));

/** True when the dice can heal: the hit points are below the maximum and a die is left. The rows of hit points and hit dice show only then. */
export const canHeal = (rest: ShortRest) => rest.current < rest.max && rest.dice.some((d) => d.left > 0);

/** The dice of each size that are left after the spent dice of the dialog. */
export function diceLeft(rest: ShortRest, dice: readonly SpentDie[]): HitDie[] {
  return rest.dice.map((d) => ({ ...d, left: Math.max(0, d.left - dice.filter((s) => s.die === d.die).length) }));
}

/**
 * True when the user can spend one more die of a size: a die of that size
 * is left, and the hit points after the dice spent are below the maximum.
 */
export function canSpendDie(rest: ShortRest, dice: readonly SpentDie[], die: number): boolean {
  return (diceLeft(rest, dice).find((d) => d.die === die)?.left ?? 0) > 0 && hitPointsAfter(rest, dice) < rest.max;
}

/**
 * The dice of the picks that the rest can spend, in their order: a die
 * with a valid roll, while a die of its size is left and the hit points are
 * below the maximum. Another die is left out.
 */
export function validDice(rest: ShortRest, dice: readonly SpentDie[]): SpentDie[] {
  const kept: SpentDie[] = [];
  for (const d of dice) if (validRoll(d.roll, d.die) !== null && canSpendDie(rest, kept, d.die)) kept.push(d);
  return kept;
}

/** The sum of the slot levels of the picks of Arcane Recovery. */
export const slotLevelSum = (picks: ReadonlyMap<number, number>) => [...picks].reduce((sum, [level, n]) => sum + level * n, 0);

/** True when Arcane Recovery can give back one more slot of a level: a spent slot of that level is not picked yet, and the sum stays at the limit or below. */
export function canPickSlot(recovery: ArcaneRecovery, picks: ReadonlyMap<number, number>, level: number): boolean {
  const slot = recovery.slots.find((s) => s.level === level);
  return slot !== undefined && (picks.get(level) ?? 0) < slot.spent && slotLevelSum(picks) + level <= recovery.limit;
}

/**
 * The picks of Arcane Recovery that the rest can give back, as slot level to
 * the number of slots: only spent slots of the levels that it can give
 * back, while the sum stays at the limit or below. Another pick is left out.
 */
export function validSlotPicks(recovery: ArcaneRecovery | null, picks: ReadonlyMap<number, number>): Map<number, number> {
  const kept = new Map<number, number>();
  if (recovery === null) return kept;
  for (const [level, n] of [...picks].sort(([a], [b]) => a - b)) {
    for (let i = 0; i < n && canPickSlot(recovery, kept, level); i++) kept.set(level, (kept.get(level) ?? 0) + 1);
  }
  return kept;
}

/** A count that changes, with its sign: "+2", "−1" with the minus sign U+2212. */
export const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** A value that changes, with an arrow: "20 → 24". */
export const arrow = (from: number, to: number) => `${from} → ${to}`;

/** A row of the list "This rest will change": a key that no other row of the list has, its name, and its change, or null for "No change". */
export interface RestRow {
  key: string;
  label: string;
  change: string | null;
}

/** True when no row of the list changes a value. */
export const nothingChanges = (rows: readonly RestRow[]) => rows.every((row) => row.change === null);

/** The row of a use that comes back: its key holds the group, so two features with the same name in two groups have two keys. */
const useRow = (use: RestUse): RestRow => ({ key: `use ${use.key}`, label: use.name, change: signed(use.spent) });

/** The name of the slots of a level in the list: "1st-level slots". */
export const slotsName = (level: number) => `${ordinal(level)}-level slots`;

/**
 * The rows of the list "This rest will change" of a Short rest. The set of
 * rows comes from the rest alone, so it does not change while the user
 * spends dice and picks slots: hit points and one row for each die size
 * with a die left, when the dice can heal; the Pact Magic slots when one is
 * spent; each spent use of the groups `short-rest` and `rest`, by name; and
 * with Arcane Recovery, one row for each slot level it can give back and
 * one for its use.
 */
export function shortRestRows(rest: ShortRest, action: Pick<Extract<RestAction, { kind: "short" }>, "dice" | "arcaneRecovery">): RestRow[] {
  const dice = validDice(rest, action.dice);
  const rows: RestRow[] = [];
  if (canHeal(rest)) {
    const after = hitPointsAfter(rest, dice);
    rows.push({ key: "hit points", label: "Hit points", change: dice.length > 0 ? `${arrow(rest.current, after)} / ${rest.max}` : null });
    for (const { die, left } of rest.dice) {
      if (left <= 0) continue;
      const n = dice.filter((d) => d.die === die).length;
      rows.push(hitDiceRow(die, n > 0 ? signed(-n) : null));
    }
  }
  if (rest.pactSpent > 0) rows.push(pactRow(rest.pactSpent));
  for (const use of rest.uses) rows.push(useRow(use));
  const recovery = rest.arcaneRecovery;
  if (recovery) {
    const picks = validSlotPicks(recovery, action.arcaneRecovery);
    for (const { level } of recovery.slots) {
      const n = picks.get(level) ?? 0;
      rows.push(slotsRow(level, n > 0 ? signed(n) : null));
    }
    rows.push({ key: "arcane recovery", label: ARCANE_RECOVERY, change: picks.size > 0 ? signed(-1) : null });
  }
  return rows;
}

const hitDiceRow = (die: number, change: string | null): RestRow => ({ key: `hit dice ${die}`, label: `Hit dice (${dieName(die)})`, change });
const slotsRow = (level: number, change: string | null): RestRow => ({ key: `slots ${level}`, label: slotsName(level), change });
const pactRow = (spent: number): RestRow => ({ key: "pact slots", label: "Pact Magic slots", change: signed(spent) });

/**
 * True when the picks of a Short rest dialog can change whether the rest
 * changes nothing: with no picks it changes nothing, and the dice can heal or
 * Arcane Recovery has a slot to give back. The dialog then keeps the space of
 * the line "Nothing will change." while the user picks.
 */
export const shortRestPicks = (rest: ShortRest) =>
  nothingChanges(shortRestRows(rest, { dice: [], arcaneRecovery: new Map() })) && (canHeal(rest) || (rest.arcaneRecovery?.slots.length ?? 0) > 0);

// Long rest and Dawn.

/** The hit dice of one size that a Long rest gives back. */
export interface DiceBack {
  die: number;
  back: number;
}

/**
 * The spent hit dice that a Long rest gives back: up to half the total number
 * of hit dice, rounded down, and at least 1. The largest die comes back first.
 * Only the sizes with a die back are in the list.
 */
export function hitDiceBack(dice: readonly HitDie[]): DiceBack[] {
  let n = Math.max(1, Math.floor(dice.reduce((sum, d) => sum + d.total, 0) / 2));
  const back: DiceBack[] = [];
  for (const { die, total, left } of [...dice].sort((a, b) => b.die - a.die)) {
    const k = Math.min(n, total - left);
    if (k <= 0) continue;
    back.push({ die, back: k });
    n -= k;
  }
  return back;
}

/** What a Long rest can change, read from the sheet when the dialog opens. */
export interface LongRest {
  /** The hit points before the rest, as the sheet shows them, and the maximum. */
  current: number;
  max: number;
  temp: number;
  /** The spent slots of each level that are not pact slots, the lowest level first. Only levels with a spent slot. */
  slots: { level: number; spent: number }[];
  /** The spent Pact Magic slots; 0 without Pact Magic. */
  pactSpent: number;
  /** The spent uses of the groups `short-rest`, `rest` and `long-rest`, by feature name. */
  uses: RestUse[];
  /** The spent hit dice that come back, the largest die first. */
  dice: DiceBack[];
  /** True when a death save count is above 0. */
  deathSaves: boolean;
  /** True with a concentration mark. */
  concentration: boolean;
  /** The exhaustion level: "Ate and drank" shows when it is above 0. */
  exhaustion: number;
  /** Each use of the group `day`, spent or not: "Dawn came during the rest" shows when there is one. */
  dawn: RestUse[];
}

type LongRestSheet = Pick<
  Sheet,
  "currentHitPoints" | "maxHitPoints" | "tempHitPoints" | "spellcasting" | "features" | "hitDice" | "deathSaves" | "concentration" | "exhaustion"
>;

/** What a Long rest can change for a sheet. */
export function longRest(sheet: LongRestSheet): LongRest {
  return {
    current: sheet.currentHitPoints ?? sheet.maxHitPoints,
    max: sheet.maxHitPoints,
    temp: sheet.tempHitPoints,
    slots: (sheet.spellcasting?.slots ?? []).filter(({ spent }) => spent > 0).map(({ level, spent }) => ({ level, spent })),
    pactSpent: sheet.spellcasting?.pact?.spent ?? 0,
    uses: restUses(sheet, longRestGroup),
    dice: hitDiceBack(sheet.hitDice),
    deathSaves: sheet.deathSaves.successes > 0 || sheet.deathSaves.failures > 0,
    concentration: sheet.concentration !== null,
    exhaustion: sheet.exhaustion,
    dawn: dawnUses(sheet),
  };
}

/** Each use of the group `day` of a sheet, spent or not, by feature name: the Dawn list. */
export const dawnUses = (sheet: Pick<Sheet, "features">) => restUses(sheet, dawnGroup, true);

/** The fields of the Dawn list at the open: each starts at the spent count, so all uses come back. */
export const dawnStart = (uses: readonly RestUse[]): Map<string, number> => new Map(uses.map((u) => [u.key, u.spent]));

/** The numbers of the Dawn list, as the key of a use to its field: null for an empty field. */
export type DawnFields = ReadonlyMap<string, number | null>;

/** The fields of the Dawn list as the picks of a rest: an empty field gives back 0. */
export const dawnBack = (fields: DawnFields): Map<string, number> => new Map([...fields].map(([key, n]) => [key, n ?? 0]));

/** True when the Dawn dialog with these numbers changes nothing: no use comes back. */
export const dawnChangesNothing = (uses: readonly RestUse[], back: DawnBack) => validBack(uses, back).size === 0;

/**
 * True when the numbers of the Dawn dialog can change whether it changes
 * nothing: a use is spent. The dialog then keeps the space of the line
 * "Nothing will change." while the user picks.
 */
export const dawnReserve = (uses: readonly RestUse[]) => uses.some((u) => u.spent > 0);

/**
 * The numbers of the Dawn list that the rest can give back, as the key of a
 * use to a number from 1 to its spent count. A field above the spent count
 * stops at it; an empty field, a number of 0 or less, or a key of no use is
 * left out.
 */
export function validBack(uses: readonly RestUse[], back: DawnBack): Map<string, number> {
  const kept = new Map<string, number>();
  for (const { key, spent } of uses) {
    const n = Math.min(spent, Math.trunc(back.get(key) ?? 0));
    if (n > 0) kept.set(key, n);
  }
  return kept;
}

/**
 * The rows of the list "This rest will change" of a Long rest, in the order
 * of the spec. The set of rows comes from the rest alone. With "Ate and
 * drank" (exhaustion above 0), the row "Exhaustion" shows; it says "No
 * change" when the checkbox is off. The Dawn list has its own fields, so it
 * has no rows here.
 */
export function longRestRows(rest: LongRest, action: Pick<Extract<RestAction, { kind: "long" }>, "ate">): RestRow[] {
  const rows: RestRow[] = [];
  // rest.max is sheet.maxHitPoints before the rest. ORC-323 (exhaustion halves the maximum) must compute this row from the
  // exhaustion level after the rest, as "Ate and drank" can change it.
  if (rest.current < rest.max) rows.push({ key: "hit points", label: "Hit points", change: `${arrow(rest.current, rest.max)} / ${rest.max}` });
  if (rest.temp > 0) rows.push({ key: "temp hit points", label: "Temporary hit points", change: arrow(rest.temp, 0) });
  for (const { level, spent } of rest.slots) rows.push(slotsRow(level, signed(spent)));
  if (rest.pactSpent > 0) rows.push(pactRow(rest.pactSpent));
  for (const use of rest.uses) rows.push(useRow(use));
  for (const { die, back } of rest.dice) rows.push(hitDiceRow(die, signed(back)));
  if (rest.deathSaves) rows.push({ key: "death saves", label: "Death saves", change: "cleared" });
  if (rest.concentration) rows.push({ key: "concentration", label: "Concentration", change: "cleared" });
  if (rest.exhaustion > 0) rows.push({ key: "exhaustion", label: "Exhaustion", change: action.ate ? arrow(rest.exhaustion, rest.exhaustion - 1) : null });
  return rows;
}

/** True when a Long rest with these picks changes nothing: no row changes, and no Dawn use comes back. */
export const longRestChangesNothing = (rest: LongRest, action: Omit<Extract<RestAction, { kind: "long" }>, "kind">) =>
  nothingChanges(longRestRows(rest, action)) && (!action.dawn || validBack(rest.dawn, action.back).size === 0);

/** True when the Long rest dialog has a checkbox: "Ate and drank" or "Dawn came during the rest". */
export const longRestPicks = (rest: LongRest) => rest.exhaustion > 0 || rest.dawn.length > 0;

/**
 * True when the picks of a Long rest dialog can change whether the rest
 * changes nothing: with both checkboxes off it changes nothing, and with
 * them on it changes something. The dialog then keeps the space of the line
 * "Nothing will change." while the user picks.
 */
export const longRestReserve = (rest: LongRest) =>
  longRestChangesNothing(rest, { ate: false, dawn: false, back: new Map() }) &&
  !longRestChangesNothing(rest, { ate: true, dawn: true, back: dawnStart(rest.dawn) });

/** The text of the status line after a rest. */
export const restStatus = (kind: RestKind) => `${REST_NAMES[kind]} finished.`;
