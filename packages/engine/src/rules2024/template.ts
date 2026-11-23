// The 2024 template. It still has the content of the spike: one class, one
// species, one background. The content format (ORC-223) and the import
// (ORC-224) replace that content.

import { option, selection, type Template } from "../core/template.ts";
import { ABILITIES, type AbilityScores, type Built2024, base, forEachAbility, m } from "./built.ts";
import { ARMOR } from "./content/armor.ts";
import { BACKGROUNDS } from "./content/backgrounds.ts";
import { FIGHTER } from "./content/fighter.ts";
import { SPECIES } from "./content/species.ts";
import { WEAPONS } from "./content/weapons.ts";

/** The Standard Languages without Common, which every character knows (SRD 5.2.1 p20). */
const STANDARD_LANGUAGES = ["Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"];

/** The Standard Array (SRD 5.2.1 p21). */
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** The Standard Array in a random order, for autofill. */
function randomStandardArray(random: () => number): AbilityScores {
  const scores = [...STANDARD_ARRAY];
  for (let i = scores.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [scores[i], scores[j]] = [scores[j], scores[i]];
  }
  return Object.fromEntries(ABILITIES.map((ability, i) => [ability, scores[i]])) as AbilityScores;
}

function readScores(value: unknown): AbilityScores {
  const scores = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return forEachAbility((ability) => (typeof scores[ability] === "number" ? scores[ability] : 10));
}

export const template2024: Template<Built2024> = {
  base,
  selections: [
    selection({
      name: "Ability Scores",
      requireValue: true,
      // The value of the option is the six scores before any increase, however the player generated them.
      options: [
        option({
          name: "Scores",
          modifiers: [m.deferred((value) => m.set("baseAbilities", readScores(value)))],
          autofillValue: randomStandardArray,
        }),
      ],
    }),
    selection({ name: "Class", min: 1, max: null, multiselect: true, options: [FIGHTER] }),
    selection({ name: "Species", options: SPECIES }),
    selection({ name: "Background", options: BACKGROUNDS }),
    selection({
      name: "Languages",
      min: 2,
      max: 2,
      options: STANDARD_LANGUAGES.map((name) => {
        const language = option<Built2024>({ name });
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
