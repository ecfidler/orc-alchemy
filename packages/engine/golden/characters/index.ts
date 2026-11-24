// The golden characters (ORC-237). A class ticket adds its character here.
// This list has no Node.js import, so the app can load it (ORC-238).

import type { GoldenCharacter } from "../define.ts";
import { barbarian } from "./barbarian.ts";
import { fighter } from "./fighter.ts";
import { monk } from "./monk.ts";
import { rogue } from "./rogue.ts";
import { tester } from "./tester.ts";

export const GOLDEN_CHARACTERS: readonly GoldenCharacter[] = [tester, fighter, barbarian, monk, rogue];
