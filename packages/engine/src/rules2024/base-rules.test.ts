// The rules that every 2024 character has (ORC-225), on test classes with
// no features. Each expected number has its arithmetic from SRD 5.2.1 in a
// comment.

import { describe, expect, it } from "vitest";
import { availableSelections, buildWithContributions, findProblems } from "../core/build.ts";
import type { StrictOption, StrictSelection } from "../core/entity.ts";
import { SRD52 } from "./built-in.ts";
import type { Entity2024 } from "./evaluate.ts";
import { loadContentPack } from "./packs.ts";
import { createTemplate, pointCost } from "./template.ts";
import { testClass, testPackFile, twoAndOne } from "./testing.ts";

const loaded = loadContentPack(
  testPackFile({
    classes: [
      // A class with no features: light armor, simple weapons.
      testClass("tester", { weaponProficiencies: ["simple"], armorTraining: ["light"] }),
      // Training with every armor and the Shield.
      testClass("guard", {
        hitDie: 10,
        savingThrows: ["str", "con"],
        skills: { choose: 1, from: ["athletics"] },
        armorTraining: ["light", "medium", "heavy", "shield"],
      }),
      // Expertise in Stealth twice, and in Arcana without the proficiency.
      testClass("expert", {
        skills: { choose: 1, from: ["stealth"] },
        levels: [
          {
            level: 1,
            effects: [
              { push: "expertise", value: "stealth" },
              { push: "expertise", value: "stealth" },
              { push: "expertise", value: "arcana" },
            ],
          },
        ],
      }),
    ],
  }),
  { packs: [SRD52] },
);
if (!loaded.pack) throw new Error("the test pack does not load");
const template = createTemplate({ packs: [SRD52, loaded.pack] });

function evaluate(entity: Entity2024) {
  const { built, contributions } = buildWithContributions(entity, template);
  return { built, contributions, problems: findProblems(entity, built, template), selections: availableSelections(entity, built, template) };
}

interface Character {
  method?: string;
  scores?: Record<string, number>;
  /** Each class with its level and its skills. The value of a level is a rolled Hit Point number. */
  classes?: { key: string; level: number; skills?: string[]; rolled?: Record<number, number> }[];
  armor?: string;
  shield?: boolean;
  more?: StrictSelection[];
}

// Standard Array: Str 8, Dex 15, Con 14, Int 13, Wis 12, Cha 10.
const ARRAY = { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 };

function character({
  method = "standard-array",
  scores = ARRAY,
  classes = [{ key: "test:tester", level: 1, skills: ["stealth", "perception"] }],
  armor,
  shield,
  more = [],
}: Character): Entity2024 {
  const classOptions = classes.map(
    ({ key, level, skills = [], rolled = {} }): StrictOption => ({
      key,
      selections: [
        { key: "skill-proficiencies", options: skills.map((skill) => ({ key: skill })) },
        {
          key: "levels",
          options: Array.from({ length: level }, (_, i) => ({ key: `level-${i + 1}`, ...(rolled[i + 1] === undefined ? {} : { value: rolled[i + 1] }) })),
        },
      ],
    }),
  );
  return {
    selections: [
      { key: "ability-scores", option: { key: method, value: scores } },
      { key: "class", options: classOptions },
      { key: "languages", options: [{ key: "srd52:draconic" }, { key: "srd52:elvish" }] },
      ...(armor ? [{ key: "armor", option: { key: armor } }] : []),
      ...(shield ? [{ key: "shield", option: { key: "shield" } }] : []),
      ...more,
    ],
  };
}

describe("a level 1 character with a class that has no features", () => {
  const { built, problems } = evaluate(character({}));

  it("has no problem", () => {
    expect(problems).toEqual([]);
  });

  it("has the scores and their modifiers", () => {
    expect(built.abilities).toEqual(ARRAY);
    // floor((score - 10) / 2), SRD p21: 8 -> -1, 15 -> +2, 14 -> +2, 13 -> +1, 12 -> +1, 10 -> 0.
    expect(built.abilityModifiers).toEqual({ str: -1, dex: 2, con: 2, int: 1, wis: 1, cha: 0 });
  });

  it("has the values of a character without a species", () => {
    expect(built.creatureType).toBe("humanoid");
    expect(built.size).toBe("medium");
    expect(built.speed).toBe(30);
    expect(built.darkvision).toBe(0);
  });

  it("has the Proficiency Bonus, Hit Points and Hit Point Dice of level 1", () => {
    expect(built.totalLevel).toBe(1);
    // Level 1: +2 (SRD p23).
    expect(built.proficiencyBonus).toBe(2);
    // The full d8 at level 1: 8, and Con +2 (SRD p22).
    expect(built.maxHitPoints).toBe(10);
    // One Hit Point Die at level 1 (SRD p22).
    expect(built.hitPointDice).toEqual({ d8: 1 });
  });

  it("has the saving throws and the skills of the class", () => {
    expect(built.savingThrowProficiencies).toEqual(["dex", "int"]);
    // Dex +2 + 2 = +4. Int +1 + 2 = +3. The others are the modifier.
    expect(built.saveBonuses).toEqual({ str: -1, dex: 4, con: 2, int: 3, wis: 1, cha: 0 });
    // Stealth: Dex +2 + 2 = +4. Perception: Wis +1 + 2 = +3. Arcana is not chosen: Int +1.
    expect(built.skillBonuses).toMatchObject({ stealth: 4, perception: 3, arcana: 1, athletics: -1 });
    // 10 + Perception +3 (SRD p22).
    expect(built.passivePerception).toBe(13);
    // The Dexterity modifier (SRD p22).
    expect(built.initiative).toBe(2);
  });

  it("has Armor Class 10 + Dex", () => {
    // 10 + Dex +2 (SRD p22).
    expect(built.armorClass).toBe(12);
    expect(built.armorClassFormula).toBe("unarmored");
  });

  it("has the training of the class, Common and two languages, and the carrying capacity", () => {
    expect(built.weaponProficiencies).toEqual(["simple"]);
    expect(built.armorTraining).toEqual(["light"]);
    expect(built.features).toEqual([]);
    expect(built.languages).toEqual(["srd52:common", "srd52:draconic", "srd52:elvish"]);
    // Medium: Str 8 x 15 lb. = 120. Drag, lift or push: Str 8 x 30 lb. = 240 (SRD p178).
    expect(built.carryingCapacity).toBe(120);
    expect(built.dragLiftPush).toBe(240);
  });
});

describe("languages", () => {
  it("offers the Standard Languages without Common", () => {
    const { selections } = evaluate(character({}));
    // The Standard Languages table without Common (SRD p20). Druidic and Thieves' Cant are rare languages.
    expect(selections.find((s) => s.key === "languages")?.options.map((o) => o.name)).toEqual([
      "Common Sign Language",
      "Draconic",
      "Dwarvish",
      "Elvish",
      "Giant",
      "Gnomish",
      "Goblin",
      "Halfling",
      "Orc",
    ]);
  });
});

describe("ability scores", () => {
  const problems = (method: string, scores: Record<string, number>) => evaluate(character({ method, scores })).problems.map((p) => p.reason);

  it("takes the Standard Array in any order, and nothing else", () => {
    expect(problems("standard-array", { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 })).toEqual([]);
    expect(problems("standard-array", { str: 15, dex: 15, con: 13, int: 12, wis: 10, cha: 8 })).toEqual([
      '"Standard Array" needs: the scores 15, 14, 13, 12, 10 and 8',
    ]);
  });

  it("takes Point Cost scores from 8 to 15 that cost 27 points or less", () => {
    // 15, 15, 15: 9 + 9 + 9 = 27. Three 8s cost 0.
    const exact = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    expect(pointCost(exact)).toBe(27);
    expect(problems("point-cost", exact)).toEqual([]);
    // 14, 13, 12, 12, 10, 8: 7 + 5 + 4 + 4 + 2 + 0 = 22.
    expect(pointCost({ str: 14, dex: 13, con: 12, int: 12, wis: 10, cha: 8 })).toBe(22);
    const reason = '"Point Cost" needs: scores from 8 to 15 that cost 27 points or less';
    // A 9 in place of an 8: 27 + 1 = 28.
    expect(problems("point-cost", { ...exact, int: 9 })).toEqual([reason]);
    // 16 is not on the table.
    expect(problems("point-cost", { str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toEqual([reason]);
  });

  it("takes any scores by manual entry, for example rolled ones", () => {
    const rolled = { str: 18, dex: 3, con: 11, int: 9, wis: 16, cha: 7 };
    const { built, problems } = evaluate(character({ method: "manual", scores: rolled }));
    expect(problems).toEqual([]);
    expect(built.abilities).toEqual(rolled);
  });

  it("does not let an increase raise a score above 20", () => {
    const soldier: StrictSelection = {
      key: "background",
      option: {
        key: "soldier",
        selections: [
          { key: "ability-scores", option: twoAndOne("str", "con") },
          { key: "gaming-set", option: { key: "dice" } },
        ],
      },
    };
    const { built } = evaluate(character({ method: "manual", scores: { ...ARRAY, str: 19 }, more: [soldier] }));
    // Str 19 + 2 stops at 20 (SRD p21). Con 14 + 1 = 15.
    expect(built.abilities.str).toBe(20);
    expect(built.abilities.con).toBe(15);
  });
});

describe("levels", () => {
  it("gives the fixed Hit Points and the Proficiency Bonus at level 5", () => {
    const { built } = evaluate(character({ classes: [{ key: "test:tester", level: 5, skills: ["stealth", "perception"] }] }));
    // Level 1: 8. Levels 2 to 5: 4 x the fixed 5 (d8: 8 / 2 + 1) = 20. Con +2 x 5 levels = 10. 8 + 20 + 10 = 38 (SRD p23).
    expect(built.maxHitPoints).toBe(38);
    // Levels 5 to 8: +3 (SRD p23).
    expect(built.proficiencyBonus).toBe(3);
    expect(built.hitPointDice).toEqual({ d8: 5 });
  });

  it("adds at least 1 Hit Point for each level", () => {
    // Con 6: -2. Level 1: 8 - 2 = 6. Level 2 rolled 1: 1 - 2 = -1, so 1 (SRD p23). 6 + 1 = 7.
    const { built } = evaluate(
      character({
        method: "manual",
        scores: { ...ARRAY, con: 6 },
        classes: [{ key: "test:tester", level: 2, skills: ["stealth", "perception"], rolled: { 2: 1 } }],
      }),
    );
    expect(built.maxHitPoints).toBe(7);
  });

  it("gives the fixed number for a value that is not a roll of the die", () => {
    const hitPoints = (rolled: number) =>
      evaluate(character({ classes: [{ key: "test:tester", level: 2, skills: ["stealth", "perception"], rolled: { 2: rolled } }] })).built.maxHitPoints;
    // Level 1: 8 + 2. Level 2: the fixed 5 + 2. A d8 cannot roll 0, 9 or 2.5.
    for (const value of [0, 9, 2.5]) expect(hitPoints(value)).toBe(17);
    // Level 2 rolled 8: 8 + 2.
    expect(hitPoints(8)).toBe(20);
  });

  it("gives a second class its level 1 as a later level", () => {
    const { built } = evaluate(
      character({
        classes: [
          { key: "test:tester", level: 1, skills: ["stealth", "perception"] },
          { key: "test:guard", level: 1, skills: ["athletics"] },
        ],
      }),
    );
    // Tester level 1: 8 + Con 2 = 10. Guard level 1 is the second class: the fixed 6 (d10: 10 / 2 + 1) + Con 2 = 8 (SRD p24).
    expect(built.maxHitPoints).toBe(18);
    expect(built.hitPointDice).toEqual({ d8: 1, d10: 1 });
    expect(built.totalLevel).toBe(2);
  });

  it("opens the subclass choice of an SRD class at level 3", () => {
    const { built, selections } = evaluate(
      character({ classes: [{ key: "srd52:barbarian", level: 3, skills: ["athletics", "survival"] }], scores: { ...ARRAY, con: 15 } }),
    );
    const subclass = selections.find((s) => s.path.join("/") === "class/srd52:barbarian/levels/level-3/subclass");
    expect(subclass?.options.map((o) => o.key)).toEqual(["srd52:path-of-the-berserker"]);
    // Level 1: 12. Levels 2 and 3: the fixed 7 each. Con +2 x 3 = 6. 12 + 14 + 6 = 32 (SRD p22, p23).
    expect(built.maxHitPoints).toBe(32);
    expect(built.features.filter((f) => f.level === 1).map((f) => f.name)).toEqual(["Rage", "Unarmored Defense", "Weapon Mastery"]);
  });
});

describe("Expertise", () => {
  it("doubles the Proficiency Bonus of a proficient skill, one time only", () => {
    const { built, contributions } = evaluate(character({ classes: [{ key: "test:expert", level: 1, skills: ["stealth"] }] }));
    // Stealth: Dex +2 + 2 + 2 = +6. Arcana has no proficiency, so Expertise does nothing: Int +1 (SRD p182).
    expect(built.skillBonuses).toMatchObject({ stealth: 6, arcana: 1 });
    expect(contributions.skillBonuses?.map((c) => [c.name, c.to.stealth])).toEqual([
      ["Proficiency Bonus", 4],
      ["Expertise", 6],
    ]);
  });
});

describe("Armor Class", () => {
  // Dex 16: +3, so the limit of Medium armor shows.
  const guard = (armor?: string, shield?: boolean) =>
    evaluate(
      character({
        method: "manual",
        scores: { str: 15, dex: 16, con: 14, int: 10, wis: 10, cha: 8 },
        classes: [{ key: "test:guard", level: 1, skills: ["athletics"] }],
        armor,
        shield,
      }),
    );

  it("is the base of the armor with its Dexterity limit, then the Shield", () => {
    // No armor: 10 + Dex +3 (SRD p22).
    expect(guard().built.armorClass).toBe(13);
    // Leather Armor, Light: 11 + Dex +3 (SRD p92).
    expect(guard("leather-armor").built.armorClass).toBe(14);
    // Scale Mail, Medium: 14 + Dex +3, at most +2 = 16.
    expect(guard("scale-mail").built.armorClass).toBe(16);
    // Chain Mail, Heavy: 16, no Dexterity.
    expect(guard("chain-mail").built.armorClass).toBe(16);
    // A Shield: +2.
    expect(guard(undefined, true).built.armorClass).toBe(15);
    expect(guard("chain-mail", true).built.armorClass).toBe(18);
  });

  it("takes a Dexterity penalty with Light and Medium armor, but not with Heavy armor", () => {
    // Dex 8: -1.
    const clumsy = (armor: string) =>
      evaluate(
        character({
          method: "manual",
          scores: { str: 15, dex: 8, con: 14, int: 10, wis: 10, cha: 10 },
          classes: [{ key: "test:guard", level: 1, skills: ["athletics"] }],
          armor,
        }),
      ).built.armorClass;
    // Leather Armor: 11 - 1. Scale Mail: 14 - 1. Chain Mail: 16 and Plate Armor: 18, flat (SRD p92).
    expect(["leather-armor", "scale-mail", "chain-mail", "plate-armor"].map(clumsy)).toEqual([10, 13, 16, 18]);
  });

  it("gives the parts in the contributions", () => {
    const { contributions } = guard("chain-mail", true);
    expect(contributions.baseArmorClass).toEqual([{ name: "Chain Mail", source: ["armor", "chain-mail"], from: 0, to: 16 }]);
    expect(contributions.armorClass).toEqual([{ name: "Shield", source: ["shield", "shield"], from: 16, to: 18 }]);
    expect(guard().contributions.baseArmorClass).toEqual([{ name: "Unarmored: 10 + Dexterity modifier", source: [], from: 0, to: 13 }]);
  });

  it("gives no Shield bonus without training, and marks armor without training", () => {
    // The Tester has training with Light armor only. Dex +2.
    const tester = (armor?: string, shield?: boolean) => evaluate(character({ armor, shield })).built;
    // 10 + Dex +2, and no +2 for the Shield (SRD p92).
    expect(tester(undefined, true).armorClass).toBe(12);
    expect(tester("leather-armor").armorWithoutTraining).toBe(false);
    // Chain Mail still gives 16, with Disadvantage on Strength and Dexterity D20 Tests (SRD p92).
    expect(tester("chain-mail")).toMatchObject({ armorClass: 16, armorWithoutTraining: true });
  });
});

describe("contributions of a saving throw", () => {
  it("gives the Proficiency Bonus as a part of the save", () => {
    const { built, contributions } = evaluate(character({}));
    // Dex save: the modifier +2, then the Proficiency Bonus +2.
    expect(contributions.saveBonuses).toEqual([
      { name: "Proficiency Bonus", source: [], from: built.abilityModifiers, to: { ...built.abilityModifiers, dex: 4, int: 3 } },
    ]);
  });
});
