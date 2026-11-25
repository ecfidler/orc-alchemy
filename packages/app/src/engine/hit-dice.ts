// The rules of the Hit dice box (ORC-317, docs/design/sheet-interactivity.md
// "Hit dice"): the dice of a character by die size, the dice left, and Spend
// and Regain of the Hit dice popup. Each rule is a pure function. No engine
// and no React: applyHitDice (hit-dice-apply.ts) reads the play state, heals
// with the Heal rule of hit-points.ts and writes the spent dice with play.ts.
// The Short rest dialog (ORC-318) uses the same rules for its Spend.
import type { HitDiceSpent } from "./play.ts";

/** The hit dice of one die size. */
export interface HitDie {
  /** The die size: 10 for a d10. */
  die: number;
  /** The hit dice of this size: the sum of the levels of the classes with this die. */
  total: number;
  /** The dice of this size that are not spent: from 0 to `total`. */
  left: number;
}

/** An action of the Hit dice popup. `roll` is the number on the die, a whole number from 1 to the die size. */
export type HitDiceAction = { kind: "spend"; die: number; roll: number } | { kind: "regain"; die: number };

/** What an action changes, and the text of the status line. */
export interface HitDiceChange {
  /** The die size of the action. */
  die: number;
  /** The new spent count of that die size. */
  spent: number;
  /** The hit points that Spend heals by the Heal rule: 0 or more. null for Regain, which does not change the hit points. */
  heal: number | null;
  /** What changed, for the status line: "Hit die d10: 7 + 2 = 9 healed." */
  status: string;
}

/**
 * The hit dice of each die size, as die size to the number of dice: one die
 * for each class level. Two classes with the same die size share one entry.
 * The largest die comes first. A class with no die size or no level adds
 * nothing.
 */
export function hitDiceTotals(classes: readonly { hitDie: number; level: number }[]): ReadonlyMap<number, number> {
  const totals = new Map<number, number>();
  for (const { hitDie, level } of classes) {
    if (!Number.isInteger(hitDie) || hitDie <= 0 || !Number.isInteger(level) || level <= 0) continue;
    totals.set(hitDie, (totals.get(hitDie) ?? 0) + level);
  }
  return new Map([...totals].sort(([a], [b]) => b - a));
}

/**
 * The hit dice of each die size with the dice left, in the order of
 * `totals`. `spent` is the record as play.ts hitDiceSpent reads it; a count
 * above the total reads as all spent.
 */
export function hitDiceLeft(totals: ReadonlyMap<number, number>, spent: HitDiceSpent): HitDie[] {
  return [...totals].map(([die, total]) => ({ die, total, left: total - Math.min(total, spent.get(die) ?? 0) }));
}

/** The text of a die size: "d10". */
export const dieName = (die: number) => `d${die}`;

/** A roll of the Roll field: a whole number from 1 to the die size, or null for another value. */
export function validRoll(roll: number | null | undefined, die: number): number | null {
  return typeof roll === "number" && Number.isInteger(roll) && roll >= 1 && roll <= die ? roll : null;
}

/** A roll of the die, for Roll for me. `random` gives a number from 0 up to 1, as Math.random does. */
export function rollDie(die: number, random: () => number = Math.random): number {
  return Math.min(die, Math.max(1, 1 + Math.floor(random() * die)));
}

/** The hit points that a die heals: the roll and the Constitution modifier, 0 or more. */
export const hitDieHealing = (roll: number, conModifier: number) => Math.max(0, roll + conModifier);

/** A signed term: "+ 2", "− 1" with the minus sign U+2212. */
const term = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);

/**
 * The status text of Spend: "Hit die d10: 7 + 2 = 9 healed.", "Hit die d6:
 * 4 − 1 = 3 healed.", and when the sum is below 0, "Hit die d6: 1 − 2 = −1,
 * 0 healed."
 */
export function spendStatus(die: number, roll: number, conModifier: number): string {
  const sum = roll + conModifier;
  const healed = hitDieHealing(roll, conModifier);
  const result = sum < 0 ? `−${-sum}, ${healed}` : `${healed}`;
  return `Hit die ${dieName(die)}: ${roll} ${term(conModifier)} = ${result} healed.`;
}

/** The status text of Regain: "Hit die d10 regained." */
export const regainStatus = (die: number) => `Hit die ${dieName(die)} regained.`;

/**
 * The change of an action, or null when the action cannot be done: Spend
 * with no die of that size left or with a roll that is not valid, Regain
 * with no die of that size spent, or a die size that the character does not
 * have. Spend works at full hit points: the heal then changes nothing.
 */
export function applyHitDiceAction(dice: readonly HitDie[], conModifier: number, action: HitDiceAction): HitDiceChange | null {
  const hitDie = dice.find((d) => d.die === action.die);
  if (!hitDie) return null;
  const spent = hitDie.total - hitDie.left;
  if (action.kind === "regain") {
    if (spent === 0) return null;
    return { die: hitDie.die, spent: spent - 1, heal: null, status: regainStatus(hitDie.die) };
  }
  const roll = validRoll(action.roll, hitDie.die);
  if (hitDie.left === 0 || roll === null) return null;
  return { die: hitDie.die, spent: spent + 1, heal: hitDieHealing(roll, conModifier), status: spendStatus(hitDie.die, roll, conModifier) };
}
