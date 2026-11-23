// The Fighter, levels 1 to 5, with the Champion subclass (SRD 5.2.1 p47 to
// p49).

import type { OptionModifier, Reader } from "../../core/modifiers.ts";
import { type Option, option, type Selection, selection } from "../../core/template.ts";
import { type Built2024, feature, m, type Skill, type Uses } from "../built.ts";
import { featSelection } from "./feats.ts";
import { WEAPONS } from "./weapons.ts";

const CLASS = "fighter";
const HIT_DIE = 10;
/** The fixed Hit Points for each level after the first (SRD 5.2.1 p23). */
const FIXED_HIT_POINTS = 6;

const SKILL_NAMES: Partial<Record<Skill, string>> = {
  acrobatics: "Acrobatics",
  "animal-handling": "Animal Handling",
  athletics: "Athletics",
  history: "History",
  insight: "Insight",
  intimidation: "Intimidation",
  persuasion: "Persuasion",
  perception: "Perception",
  survival: "Survival",
};

/** A class feature. `uses` reads the Fighter level, so the feature updates as the class gains levels. */
function classFeature(level: number, name: string, summary: string, uses?: (fighterLevel: number) => Uses): OptionModifier<Built2024> {
  const granted = feature(CLASS, name, summary, { level });
  if (!uses) return m.push("features", granted);
  return m.push("features", (q: Reader<Built2024>) => ({ ...granted, uses: uses(q("classLevels")[CLASS] ?? 0) }), { deps: ["classLevels"] });
}

/**
 * The Weapon Mastery choices. Every occurrence stores its choices at the
 * same ref, so the counts of the levels add up to one pool: 3 kinds at
 * level 1 and 4 at level 4 (SRD 5.2.1 p47 to p48).
 */
function weaponMasterySelection(count: number): Selection<Built2024> {
  return selection({
    name: "Weapon Mastery",
    ref: ["weapon-mastery"],
    min: count,
    max: count,
    multiselect: true,
    tags: ["weapon-mastery"],
    options: WEAPONS.map((weapon) => option({ key: weapon.key, name: weapon.name, modifiers: [m.push("weaponMasteries", weapon.key)] })),
  });
}

const CHAMPION = option<Built2024>({
  name: "Champion",
  modifiers: [
    m.put("subclasses", CLASS, "champion"),
    m.set("criticalHitMinimum", 19, { name: "Improved Critical" }),
    classFeature(3, "Improved Critical", "Your attack rolls with weapons and Unarmed Strikes can score a Critical Hit on a roll of 19 or 20 on the d20."),
    classFeature(
      3,
      "Remarkable Athlete",
      "You have Advantage on Initiative rolls and Strength (Athletics) checks. After you score a Critical Hit, you can move up to half your Speed without provoking Opportunity Attacks.",
    ),
  ],
});

interface LevelConfig {
  modifiers?: OptionModifier<Built2024>[];
  selections?: Selection<Built2024>[];
}

function level(n: number, { modifiers = [], selections = [] }: LevelConfig): Option<Built2024> {
  return option({
    name: `Level ${n}`,
    modifiers: [
      m.update("classLevels", (levels) => ({ ...levels, [CLASS]: (levels[CLASS] ?? 0) + 1 })),
      // Level 1 gives the full die. A later level gives the fixed number, or the number rolled, which is the value of the option.
      n === 1
        ? m.add("hitPointsFromLevels", HIT_DIE)
        : m.deferred((value) => (typeof value === "number" ? m.add("hitPointsFromLevels", value) : []), FIXED_HIT_POINTS),
      ...modifiers,
    ],
    selections,
  });
}

const LEVELS: Option<Built2024>[] = [
  level(1, {
    modifiers: [
      classFeature(
        1,
        "Fighting Style",
        "You gain a Fighting Style feat of your choice. Whenever you gain a Fighter level, you can replace it with another Fighting Style feat.",
      ),
      classFeature(
        1,
        "Second Wind",
        "As a Bonus Action, regain Hit Points equal to 1d10 plus your Fighter level. You regain one use when you finish a Short Rest and all uses when you finish a Long Rest.",
        (fighterLevel) => ({
          amount: fighterLevel >= 10 ? 4 : fighterLevel >= 4 ? 3 : 2,
          recover: [
            { on: "short-rest", amount: 1 },
            { on: "long-rest", amount: "all" },
          ],
        }),
      ),
      classFeature(
        1,
        "Weapon Mastery",
        "You can use the mastery properties of the kinds of weapons you chose. You can change one choice when you finish a Long Rest.",
      ),
    ],
    selections: [featSelection("Fighting Style", ["fighting-style"]), weaponMasterySelection(3)],
  }),
  level(2, {
    modifiers: [
      classFeature(2, "Action Surge", "On your turn, you can take one additional action, except the Magic action.", (fighterLevel) => ({
        amount: fighterLevel >= 17 ? 2 : 1,
        recover: [{ on: "short-rest", amount: "all" }],
      })),
      classFeature(
        2,
        "Tactical Mind",
        "When you fail an ability check, you can expend a use of Second Wind to add 1d10 to the roll. If the check still fails, the use is not expended.",
      ),
    ],
  }),
  level(3, { selections: [selection({ name: "Fighter Subclass", key: "subclass", options: [CHAMPION] })] }),
  level(4, { selections: [featSelection("Ability Score Improvement"), weaponMasterySelection(1)] }),
  level(5, {
    modifiers: [
      m.set("attacksPerAction", 2, { name: "Extra Attack" }),
      classFeature(5, "Extra Attack", "You can attack twice, instead of once, whenever you take the Attack action on your turn."),
      classFeature(
        5,
        "Tactical Shift",
        "When you activate Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks.",
      ),
    ],
  }),
];

export const FIGHTER = option<Built2024>({
  name: "Fighter",
  modifiers: [
    m.push("classes", CLASS),
    m.put("hitDice", CLASS, HIT_DIE),
    m.push("savingThrowProficiencies", "str"),
    m.push("savingThrowProficiencies", "con"),
    ...["simple", "martial"].map((category) => m.push("weaponProficiencies", category)),
    ...["light", "medium", "heavy", "shield"].map((category) => m.push("armorTraining", category)),
  ],
  selections: [
    selection({
      name: "Skill Proficiencies",
      min: 2,
      max: 2,
      options: (Object.keys(SKILL_NAMES) as Skill[]).map((skill) =>
        option({ key: skill, name: SKILL_NAMES[skill] ?? skill, modifiers: [m.push("skillProficiencies", skill)] }),
      ),
    }),
    selection({ name: "Levels", min: 1, max: null, multiselect: true, sequential: true, options: LEVELS }),
  ],
});
