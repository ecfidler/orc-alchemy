// The hook `weapon-mastery`: the Weapon Mastery choice of a class, a number
// of kinds of weapons whose mastery properties the character can use (SRD
// 5.2.1 p89). The data cannot list the weapons, because a homebrew pack can
// add weapons. Each call adds its count to one pool, so a class that gains
// a kind at a later level calls the hook again at that level. The pool
// offers the options of every call, so a Melee-only call limits the pool
// only when no other call adds the other weapons.

import { z } from "zod";
import { weaponMasterySelection } from "../equipment.ts";
import { defineHook } from "./hook.ts";

export const weaponMasteryHook = defineHook({
  name: "weapon-mastery",
  args: z.strictObject({
    /** The number of kinds that this call adds to the pool. */
    count: z.int().min(1),
    /** True when the kinds are Melee weapons only, as for the Barbarian (SRD 5.2.1 p29). */
    melee: z.boolean().default(false),
  }),
  apply: ({ count, melee }, call) => ({ modifiers: [], selections: [weaponMasterySelection(call.content, count, { melee })] }),
});
