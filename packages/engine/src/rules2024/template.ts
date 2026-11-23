// The 2024 template: the selections at the top of a character (ORC-225).
// The classes, the species (ORC-226), the backgrounds and the feats
// (ORC-227), and the languages come from the content. The equipment is
// still the content of the spike: ORC-228 replaces it. The Fighter of the
// spike stays until ORC-230 writes the rules of `srd52:fighter`.

import { shuffled } from "../core/autofill.ts";
import { option, type Prereq, selection, type Template } from "../core/template.ts";
import { referenceTo, SRD_PACK } from "../format/keys.ts";
import { ABILITIES, type AbilityScores, type Built2024, base, forEachAbility, m, RULES } from "./built.ts";
import { BUILT_IN } from "./built-in.ts";
import { ARMOR } from "./content/armor.ts";
import { fighterOption } from "./content/fighter.ts";
import { WEAPONS } from "./content/weapons.ts";
import { type Content, recordsOf } from "./content.ts";
import { backgroundOption, classOption, speciesOption } from "./records.ts";

/** The Standard Array (SRD 5.2.1 p21). */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

/** The Ability Score Point Costs table: the cost of each score from 8 to 15 (SRD 5.2.1 p21). */
export const POINT_COSTS: Readonly<Record<number, number>> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

/** The points to spend with Point Cost. */
export const POINT_BUDGET = 27;

/** The Standard Array in a random order, for autofill. */
function randomStandardArray(random: () => number): AbilityScores {
  const scores = shuffled(STANDARD_ARRAY, random);
  return Object.fromEntries(ABILITIES.map((ability, i) => [ability, scores[i]])) as AbilityScores;
}

function readScores(value: unknown): AbilityScores {
  const scores = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  return forEachAbility((ability) => (typeof scores[ability] === "number" ? scores[ability] : 10));
}

/** The cost of the scores with Point Cost, or null when a score is not from 8 to 15. */
export function pointCost(scores: AbilityScores): number | null {
  let total = 0;
  for (const score of Object.values(scores)) {
    const cost = POINT_COSTS[score];
    if (cost === undefined) return null;
    total += cost;
  }
  return total;
}

/** A test of the scores that the option gave. It is a "still valid" test: the scores exist only with the option. */
function scoresTest(label: string, test: (scores: AbilityScores) => boolean): Prereq<Built2024> {
  return { label, canChoose: () => true, stillValid: (built) => test(built.baseAbilities) };
}

const sameNumbers = (a: readonly number[], b: readonly number[]) => [...a].sort().join() === [...b].sort().join();

/** Sets the scores before any increase from the value of the option. */
const setScores = m.deferred((value) => m.set("baseAbilities", readScores(value)));

/**
 * The three ways to get the scores (SRD 5.2.1 p21). The value of the option
 * is the six scores before any increase. Random Generation is manual entry
 * of the six rolled numbers.
 */
const abilityScoreMethods = selection<Built2024>({
  name: "Ability Scores",
  requireValue: true,
  options: [
    option({
      name: "Standard Array",
      modifiers: [setScores],
      prereqs: [scoresTest("the scores 15, 14, 13, 12, 10 and 8", (scores) => sameNumbers(Object.values(scores), STANDARD_ARRAY))],
      autofillValue: randomStandardArray,
    }),
    option({
      name: "Point Cost",
      modifiers: [setScores],
      prereqs: [
        scoresTest(`scores from 8 to 15 that cost ${POINT_BUDGET} points or less`, (scores) => {
          const cost = pointCost(scores);
          return cost !== null && cost <= POINT_BUDGET;
        }),
      ],
    }),
    option({ name: "Manual", modifiers: [setScores] }),
  ],
});

/** The class of the spike, which `srd52:fighter` replaces in ORC-230. */
const SPIKE_CLASS = referenceTo(SRD_PACK, "fighter");

/** The template of a character that can use `content`. */
export function createTemplate(content: Content): Template<Built2024> {
  const classes = recordsOf(content, "classes")
    .filter(({ reference }) => reference !== SPIKE_CLASS)
    .map(({ reference, record }) => classOption(content, reference, record));
  // Every character knows Common and two languages from the Standard Languages table (SRD 5.2.1 p20).
  const languages = recordsOf(content, "languages")
    .filter(({ record }) => !record.rare && record.key !== "common")
    .map(({ reference, record }) => option<Built2024>({ key: reference, name: record.name, modifiers: [m.push("languages", reference)] }));

  return {
    base,
    modifiers: RULES,
    selections: [
      abilityScoreMethods,
      selection({ name: "Class", min: 1, max: null, multiselect: true, options: [fighterOption(content), ...classes] }),
      selection({ name: "Species", options: recordsOf(content, "species").map(({ reference, record }) => speciesOption(content, reference, record)) }),
      selection({
        name: "Background",
        options: recordsOf(content, "backgrounds").map(({ reference, record }) => backgroundOption(content, reference, record)),
      }),
      selection({ name: "Languages", min: 2, max: 2, options: languages }),
      selection({
        name: "Armor",
        min: 0,
        options: ARMOR.map((armor) =>
          option({
            key: armor.key,
            name: armor.name,
            modifiers: [
              m.set("wornArmor", armor.key),
              // SRD 5.2.1 p92: the base of the armor, with the Dexterity modifier up to the limit of the armor.
              // Heavy armor (limit 0) has no Dexterity term, so a penalty does not apply to it.
              m.add(
                "baseArmorClass",
                (q) => armor.base + (armor.dexLimit === 0 ? 0 : Math.min(q("abilityModifiers").dex, armor.dexLimit ?? Number.POSITIVE_INFINITY)),
                {
                  deps: ["abilityModifiers"],
                },
              ),
            ],
          }),
        ),
      }),
      selection({
        name: "Shield",
        min: 0,
        options: [
          option({
            name: "Shield",
            modifiers: [
              m.set("shield", true),
              // SRD 5.2.1 p92: a Shield adds 2, and only with training.
              m.add("armorClass", 2, { deps: ["armorTraining"], when: (q) => q("armorTraining").includes("shield") }),
            ],
          }),
        ],
      }),
      selection({
        name: "Weapons",
        min: 0,
        max: null,
        multiselect: true,
        options: WEAPONS.map((weapon) => option({ key: weapon.key, name: weapon.name, modifiers: [m.push("weapons", weapon.key)] })),
      }),
    ],
  };
}

/** The template of the built-in content. */
export const template2024: Template<Built2024> = createTemplate(BUILT_IN);
