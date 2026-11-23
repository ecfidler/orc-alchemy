// The form of a golden character (ORC-237), with no Node.js import, so
// that the app can load a character too (ORC-238). harness.ts checks it.

import type { Built2024 } from "../src/rules2024/built.ts";
import type { Entity2024 } from "../src/rules2024/evaluate.ts";

/** The character at one checked level: its choices, and the sheet values that it must have. */
export interface GoldenCheck {
  /** The total character level. */
  level: number;
  entity: Entity2024;
  /** The expected sheet values. Each one has its arithmetic and its SRD 5.2.1 page in a comment. */
  expected: Partial<Built2024>;
}

export interface GoldenCharacter {
  name: string;
  /** Test pack files that the character uses beside the built-in pack, for a character with a test class. */
  packs?: readonly unknown[];
  checks: readonly GoldenCheck[];
}

/** A golden character, with a check that each checked level is at most 20 and comes once. */
export function defineGolden(character: GoldenCharacter): GoldenCharacter {
  const levels = character.checks.map((check) => check.level);
  if (new Set(levels).size !== levels.length || levels.some((level) => level < 1 || level > 20)) {
    throw new Error(`${character.name}: each checked level must be from 1 to 20 and come once`);
  }
  return character;
}
