// The background fixtures of the Customize tests (ORC-135): a pack
// background with skills, tools, a language choice, equipment and a
// feature, and fighter-20 with it in place of the SRD background Acolyte.
import { toEdn } from "../components/builders/test-review-pack.ts";
import { engine, type StrictEntity } from "./engine.ts";
import { fighter20 } from "./test-feats.ts";

export const BACKGROUND_PACK = "Background Pack";
/** The backgrounds' content type as a Transit keyword, the key of the items in a plugin. */
export const TAGGED_BACKGROUNDS = "~:orcpub.dnd.e5/backgrounds";

/** A pack background with two skills, Thieves' Tools, one artisan's tool and one language of the player's choice, two items, gold and a feature with uses. */
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
  // A feature with uses: one use, back on a long rest.
  "~:traits": [
    {
      "~:name": "Researcher",
      "~:description": "You know where to find lore.",
      "~:type": "~:action",
      "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 1 },
    },
  ],
};

/** The homebrew with SAGE. */
export const SAGE_PACKS = { [BACKGROUND_PACK]: { [TAGGED_BACKGROUNDS]: { "~:sage": SAGE } } };

/** The path of Sage's artisan's tool choice. */
export const ARTISAN = ["background", "sage", "tool-proficiency-artisans-tools"];

/** fighter-20 with the pack background Sage in place of Acolyte, and Smith's Tools for its artisan's tool. */
export function withSage(): StrictEntity {
  const e = engine();
  const options = { homebrew: SAGE_PACKS };
  const entity = e.select(fighter20(), ["background"], "sage", options);
  return e.select(entity, ARTISAN, "smiths-tools", options);
}

/** The pack of VALE_BACKGROUNDS: invented backgrounds, as in the prototype of the list with a detail panel (ORC-338). */
export const VALE_PACK = "Vale of Ash";

/** 24 invented names: with the SRD Acolyte, a list of 25 backgrounds, more than the 20 that get a search field (ORC-347). */
export const VALE_NAMES = [
  "Archivist",
  "Bargehand",
  "Beekeeper",
  "Bell Ringer",
  "Bonesetter",
  "Border Scout",
  "Caravan Guard",
  "Cartographer",
  "Chandler",
  "Ferryman",
  "Gamekeeper",
  "Glassblower",
  "Gravedigger",
  "Herbalist",
  "Lamplighter",
  "Mason",
  "Messenger",
  "Miller",
  "Night Watch",
  "Pilgrim",
  "Ratcatcher",
  "Salt Trader",
  "Shepherd",
  "Weaver",
];

/** The key of a name, as the engine keys a background. */
const keyOf = (name: string) => name.toLowerCase().replace(/\W+/g, "-");

/** The backgrounds of VALE_PACK, each with a skill and a description, keyed by the key of its name as the engine keys a background. */
export const VALE_BACKGROUNDS = VALE_NAMES.map((name) => {
  const key = keyOf(name);
  return {
    "~:key": `~:${key}`,
    "~:name": name,
    "~:option-pack": VALE_PACK,
    "~:help": `An invented background: the ${name.toLowerCase()} of the vale.`,
    "~:profs": { "~:skill": { "~:history": true } },
  };
});

const VALE_SKILLS = ["history", "nature", "survival", "medicine", "stealth", "insight"];

/**
 * VALE_PACK as the text of an .orcbrew file, for the e2e specs (ORC-347). Each background of VALE_NAMES has a
 * description, two skills, a language of the player's choice, two items, gold and a feature.
 */
export function valeOrcbrew(): string {
  const background = (name: string, i: number) => ({
    "~:key": `~:${keyOf(name)}`,
    "~:name": name,
    "~:option-pack": VALE_PACK,
    "~:help": `An invented background for this test. The ${name.toLowerCase()} knows the roads and the people of the vale.`,
    "~:profs": {
      "~:skill": { [`~:${VALE_SKILLS[i % 6]}`]: true, [`~:${VALE_SKILLS[(i + 1) % 6]}`]: true },
      "~:language-options": { "~:choose": 1, "~:options": { "~:any": true } },
    },
    "~:equipment": { "~:clothes-common": 1, "~:pouch": 1 },
    "~:treasure": { "~:gp": 10 },
    "~:traits": [{ "~:name": "Known Faces", "~:description": "The people of the vale know you, and give you a meal and a bed for the night." }],
  });
  return toEdn({ [TAGGED_BACKGROUNDS]: Object.fromEntries(VALE_NAMES.map((name, i) => [`~:${keyOf(name)}`, background(name, i)])) });
}
