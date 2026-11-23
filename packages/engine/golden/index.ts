// The golden characters (ORC-237). A class ticket adds its character here.

import { tester } from "./characters/tester.ts";
import type { GoldenCharacter } from "./harness.ts";

export { checkGolden, defineGolden, describeMismatch, type GoldenCharacter, type GoldenCheck, type Mismatch } from "./harness.ts";

export const GOLDEN_CHARACTERS: readonly GoldenCharacter[] = [tester];
