// The harness of the golden characters (ORC-237). A golden character is a
// character with sheet values that a person or an agent computed by hand
// from SRD 5.2.1. The README of this folder has the rules.

import { isDeepStrictEqual } from "node:util";
import { availableSelections, buildWithContributions, countRemaining, findProblems } from "../src/core/build.ts";
import type { Built2024 } from "../src/rules2024/built.ts";
import { SRD52 } from "../src/rules2024/built-in.ts";
import { loadContentPack } from "../src/rules2024/packs.ts";
import { createTemplate } from "../src/rules2024/template.ts";
import type { GoldenCharacter } from "./define.ts";

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

/**
 * Builds the character at each checked level. Returns its problems, with
 * each open selection, and the sheet values that differ from the expected
 * values.
 */
export function checkGolden(character: GoldenCharacter): { level: number; problems: string[]; mismatches: Mismatch[] }[] {
  const template = templateOf(character);
  return character.checks.map(({ level, entity, expected }) => {
    const { built } = buildWithContributions(entity, template);
    // An open selection is a problem too: the character makes every choice of the template (README rule 4).
    const open = availableSelections(entity, built, template)
      .filter((selection) => countRemaining(entity, selection) !== 0)
      .map((selection) => `"${selection.name}" at ${selection.path.join("/")} needs ${countRemaining(entity, selection)} more`);
    const problems = [...findProblems(entity, built, template).map((problem) => problem.reason), ...open];
    const mismatches = Object.entries(expected)
      .filter(([value, want]) => !isDeepStrictEqual(built[value as keyof Built2024], want))
      .map(([value, want]) => ({ character: character.name, level, value, expected: want, actual: built[value as keyof Built2024] }));
    return { level, problems, mismatches };
  });
}
