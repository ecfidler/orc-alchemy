// The hook `feat-choice`: a choice of one feat from the feat records of some
// categories, for example the Origin feat of Human Versatile (SRD 5.2.1
// p85) or the Fighting Style feat of a class. The data cannot list the feats
// of a category, because a homebrew pack can add feats.

import { z } from "zod";
import { FEAT_CATEGORIES } from "../../format/schema.ts";
import { defineHook } from "./hook.ts";

export const featChoiceHook = defineHook({
  name: "feat-choice",
  args: z.strictObject({
    /** The name of the choice, for example "Versatile". */
    name: z.string().min(1),
    /** The categories of the feats. Default: every category (SRD 5.2.1 p87). */
    categories: z.array(z.enum(FEAT_CATEGORIES)).min(1).optional(),
  }),
  apply: ({ name, categories }, call) => ({ modifiers: [], selections: [call.featSelection(name, categories)] }),
});
