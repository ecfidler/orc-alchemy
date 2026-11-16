// The background fixtures of the Customize tests (ORC-135): a pack
// background with skills, tools, a language choice, equipment and a
// feature, and fighter-20 with it in place of the SRD background Acolyte.
import { engine, type StrictEntity } from "./engine.ts";
import { fighter20 } from "./test-feats.ts";

export const BACKGROUND_PACK = "Background Pack";
export const BACKGROUNDS = "~:orcpub.dnd.e5/backgrounds";

/** A pack background with two skills, Thieves' Tools, one artisan's tool and one language of the player's choice, two items, gold and a feature. */
export const SAGE = {
  "~:key": "~:sage",
  "~:name": "Sage",
  "~:option-pack": BACKGROUND_PACK,
  "~:help": "You spent years learning the lore of the multiverse.",
  "~:profs": {
    "~:skill": { "~:arcana": true, "~:history": true },
    "~:tool": { "~:thieves-tools": true },
    "~:tool-options": { "~:artisans-tool": 1 },
    "~:language-options": { "~:choose": 1, "~:options": { "~:any": true } },
  },
  "~:equipment": { "~:ink": 1, "~:ink-pen": 1 },
  "~:treasure": { "~:gp": 10 },
  "~:traits": [{ "~:name": "Researcher", "~:description": "You know where to find lore." }],
};

/** The homebrew with SAGE. */
export const SAGE_PACKS = { [BACKGROUND_PACK]: { [BACKGROUNDS]: { "~:sage": SAGE } } };

/** The path of Sage's artisan's tool choice. */
export const ARTISAN = ["background", "sage", "tool-proficiency-artisans-tools"];

/** fighter-20 with the pack background Sage in place of Acolyte, and Smith's Tools for its artisan's tool. */
export function withSage(): StrictEntity {
  const e = engine();
  const options = { homebrew: SAGE_PACKS };
  const entity = e.select(fighter20(), ["background"], "sage", options);
  return e.select(entity, ARTISAN, "smiths-tools", options);
}
