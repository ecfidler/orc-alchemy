// The 2024 template for the spike: one class, one species, one background.

import { option, selection, type Template } from "../core/template.ts";
import { ARMOR } from "./content/armor.ts";
import { BACKGROUNDS } from "./content/backgrounds.ts";
import { FIGHTER } from "./content/fighter.ts";
import { SPECIES } from "./content/species.ts";
import { WEAPONS } from "./content/weapons.ts";
import { ABILITIES, type AbilityScores, base, m, type Sheet } from "./sheet.ts";

/** The Standard Languages without Common, which every character knows (SRD 5.2.1 p20). */
const STANDARD_LANGUAGES = ["Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"];

function readScores(value: unknown): AbilityScores {
  const scores = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(ABILITIES.map((ability) => [ability, typeof scores[ability] === "number" ? scores[ability] : 10])) as AbilityScores;
}

export const template2024: Template<Sheet> = {
  base,
  selections: [
    selection({
      name: "Ability Scores",
      requireValue: true,
      // The value of the option is the six scores before any increase, however the player generated them.
      options: [option({ name: "Scores", modifiers: [m.deferred((value) => m.set("baseAbilities", readScores(value)))] })],
    }),
    selection({ name: "Class", min: 1, max: null, multiselect: true, options: [FIGHTER] }),
    selection({ name: "Species", options: SPECIES }),
    selection({ name: "Background", options: BACKGROUNDS }),
    selection({
      name: "Languages",
      min: 2,
      max: 2,
      options: STANDARD_LANGUAGES.map((name) => {
        const language = option<Sheet>({ name });
        return { ...language, modifiers: [m.push("languages", language.key)] };
      }),
    }),
    selection({
      name: "Armor",
      min: 0,
      options: ARMOR.map((armor) => option({ key: armor.key, name: armor.name, modifiers: [m.set("wornArmor", armor.key)] })),
    }),
    selection({ name: "Shield", min: 0, options: [option({ name: "Shield", modifiers: [m.set("shield", true)] })] }),
    selection({
      name: "Weapons",
      min: 0,
      max: null,
      multiselect: true,
      options: WEAPONS.map((weapon) => option({ key: weapon.key, name: weapon.name, modifiers: [m.push("weapons", weapon.key)] })),
    }),
  ],
};
