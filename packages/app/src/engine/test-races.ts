// The race fixtures of the Customize tests (ORC-136): a pack race with
// ability score increases, a speed, darkvision, languages, a weapon
// proficiency and a feature with uses, a pack subrace of it, and fighter-20
// with it, or with the SRD race Dwarf and its subrace Hill Dwarf, in place
// of his Human.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type ContentType, engine, type StrictEntity } from "./engine.ts";
import { fighter20 } from "./test-feats.ts";

export const RACE_PACK = "Race Pack";
/** The races' content type, and as a Transit keyword, the key of the items in a plugin. */
export const RACE_TYPE: ContentType = "orcpub.dnd.e5/races";
export const TAGGED_RACES = `~:${RACE_TYPE}`;
export const TAGGED_SUBRACES = "~:orcpub.dnd.e5/subraces";

/** A pack race: +2 Wisdom and +1 Dexterity, speed 35, darkvision 60, Common and Sylvan, the longbow, and a bonus action with one use a long rest. */
export const SYLVAR = {
  "~:key": "~:sylvar",
  "~:name": "Sylvar",
  "~:option-pack": RACE_PACK,
  "~:help": "Tall wood folk who move without a sound.",
  "~:size": "~:medium",
  "~:speed": 35,
  "~:darkvision": 60,
  "~:abilities": { "~:orcpub.dnd.e5.character/wis": 2, "~:orcpub.dnd.e5.character/dex": 1 },
  "~:languages": { "~#set": ["Common", "Sylvan"] },
  "~:props": { "~:weapon-prof": { "~:longbow": true } },
  "~:traits": [
    {
      "~:name": "Leafstep",
      "~:description": "You step from one tree to another.",
      "~:type": "~:bonus-action",
      "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 1 },
    },
  ],
};

/** A pack subrace of Sylvar, by its key: +1 Intelligence. */
export const DEEP_SYLVAR = {
  "~:key": "~:deep-sylvar",
  "~:name": "Deep Sylvar",
  "~:option-pack": RACE_PACK,
  "~:race": "~:sylvar",
  "~:abilities": { "~:orcpub.dnd.e5.character/int": 1 },
  "~:traits": [],
};

/** A pack subrace of the SRD race Elf, by its key: +1 Wisdom. With it, Elf has two subraces, High Elf and Wood Kin. */
export const WOOD_KIN = {
  "~:key": "~:wood-kin",
  "~:name": "Wood Kin",
  "~:option-pack": RACE_PACK,
  "~:race": "~:elf",
  "~:abilities": { "~:orcpub.dnd.e5.character/wis": 1 },
  "~:traits": [],
};

/** The homebrew with WOOD_KIN alone. */
export const WOOD_KIN_PACKS = { [RACE_PACK]: { [TAGGED_SUBRACES]: { "~:wood-kin": WOOD_KIN } } };

/** The homebrew with SYLVAR and DEEP_SYLVAR. */
export const RACE_PACKS = { [RACE_PACK]: { [TAGGED_RACES]: { "~:sylvar": SYLVAR }, [TAGGED_SUBRACES]: { "~:deep-sylvar": DEEP_SYLVAR } } };

/** fighter-20 with the pack race Sylvar in place of Human, and with `subrace` its subrace Deep Sylvar. */
export function withSylvar(subrace = false): StrictEntity {
  const e = engine();
  const options = { homebrew: RACE_PACKS };
  const entity = e.select(fighter20(), ["race"], "sylvar", options);
  return subrace ? e.select(entity, ["race", "sylvar", "subrace"], "deep-sylvar", options) : entity;
}

/** wizard-1, a High Elf wizard: he has no martial weapon proficiency, so a race's martial weapons show on his sheet. */
export const wizard1 = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/wizard-1.strict.json"), "utf8"));

/** The character, fighter-20 by default, with the SRD race Dwarf and its subrace Hill Dwarf in place of his race. */
export function withHillDwarf(character: StrictEntity = fighter20()): StrictEntity {
  const e = engine();
  return e.select(e.select(character, ["race"], "dwarf"), ["race", "dwarf", "subrace"], "hill-dwarf");
}
