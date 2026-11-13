// The uses of a homebrew feature as the form stores them: the :frequency of
// the feature, {:units <unit> :amount <amount>} (docs/design/homebrew-forms.md,
// "Stored shape"). The functions here read a stored frequency for the uses
// control, give the options of its toggles and selects, and make the
// frequency to store after one change by the user. A change keeps the other
// keys of the stored map, so a key that the form does not know stays. Only a
// change writes: a frequency that the user does not touch stays as it was,
// also a short unit or a unit of the old app. The example character and the
// sentence of the preview are in uses-example.ts.
import { tag, untag } from "../../engine/content.ts";
import { abilityOfKey, scaledBase, unqualify, type Ability } from "../../engine/sheet.ts";
import type { SuggestedUses } from "./suggested-uses.ts";

/** A stored map in verbose Transit-JSON, such as a :frequency or its :amount. */
type TransitMap = Record<string, unknown>;

export type UsesKind = "none" | "fixed" | "scaled";

export const USES_KINDS: [UsesKind, string][] = [
  ["none", "None"],
  ["fixed", "Fixed"],
  ["scaled", "Scaled"],
];

/** The namespace of a full unit keyword. */
const UNITS = "orcpub.dnd.e5.units/";

/** The rests of the Recharges toggle, by the name of their unit. A "short or long rest" is a short rest. */
export const RECHARGES: [string, string][] = [
  ["short-rest", "Short rest"],
  ["long-rest", "Long rest"],
  ["day", "Day"],
  ["turn", "Turn"],
];

/** The unit of a new frequency, and of a stored one that has no unit. */
const DEFAULT_UNIT = "long-rest";

/** The fixed amounts of the Amount select. */
export const FIXED_AMOUNTS = [...Array.from({ length: 20 }, (_, i) => i + 1), 25, 30, 40, 50, 100];
/** The numbers of the "n" select, which multiplies a level. */
export const TIMES = [1, 2, 3, 4, 5, 10];
/** The numbers of the Plus select. */
export const PLUSES = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
/** The numbers of the Minimum select, after None. */
export const MINIMUMS = [0, 1, 2, 3, 4, 5];

const isMap = (value: unknown): value is TransitMap => typeof value === "object" && value !== null && !Array.isArray(value);

/** The stored frequency as a map, or undefined for no uses. */
const frequencyMap = (frequency: unknown) => (isMap(frequency) ? frequency : undefined);

/** The kind of the stored uses: none, a fixed amount (also no amount, which the sheet shows as 1 use), or a scaled amount. */
export function usesKind(frequency: unknown): UsesKind {
  const map = frequencyMap(frequency);
  if (!map) return "none";
  return isMap(map[tag("amount")]) ? "scaled" : "fixed";
}

/** The name of the stored unit, without the "~:" and the namespace: "long-rest". Undefined when there is no unit. */
export function unitName(frequency: unknown): string | undefined {
  const units = frequencyMap(frequency)?.[tag("units")];
  return typeof units === "string" ? unqualify(untag(units)) : undefined;
}

/** "rest-of-day" → "Rest of day". */
const sentenceCase = (name: string) => {
  const words = name.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/**
 * The segments of the Recharges toggle: the four rests, and a unit of the
 * stored pack that is none of them, such as a minute, as one more segment
 * "Minute (from the pack)". The value of a segment is the unit's name.
 */
export function rechargeOptions(frequency: unknown): [string, string][] {
  const unit = unitName(frequency);
  if (unit === undefined || RECHARGES.some(([name]) => name === unit)) return RECHARGES;
  return [...RECHARGES, [unit, `${sentenceCase(unit)} (from the pack)`]];
}

/**
 * The unit to store after a change of the uses: the full keyword. A short
 * unit, such as :short-rest, gets the namespace; a full unit stays as it is.
 * No unit is a long rest.
 */
function fullUnit(frequency: TransitMap | undefined): string {
  const units = frequency?.[tag("units")];
  if (typeof units !== "string") return tag(UNITS + DEFAULT_UNIT);
  const name = untag(units);
  return name.includes("/") ? units : tag(UNITS + name);
}

/** The stored frequency with the amount, and with its unit as the full keyword. Its other keys stay. */
function withAmount(frequency: unknown, amount: unknown): TransitMap {
  const map = frequencyMap(frequency);
  return { ...map, [tag("units")]: fullUnit(map), [tag("amount")]: amount };
}

/**
 * The frequency to store when the user presses a kind: none removes the
 * frequency, fixed stores 1 use, and scaled stores the proficiency bonus.
 * The rest stays.
 */
export function withKind(frequency: unknown, kind: UsesKind): TransitMap | undefined {
  if (kind === usesKind(frequency)) return frequencyMap(frequency);
  if (kind === "none") return undefined;
  return withAmount(frequency, kind === "fixed" ? 1 : { [tag("prof-bonus")]: true });
}

/** The frequency with a fixed amount. */
export const withFixed = (frequency: unknown, amount: number) => withAmount(frequency, amount);

/**
 * The frequency with the unit of the rest the user pressed, as its full
 * keyword. The segment of a unit from the pack is always the pressed one,
 * so it never comes here.
 */
export const withUnit = (frequency: unknown, name: string): TransitMap => ({ ...frequencyMap(frequency), [tag("units")]: tag(UNITS + name) });

/** The stored amount: a number, a scaled map, or undefined. */
export const amountOf = (frequency: unknown): unknown => frequencyMap(frequency)?.[tag("amount")];

/** The scaled amount of the stored frequency, or an empty map. */
export const scaledOf = (frequency: unknown): TransitMap => {
  const amount = amountOf(frequency);
  return isMap(amount) ? amount : {};
};

/**
 * The base of a scaled amount, as the "Equal to" select has it: "prof",
 * "level", or the ability's name such as "wis". The engine reads the bases
 * in the order ability, proficiency bonus, level, so the first one that the
 * map has is the base. Undefined when the map has none.
 */
export function baseOf(frequency: unknown): string | undefined {
  const base = scaledBase(scaledOf(frequency));
  return typeof base === "object" ? unqualify(untag(base.ability)) : base;
}

/** The ability of a scaled amount's base, or null when the base is not one of the six abilities. */
export const baseAbility = (frequency: unknown): Ability | null => abilityOfKey(baseOf(frequency));

const BASE_KEYS = ["ability", "prof-bonus", "level", "times"].map(tag);

/**
 * The frequency with the base that the user picked. The other bases and
 * :times go; :plus and :min stay. An ability is stored as its bare key,
 * such as :wis, and a change to an ability from another base sets the
 * minimum to 1.
 */
export function withBase(frequency: unknown, base: string): TransitMap | undefined {
  const before = baseOf(frequency);
  if (base === before) return frequencyMap(frequency);
  const amount = Object.fromEntries(Object.entries(scaledOf(frequency)).filter(([key]) => !BASE_KEYS.includes(key)));
  if (base === "prof") amount[tag("prof-bonus")] = true;
  else if (base === "level") amount[tag("level")] = true;
  else {
    amount[tag("ability")] = tag(base);
    if (before === undefined || before === "prof" || before === "level") amount[tag("min")] = 1;
  }
  return withAmount(frequency, amount);
}

/** The default of each number of a scaled amount: the engine's value when the key is absent. No minimum is undefined. */
export const NUMBER_DEFAULTS = { times: 1, plus: 0, min: undefined } as const;

/** A number of a scaled amount: the stored one, or the engine's default when it is absent or is not a number. */
export function scaledNumberOrDefault(frequency: unknown, key: "times" | "plus"): number {
  const value = scaledNumber(frequency, key);
  return typeof value === "number" ? value : NUMBER_DEFAULTS[key];
}

/** The number of a scaled amount: "times", "plus" or "min". Undefined when the map does not have it. */
export const scaledNumber = (frequency: unknown, key: "times" | "plus" | "min"): unknown => scaledOf(frequency)[tag(key)];

/**
 * The frequency with a number of the scaled amount set. The engine's
 * default, or undefined for no minimum, removes the key, so the map stays
 * as short as the stored examples.
 */
export function withScaledNumber(frequency: unknown, key: "times" | "plus" | "min", value: number | undefined): TransitMap {
  const amount = { ...scaledOf(frequency) };
  if (value === undefined || value === NUMBER_DEFAULTS[key]) delete amount[tag(key)];
  else amount[tag(key)] = value;
  return withAmount(frequency, amount);
}

/** The text of a plus: "+ 2", "+ 0", "− 1". */
export const plusText = (n: number) => (n < 0 ? `− ${-n}` : `+ ${n}`);

/**
 * The frequency of suggested uses (suggested-uses.ts), as the uses control
 * writes it for the same choice: a fixed amount is a number, the
 * proficiency bonus is {:prof-bonus true}, and an ability is its bare key
 * with a minimum of 1. The unit is its full keyword.
 */
export function suggestedFrequency({ amount, unit }: SuggestedUses): TransitMap {
  const scaled = (base: string) => withBase(withKind(undefined, "scaled"), base);
  const frequency = amount.kind === "fixed" ? withFixed(undefined, amount.n) : scaled(amount.kind === "prof" ? "prof" : amount.ability);
  return withUnit(frequency, unit);
}
