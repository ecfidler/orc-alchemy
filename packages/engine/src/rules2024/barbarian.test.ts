// The Barbarian and the Path of the Berserker (ORC-250), SRD 5.2.1 p28 to
// p30. The character is the golden Barbarian: a Goliath Soldier with Str 17,
// Dex 14 and Con 14 at level 1. golden/characters/barbarian.ts has its full
// sheet at levels 1, 5 and 20.

import { describe, expect, it } from "vitest";
import { barbarianAt } from "../../golden/characters/barbarian.ts";
import { type Entity2024, evaluate, select } from "./evaluate.ts";
import { stepAt } from "./testing.ts";

const build = (entity: Entity2024) => evaluate(entity, { rules: "2024" });
type Built = ReturnType<typeof build>["built"];
const feature = (built: Built, name: string) => built.features.find((f) => f.name === name);

describe("level 1", () => {
  const { built, selections } = build(barbarianAt(1));

  it("has Unarmored Defense as the base Armor Class, also with a Shield", () => {
    // 10 + Dex 2 + Con 2 = 14 (p28).
    expect(built.armorClassFormula).toBe("srd52:barbarian/unarmored-defense");
    expect(built.armorClass).toBe(14);
    // "You can use a Shield and still gain this benefit" (p28): 14 + 2.
    expect(build(select(barbarianAt(1), ["shield"], "srd52:shield")).built.armorClass).toBe(16);
  });

  it("has two Rages that come back one on a Short Rest and all on a Long Rest", () => {
    expect(feature(built, "Rage")?.uses).toEqual({
      amount: 2,
      recover: [
        { on: "short-rest", amount: 1 },
        { on: "long-rest", amount: "all" },
      ],
    });
  });

  it("has the class columns of level 1", () => {
    // Rages 2, Rage Damage +2, Weapon Mastery 2 (p28).
    expect(built.classColumns).toEqual({ "srd52:barbarian": { "rage-count": 2, "rage-damage-bonus": 2, "weapon-mastery": 2 } });
  });

  it("offers 2 Weapon Masteries from the 28 Melee weapons", () => {
    // "two kinds of Simple or Martial Melee weapons" (p29). The SRD has 38 weapons, 10 of them Ranged (p90, p91).
    expect(selections.find((s) => s.key === "weapon-mastery")).toMatchObject({ min: 2, max: 2, optionCount: 28, remaining: 0 });
  });

  it("has the level 1 class features", () => {
    expect(built.features.filter((f) => f.source === "srd52:barbarian").map((f) => f.name)).toEqual(["Rage", "Unarmored Defense", "Weapon Mastery"]);
  });
});

describe("level 3", () => {
  const { built, selections } = build(barbarianAt(3));

  it("is a Berserker with Frenzy and one more skill from Primal Knowledge", () => {
    expect(built.subclasses).toEqual({ "srd52:barbarian": "srd52:path-of-the-berserker" });
    expect(built.features.filter((f) => f.level === 3).map((f) => f.name)).toEqual(["Barbarian Subclass", "Primal Knowledge", "Frenzy"]);
    // Primal Knowledge: a skill of the Barbarian list of level 1 (p29).
    expect(selections.find((s) => s.key === "primal-knowledge")).toMatchObject({
      path: ["class", "srd52:barbarian", "levels", "level-3", "primal-knowledge"],
      optionCount: 6,
      selected: ["animal-handling"],
    });
    expect(built.skillProficiencies).toContain("animal-handling");
  });

  it("has three Rages", () => {
    expect(feature(built, "Rage")?.uses?.amount).toBe(3);
  });
});

describe("level 5", () => {
  const { built } = build(barbarianAt(5));

  it("attacks twice and moves 10 feet more", () => {
    expect(built.attacksPerAction).toBe(2);
    // Goliath 35 + Fast Movement 10 (p29, p85).
    expect(built.speed).toBe(45);
  });

  it("has no Fast Movement in Heavy armor", () => {
    const plate = build(select(barbarianAt(5), ["armor"], "srd52:plate-armor")).built;
    expect(plate.wornArmorCategory).toBe("heavy");
    // Goliath 35. Plate Armor needs Str 15, and the Barbarian has 18 (p92), so no -10.
    expect(plate.speed).toBe(35);
    // Medium armor does not stop it.
    expect(build(select(barbarianAt(5), ["armor"], "srd52:breastplate")).built.speed).toBe(45);
  });
});

describe("level 11", () => {
  const { built } = build(barbarianAt(11));

  it("has the Rage Damage of level 9 and the masteries of level 10", () => {
    // Rages 4, Rage Damage +3, Weapon Mastery 4 (p28).
    expect(built.classColumns["srd52:barbarian"]).toEqual({ "rage-count": 4, "rage-damage-bonus": 3, "weapon-mastery": 4 });
    expect(built.weaponMasteries).toHaveLength(4);
    expect(built.features.filter((f) => f.level === 11).map((f) => f.name)).toEqual(["Relentless Rage"]);
  });
});

describe("level 20", () => {
  const { built } = build(barbarianAt(20));

  it("has Primal Champion: Strength and Constitution +4, at most 25", () => {
    // Str 20 + 4 = 24, then the Epic Boon + 1 = 25. Con 18 + 4 = 22 (p30, p88).
    expect(built.abilities).toMatchObject({ str: 25, con: 22 });
    expect(feature(built, "Primal Champion")).toMatchObject({ level: 20, source: "srd52:barbarian" });
  });

  it("has six Rages, Persistent Rage once and Intimidating Presence once a Long Rest", () => {
    expect(feature(built, "Rage")?.uses?.amount).toBe(6);
    expect(feature(built, "Persistent Rage")?.uses).toEqual({ amount: 1, recover: [{ on: "long-rest", amount: "all" }] });
    expect(feature(built, "Intimidating Presence")?.uses).toEqual({ amount: 1, recover: [{ on: "long-rest", amount: "all" }] });
  });
});

describe("levels 1 to 20", () => {
  // The Barbarian Features table (p28):
  //   Proficiency Bonus: +2 at 1, +3 at 5, +4 at 9, +5 at 13, +6 at 17.
  //   Rages: 2, 3 at 3, 4 at 6, 5 at 12, 6 at 17.
  //   Rage Damage: +2, +3 at 9, +4 at 16.
  //   Weapon Mastery: 2, 3 at 4, 4 at 10.
  //   Extra Attack at 5 (p29).
  for (let level = 1; level <= 20; level++) {
    it(`builds level ${level} with no open selection and no problem`, () => {
      const { built, selections, problems } = build(barbarianAt(level));
      expect(problems).toEqual([]);
      expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
      expect(built.classLevels).toEqual({ "srd52:barbarian": level });
      expect(built.proficiencyBonus).toBe(
        stepAt(level, [
          [1, 2],
          [5, 3],
          [9, 4],
          [13, 5],
          [17, 6],
        ]),
      );
      const rages = stepAt(level, [
        [1, 2],
        [3, 3],
        [6, 4],
        [12, 5],
        [17, 6],
      ]);
      expect(feature(built, "Rage")?.uses?.amount).toBe(rages);
      const masteries =
        stepAt(level, [
          [1, 2],
          [4, 3],
          [10, 4],
        ]) ?? 0;
      expect(built.weaponMasteries).toHaveLength(masteries);
      expect(built.classColumns["srd52:barbarian"]).toEqual({
        "rage-count": rages,
        "rage-damage-bonus": stepAt(level, [
          [1, 2],
          [9, 3],
          [16, 4],
        ]),
        "weapon-mastery": masteries,
      });
      expect(built.attacksPerAction).toBe(level >= 5 ? 2 : 1);
      expect(built.speed).toBe(level >= 5 ? 45 : 35);
      expect(feature(built, "Persistent Rage")?.uses?.amount).toBe(level >= 15 ? 1 : undefined);
    });
  }

  it("has the features of the table and the subclass at each level", () => {
    const { built } = build(barbarianAt(20));
    const names = (level: number) => built.features.filter((f) => f.level === level).map((f) => f.name);
    expect([...Array(20).keys()].map((i) => names(i + 1))).toEqual([
      ["Rage", "Unarmored Defense", "Weapon Mastery"],
      ["Danger Sense", "Reckless Attack"],
      ["Barbarian Subclass", "Primal Knowledge", "Frenzy"],
      ["Ability Score Improvement"],
      ["Extra Attack", "Fast Movement"],
      ["Mindless Rage"],
      ["Feral Instinct", "Instinctive Pounce"],
      [],
      ["Brutal Strike"],
      ["Retaliation"],
      ["Relentless Rage"],
      [],
      ["Improved Brutal Strike"],
      ["Intimidating Presence"],
      ["Persistent Rage"],
      [],
      ["Improved Brutal Strike"],
      ["Indomitable Might"],
      ["Epic Boon"],
      ["Primal Champion"],
    ]);
  });

  it("offers a feat at levels 4, 8, 12 and 16, and the Epic Boon at 19", () => {
    const { selections } = build(barbarianAt(20));
    const names = (level: number) =>
      selections.filter((s) => s.path.slice(0, 4).join("/") === `class/srd52:barbarian/levels/level-${level}` && s.path.length === 5).map((s) => s.name);
    for (const level of [4, 8, 12, 16]) expect(names(level)).toContain("Ability Score Improvement");
    expect(names(19)).toEqual(["Epic Boon"]);
    for (const level of [6, 10, 14, 20]) expect(names(level)).toEqual([]);
  });
});
