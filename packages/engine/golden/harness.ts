// The harness of the golden characters (ORC-237). A golden character is a
// character with sheet values that a person or an agent computed by hand
// from SRD 5.2.1. The README of this folder has the rules.

import { isDeepStrictEqual } from "node:util";
import { buildWithContributions, findProblems } from "../src/core/build.ts";
import type { Built2024 } from "../src/rules2024/built.ts";
import { SRD52 } from "../src/rules2024/built-in.ts";
import type { Entity2024 } from "../src/rules2024/evaluate.ts";
import { loadContentPack } from "../src/rules2024/packs.ts";
import { createTemplate } from "../src/rules2024/template.ts";

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

/** A sheet value that is not the expected value. */
export interface Mismatch {
  character: string;
  level: number;
  value: string;
  expected: unknown;
  actual: unknown;
}

/** The text of a mismatch: the character, the level, the sheet value, and the two values. */
export function describeMismatch({ character, level, value, expected, actual }: Mismatch): string {
  return `${character}, level ${level}, ${value}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

/** The template of a character: the built-in pack and the test packs of the character. */
function templateOf(character: GoldenCharacter) {
  const packs = (character.packs ?? []).map((file) => {
    const loaded = loadContentPack(file, { packs: [SRD52] });
    if (!loaded.pack || loaded.issues.length) {
      throw new Error(`${character.name}: a test pack does not load: ${loaded.issues.map((issue) => issue.message).join("; ")}`);
    }
    return loaded.pack;
  });
  return createTemplate({ packs: [SRD52, ...packs] });
}

/** Builds the character at each checked level. Returns its problems and the sheet values that differ from the expected values. */
export function checkGolden(character: GoldenCharacter): { level: number; problems: string[]; mismatches: Mismatch[] }[] {
  const template = templateOf(character);
  return character.checks.map(({ level, entity, expected }) => {
    const { built } = buildWithContributions(entity, template);
    const problems = findProblems(entity, built, template).map((problem) => problem.reason);
    const mismatches = Object.entries(expected)
      .filter(([value, want]) => !isDeepStrictEqual(built[value as keyof Built2024], want))
      .map(([value, want]) => ({ character: character.name, level, value, expected: want, actual: built[value as keyof Built2024] }));
    return { level, problems, mismatches };
  });
}

/** A golden character, with a check that each checked level is at most 20 and comes once. */
export function defineGolden(character: GoldenCharacter): GoldenCharacter {
  const levels = character.checks.map((check) => check.level);
  if (new Set(levels).size !== levels.length || levels.some((level) => level < 1 || level > 20)) {
    throw new Error(`${character.name}: each checked level must be from 1 to 20 and come once`);
  }
  return character;
}
