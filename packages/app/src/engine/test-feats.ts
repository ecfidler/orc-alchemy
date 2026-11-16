// The fixtures of the Customize tests (ORC-134): the character fighter-20,
// who takes the SRD feat Grappler, and a pack feat with a skill choice.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StrictEntity } from "./engine.ts";

/** fighter-20 ("Ser Aldric"), as the fork's fixture stores him. He takes the SRD feat Grappler in the top-level :feats selection. */
export const fighter20 = (): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-20.strict.json"), "utf8"));

export const FEAT_PACK = "Feat Pack";

/** A pack feat with one skill or tool of the character's choice: the selection ["feats", "skill-expert", "skill-tool-1"]. */
export const SKILL_EXPERT = {
  "~:key": "~:skill-expert",
  "~:name": "Skill Expert",
  "~:option-pack": FEAT_PACK,
  "~:description": "You know skills.",
  "~:ability-increases": { "~#set": [] },
  "~:props": { "~:skill-tool-choice": 1 },
};

/** The path of Skill Expert's skill choice. */
export const SKILL = ["feats", "skill-expert", "skill-tool-1"];
