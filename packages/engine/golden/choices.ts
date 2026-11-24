// The choices that several golden characters make: the Ability Score
// Improvement feat (SRD 5.2.1 p87) and the level options of a class.

import type { StrictOption, StrictSelection } from "../src/core/entity.ts";

const asi = (increase: StrictOption): StrictOption => ({ key: "srd52:ability-score-improvement", selections: [{ key: "increase", option: increase }] });

/** The Ability Score Improvement feat: +2 to one ability. */
export const plusTwo = (ability: string) => asi({ key: "two", selections: [{ key: "ability", option: { key: ability } }] });

/** The Ability Score Improvement feat: +1 to each of two abilities. */
export const plusOneAndOne = (first: string, second: string) =>
  asi({ key: "one-and-one", selections: [{ key: "abilities", options: [{ key: first }, { key: second }] }] });

/** The options `level-1` to `level-<level>` of a class, each with the choices of that level. */
export function classLevels(level: number, choicesAt: (n: number) => StrictSelection[]): StrictOption[] {
  return Array.from({ length: level }, (_, i): StrictOption => {
    const choices = choicesAt(i + 1);
    return { key: `level-${i + 1}`, ...(choices.length ? { selections: choices } : {}) };
  });
}
