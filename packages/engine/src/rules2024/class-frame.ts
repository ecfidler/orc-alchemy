// The parts of a class that every class has, from its typed fields: the
// levels and their Hit Points (SRD 5.2.1 p22 to p24). The class converter in
// records.ts and the Fighter of the spike share them.

import type { OptionModifier, Reader } from "../core/modifiers.ts";
import { type Built2024, m } from "./built.ts";

/** The fixed Hit Points of a level after the first: half the die plus 1 (SRD 5.2.1 p23). */
export function fixedHitPoints(hitDie: number): number {
  return hitDie / 2 + 1;
}

/**
 * The modifiers of one class level: the class level, and the Hit Points of
 * the level. Level 1 of the first class gives the full die. Each other
 * level gives the fixed number, or the number rolled, which is the value of
 * the level option. A value that is not a roll of the die gives the fixed
 * number. The Constitution modifier is in `maxHitPoints`.
 */
export function classLevelModifiers(classRef: string, hitDie: number, level: number): OptionModifier<Built2024>[] {
  const isFirstClass = (q: Reader<Built2024>) => q("classes")[0] === classRef;
  // At level 1 the rolled number applies only to a class that is not the first (SRD 5.2.1 p24).
  const laterLevel = level === 1 ? { deps: ["classes" as const], when: (q: Reader<Built2024>) => !isFirstClass(q) } : {};
  // A roll of the die is a whole number from 1 to the die. Any other value gives the fixed number.
  const isRoll = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= hitDie;
  const rolled = m.deferred((value) => m.push("hitPointsPerLevel", isRoll(value) ? value : fixedHitPoints(hitDie), laterLevel), fixedHitPoints(hitDie));
  return [
    m.update("classLevels", (levels) => ({ ...levels, [classRef]: (levels[classRef] ?? 0) + 1 })),
    ...(level === 1 ? [m.push("hitPointsPerLevel", hitDie, { deps: ["classes"], when: isFirstClass })] : []),
    rolled,
  ];
}
