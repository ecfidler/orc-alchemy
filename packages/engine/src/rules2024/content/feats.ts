// Feats (SRD 5.2.1 p87 to p88). The slice has 8 of the 17: the Origin feats
// Alert and Savage Attacker, the General feats Ability Score Improvement
// and Grappler, and the four Fighting Style feats.

import { nameToKey, type Option, option, type Prereq, type Selection, selection } from "../../core/template.ts";
import { abilityIncreaseOptions } from "../abilities.ts";
import { ABILITIES, type Built2024, type FeatCategory, feature, m } from "../built.ts";

export interface Feat {
  key: string;
  name: string;
  category: FeatCategory;
  /** A feat can be taken once unless it is repeatable (SRD 5.2.1 p87). */
  repeatable: boolean;
  prereqs: readonly Prereq<Built2024>[];
  modifiers: Option<Built2024>["modifiers"];
  selections: readonly Selection<Built2024>[];
}

const level4: Prereq<Built2024> = { label: "Level 4+", canChoose: (built) => built.totalLevel >= 4 };
// Any class can grant the feature, so the class part of the key does not count.
const fightingStyleFeature: Prereq<Built2024> = {
  label: "Fighting Style feature",
  canChoose: (built) => built.features.some((f) => f.key.endsWith("/fighting-style")),
};

function feat(config: Pick<Feat, "name" | "category"> & Partial<Feat>): Feat {
  return { key: nameToKey(config.name), repeatable: false, prereqs: [], modifiers: [], selections: [], ...config };
}

export const FEATS: readonly Feat[] = [
  feat({
    name: "Alert",
    category: "origin",
    modifiers: [
      m.add("initiative", (q) => q("proficiencyBonus"), { deps: ["proficiencyBonus"], name: "Alert" }),
      m.push(
        "features",
        feature("alert", "Initiative Swap", "After you roll Initiative, you can swap your Initiative with one willing ally in the same combat."),
      ),
    ],
  }),
  feat({
    name: "Savage Attacker",
    category: "origin",
    modifiers: [
      m.push(
        "features",
        feature(
          "savage-attacker",
          "Savage Attacker",
          "Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll.",
        ),
      ),
    ],
  }),
  feat({
    name: "Ability Score Improvement",
    category: "general",
    repeatable: true,
    prereqs: [level4],
    selections: [
      selection({
        name: "Increase",
        options: [
          option({
            name: "One ability by 2",
            key: "two",
            selections: [selection({ name: "Ability", options: abilityIncreaseOptions(ABILITIES, 2, "Ability Score Improvement") })],
          }),
          option({
            name: "Two abilities by 1",
            key: "one-and-one",
            selections: [selection({ name: "Abilities", min: 2, max: 2, options: abilityIncreaseOptions(ABILITIES, 1, "Ability Score Improvement") })],
          }),
        ],
      }),
    ],
  }),
  feat({
    name: "Grappler",
    category: "general",
    prereqs: [level4, { label: "Strength or Dexterity 13+", canChoose: (built) => built.abilities.str >= 13 || built.abilities.dex >= 13 }],
    modifiers: [
      m.push(
        "features",
        feature(
          "grappler",
          "Punch and Grab",
          "When you hit with an Unarmed Strike as part of the Attack action, you can use both the Damage and the Grapple option. Once per turn.",
        ),
      ),
      m.push("features", feature("grappler", "Attack Advantage", "You have Advantage on attack rolls against a creature Grappled by you.")),
      m.push(
        "features",
        feature("grappler", "Fast Wrestler", "Moving a creature Grappled by you costs no extra movement if the creature is your size or smaller."),
      ),
    ],
    selections: [selection({ name: "Ability", options: abilityIncreaseOptions(["str", "dex"], 1, "Grappler") })],
  }),
  feat({
    name: "Archery",
    category: "fighting-style",
    prereqs: [fightingStyleFeature],
    modifiers: [m.add("rangedAttackBonus", 2, { name: "Archery" })],
  }),
  feat({
    name: "Defense",
    category: "fighting-style",
    prereqs: [fightingStyleFeature],
    // The bonus needs armor, so the modifier has a condition, and it runs after everything that armorClass reads.
    modifiers: [m.add("armorClass", 1, { deps: ["wornArmor"], when: (q) => q("wornArmor") !== null, name: "Defense" })],
  }),
  feat({
    name: "Great Weapon Fighting",
    category: "fighting-style",
    prereqs: [fightingStyleFeature],
    modifiers: [
      m.push(
        "features",
        feature(
          "great-weapon-fighting",
          "Great Weapon Fighting",
          "When you roll damage for an attack with a Melee weapon held in two hands, treat a 1 or 2 on a damage die as a 3. The weapon needs the Two-Handed or Versatile property.",
        ),
      ),
    ],
  }),
  feat({
    name: "Two-Weapon Fighting",
    category: "fighting-style",
    prereqs: [fightingStyleFeature],
    modifiers: [
      m.push(
        "features",
        feature(
          "two-weapon-fighting",
          "Two-Weapon Fighting",
          "When you make the extra attack of the Light property, you can add your ability modifier to the damage of that attack.",
        ),
      ),
    ],
  }),
];

/** The modifiers and selections that taking a feat gives: for a fixed grant, such as a background's Origin feat. */
export function grantFeat(key: string): Pick<Option<Built2024>, "modifiers" | "selections"> {
  const granted = FEATS.find((f) => f.key === key);
  if (!granted) throw new Error(`No feat "${key}"`);
  return {
    modifiers: [m.push("feats", { key: granted.key, name: granted.name, category: granted.category }), ...granted.modifiers],
    selections: granted.selections,
  };
}

/** A feat as an option of a feat selection. A feat that is not repeatable cannot be taken twice. */
function featOption(granted: Feat): Option<Built2024> {
  // Once the feat is chosen, the built character has it one time, and that is still valid.
  const once: Prereq<Built2024> = {
    label: "Not taken already",
    canChoose: (built) => !built.feats.some((f) => f.key === granted.key),
    stillValid: (built) => built.feats.filter((f) => f.key === granted.key).length <= 1,
  };
  return option({
    key: granted.key,
    name: granted.name,
    ...grantFeat(granted.key),
    prereqs: granted.repeatable ? granted.prereqs : [...granted.prereqs, once],
  });
}

/**
 * A choice of one feat. Without categories, every feat is an option:
 * "If you're instructed to choose a feat and no category is specified, you
 * can choose from any category" (SRD 5.2.1 p87).
 */
export function featSelection(name: string, categories?: readonly FeatCategory[]): Selection<Built2024> {
  return selection({ name, tags: ["feat"], options: FEATS.filter((f) => !categories || categories.includes(f.category)).map(featOption) });
}
