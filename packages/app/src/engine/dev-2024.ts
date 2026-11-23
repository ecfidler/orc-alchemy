// The 2024 rules preview (ORC-238): the golden characters of
// the engine that use only the built-in content, at their checked levels.
// The component reads them through this module, so only src/engine imports
// the engine package. Only the lazy preview page imports this module.

import { GOLDEN_CHARACTERS } from "@orc-alchemy/engine/golden/characters";
import { loadSheet } from "./edition.ts";
import type { Sheet } from "./sheet.ts";

// A character with a test pack needs homebrew in evaluate, which arrives with ORC-235.
const characters = GOLDEN_CHARACTERS.filter((character) => !character.packs?.length);

/** Each developer character: its name and the levels that it checks, lowest first. */
export const DEV_2024_CHARACTERS: readonly { name: string; levels: readonly number[] }[] = characters.map((character) => ({
  name: character.name,
  levels: character.checks.map((check) => check.level),
}));

/** The Sheet of developer character `index` at a level that it checks. */
export function loadDevSheet(index: number, level: number): Promise<Sheet> {
  const check = characters[index]?.checks.find((c) => c.level === level);
  if (!check) return Promise.reject(new Error(`No developer character ${index} at level ${level}`));
  return loadSheet({ rules: "2024" }, check.entity);
}
