// The Fighter of the spike, levels 1 to 5, with the Champion subclass (SRD
// 5.2.1 p47 to p49). Its feat choices take the feat records of the content,
// and its starting equipment is the one of the `srd52:fighter` record.
// ORC-230 replaces it with the rules of `srd52:fighter`.

import type { OptionModifier, Reader } from "../../core/modifiers.ts";
import { type Option, option, type Selection, selection } from "../../core/template.ts";
import { referenceTo, SRD_PACK } from "../../format/keys.ts";
import { type Built2024, feature, m, type Skill, type Uses } from "../built.ts";
import { classLevelModifiers } from "../class-frame.ts";
import { type Content, findRecord } from "../content.ts";
import { startingEquipmentSelection, weaponMasterySelection } from "../equipment.ts";
import { featSelection } from "../records.ts";

// The class key is the reference of the record, so that the features have the keys that feat prerequisites name.
const CLASS = referenceTo(SRD_PACK, "fighter");
const HIT_DIE = 10;

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
  return option({ name: `Level ${n}`, modifiers: [...classLevelModifiers(CLASS, HIT_DIE, n), ...modifiers], selections });
}

const levels = (content: Content): Option<Built2024>[] => [
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
    selections: [featSelection(content, "Fighting Style", ["fighting-style"]), weaponMasterySelection(content, 3)],
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
  level(4, { selections: [featSelection(content, "Ability Score Improvement"), weaponMasterySelection(content, 1)] }),
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

/** The Fighter of the spike, with the feats and the starting equipment of `content`. */
export const fighterOption = (content: Content): Option<Built2024> => {
  const startingEquipment = findRecord(content, "classes", CLASS)?.startingEquipment ?? [];
  return option<Built2024>({
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
      ...(startingEquipment.length ? [startingEquipmentSelection(content, CLASS, startingEquipment, { firstClass: true })] : []),
      selection({ name: "Levels", min: 1, max: null, multiselect: true, sequential: true, options: levels(content) }),
    ],
  });
};
