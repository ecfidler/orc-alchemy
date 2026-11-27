// Shared helpers of the Customize tests of custom.ts and its modules: the parts
// of the sheet that a test compares, and the save of a copy with no edits.
import type { Inventory } from "@pubdoor/dmv";
import { characterContent, features, saveCopy } from "./custom.ts";
import { srdRaceCopy } from "./custom-race.ts";
import { type Content, engine, type StrictEntity } from "./engine.ts";
import { SAGE_PACKS } from "./test-backgrounds.ts";
import { fighter20 } from "./test-feats.ts";
import { RACE_PACKS, RACE_TYPE } from "./test-races.ts";

/** The content with no homebrew: the SRD only. */
export const SRD: Content = { homebrew: undefined };

export const evaluateWith = (entity: StrictEntity, custom: object | undefined) => engine().evaluate(entity, characterContent({ homebrew: SAGE_PACKS }, custom));
/** What the sheet shows of a background: the background, the skills and tools, the language picks, the starting equipment and the features. */
export function backgroundParts(entity: StrictEntity, custom: object | undefined) {
  const { built, selections } = evaluateWith(entity, custom);
  const fromBackground = (items: Inventory) =>
    Object.keys(items ?? {}).filter((key) => items?.[key]["orcpub.dnd.e5.character.equipment/background-starting-equipment?"]);
  return {
    background: built.background,
    // The skills that the background gives, by their source.
    skills: Object.entries(built["skill-profs"] ?? {})
      .filter(([, sources]) => built.background !== null && Object.keys(sources as object).includes(built.background))
      .map(([key]) => key)
      .sort(),
    tools: Object.keys(built["tool-profs"] ?? {}).sort(),
    languages: selections.find((s) => s.key === "languages")!.max,
    equipment: fromBackground(built.equipment).sort(),
    gold: built.treasure?.gp?.["orcpub.dnd.e5.character.equipment/quantity"],
    features: (built.traits ?? []).map((t) => t.name).filter((name) => !["Grappler Feat", "Remarkable Athlete", "Survivor", "Indomitable"].includes(name)),
  };
}

/**
 * What the sheet shows of a race: the race and subrace, the ability scores, the speed, darkvision, languages,
 * weapon proficiencies, resistances, and the race's features with their uses. base is the character before his race changed.
 */
export function raceParts(entity: StrictEntity, custom: object | undefined, base: StrictEntity = fighter20()) {
  // The character's own features, from his class, feat and background.
  const own = new Set(features(engine().evaluate(base).built).map((f) => f.name));
  const { built } = engine().evaluate(entity, characterContent({ homebrew: RACE_PACKS }, custom));
  return {
    race: built.race,
    subrace: built.subrace,
    abilities: built.abilities,
    speed: built["base-land-speed"],
    darkvision: built.darkvision,
    languages: built.languages,
    weapons: built["weapon-profs"],
    resistances: built.resistances,
    features: features(built)
      .filter((f) => !own.has(f.name))
      .map((f) => ({ name: f.name, frequency: f.frequency ?? null })),
  };
}

/** The options of the language choice of an SRD race, as a record has them: each SRD language. */
export const ALL_LANGUAGES = Object.fromEntries(
  [
    "draconic",
    "deep-speech",
    "orc",
    "dwarvish",
    "gnomish",
    "sylvan",
    "elvish",
    "abyssal",
    "infernal",
    "celestial",
    "common",
    "undercommon",
    "primordial",
    "giant",
    "halfling",
    "goblin",
  ].map((key) => [`~:${key}`, true]),
);

/** The save of a copy with no edits of the character's SRD race, as the dialog does it. */
export async function noEditCopy(entity: StrictEntity, key: string, name: string) {
  const copy = (await srdRaceCopy(key, entity))!;
  const saved = saveCopy(entity, undefined, SRD, { contentType: RACE_TYPE, path: ["race", key], item: { ...copy.record, "~:name": name }, held: copy.held });
  return { copy, saved };
}
