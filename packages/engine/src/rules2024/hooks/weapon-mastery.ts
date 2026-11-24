// The hook `weapon-mastery`: the Weapon Mastery choice of a class, a number
// of kinds of weapons whose mastery properties the character can use (SRD
// 5.2.1 p89). The data cannot list the weapons, because a homebrew pack can
// add weapons. Each call adds its count to one pool, so a class that gains
// a kind at a later level calls the hook again at that level.

import { z } from "zod";
import { weaponMasterySelection } from "../equipment.ts";
import { defineHook } from "./hook.ts";

export const weaponMasteryHook = defineHook({
  name: "weapon-mastery",
  args: z.strictObject({
    /** The number of kinds that this call adds to the pool. */
    count: z.int().min(1),
  }),
  apply: ({ count }, call) => ({ modifiers: [], selections: [weaponMasterySelection(call.content, count)] }),
});
