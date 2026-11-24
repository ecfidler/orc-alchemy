// The golden characters (ORC-237), with the harness that checks them.

export { GOLDEN_CHARACTERS } from "./characters/index.ts";
export { defineGolden, type GoldenCharacter, type GoldenCheck } from "./define.ts";
export { checkGolden, describeMismatch, type Mismatch } from "./harness.ts";
