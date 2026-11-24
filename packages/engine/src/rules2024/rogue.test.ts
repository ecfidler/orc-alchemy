// The Rogue and the Thief (ORC-252), SRD 5.2.1 p61 to p64. The character
// is the golden Rogue: a Halfling Criminal with Dex 17 at level 1.
// golden/characters/rogue.ts has its full sheet at levels 1, 3 and 20.

import { describe, expect, it } from "vitest";
import { rogueAt } from "../../golden/characters/rogue.ts";
import { type Entity2024, evaluate } from "./evaluate.ts";

const build = (entity: Entity2024) => evaluate(entity, { rules: "2024" });
type Built = ReturnType<typeof build>["built"];
const feature = (built: Built, name: string) => built.features.find((f) => f.name === name);
/** The Sneak Attack column (p62): 1d6 at level 1, one more d6 at each odd level. */
const sneakAttack = (level: number) => `${Math.ceil(level / 2)}d6`;

describe("level 1", () => {
  const { built, selections } = build(rogueAt(1));

  it("has Expertise in two skills with proficiency", () => {
    expect(built.expertise).toEqual(["stealth", "sleight-of-hand"]);
    expect(selections.find((s) => s.key === "expertise")).toMatchObject({ min: 2, max: 2, remaining: 0 });
  });

  it("knows Thieves' Cant and one more language", () => {
    expect(built.languages).toContain("srd52:thieves-cant");
    expect(selections.find((s) => s.key === "thieves-cant")).toMatchObject({ selected: ["srd52:goblin"], remaining: 0 });
  });

  it("has 2 Weapon Masteries of weapons with proficiency, and Sneak Attack 1d6", () => {
    expect(selections.find((s) => s.key === "weapon-mastery")).toMatchObject({ min: 2, max: 2, remaining: 0 });
    expect(built.classColumns).toEqual({ "srd52:rogue": { "sneak-attack": "1d6" } });
  });
});

describe("level 3", () => {
  const { built } = build(rogueAt(3));

  it("is a Thief", () => {
    expect(built.subclasses).toEqual({ "srd52:rogue": "srd52:thief" });
    expect(built.features.filter((f) => f.level === 3).map((f) => f.name)).toEqual(["Rogue Subclass", "Steady Aim", "Fast Hands", "Second-Story Work"]);
  });
});

describe("level 5", () => {
  const { built } = build(rogueAt(5));

  it("has Cunning Strike and Uncanny Dodge, Sneak Attack 3d6, and still one attack", () => {
    expect(built.features.filter((f) => f.level === 5).map((f) => f.name)).toEqual(["Cunning Strike", "Uncanny Dodge"]);
    expect(built.classColumns["srd52:rogue"]).toEqual({ "sneak-attack": "3d6" });
    expect(built.attacksPerAction).toBe(1);
  });
});

describe("level 11", () => {
  const { built } = build(rogueAt(11));

  it("has four skills with Expertise and Improved Cunning Strike", () => {
    // Expertise in two more skills at level 6 (p61).
    expect(built.expertise).toEqual(["stealth", "sleight-of-hand", "perception", "acrobatics"]);
    expect(feature(built, "Improved Cunning Strike")).toMatchObject({ level: 11 });
    expect(built.classColumns["srd52:rogue"]).toEqual({ "sneak-attack": "6d6" });
  });
});

describe("level 20", () => {
  const { built } = build(rogueAt(20));

  it("has Stroke of Luck once a Short or Long Rest, and the saves of Slippery Mind", () => {
    expect(feature(built, "Stroke of Luck")?.uses).toEqual({
      amount: 1,
      recover: [
        { on: "short-rest", amount: "all" },
        { on: "long-rest", amount: "all" },
      ],
    });
    expect(built.savingThrowProficiencies).toEqual(["dex", "int", "wis", "cha"]);
  });
});

describe("levels 1 to 20", () => {
  // The Rogue Features table (p62): Proficiency Bonus +2 at 1, +3 at 5, +4 at 9, +5 at 13, +6 at 17, and
  // the Sneak Attack dice. Weapon Mastery stays 2 (p62). Slippery Mind at 15 (p63).
  for (let level = 1; level <= 20; level++) {
    it(`builds level ${level} with no open selection and no problem`, () => {
      const { built, selections, problems } = build(rogueAt(level));
      expect(problems).toEqual([]);
      expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
      expect(built.classLevels).toEqual({ "srd52:rogue": level });
      expect(built.proficiencyBonus).toBe(2 + Math.floor((level - 1) / 4));
      expect(built.classColumns["srd52:rogue"]).toEqual({ "sneak-attack": sneakAttack(level) });
      expect(built.weaponMasteries).toHaveLength(2);
      expect(built.expertise).toHaveLength(level >= 6 ? 4 : 2);
      expect(built.savingThrowProficiencies).toHaveLength(level >= 15 ? 4 : 2);
      expect(feature(built, "Stroke of Luck")?.uses?.amount).toBe(level >= 20 ? 1 : undefined);
    });
  }

  it("has the features of the table and the subclass at each level", () => {
    const { built } = build(rogueAt(20));
    const names = (level: number) => built.features.filter((f) => f.level === level).map((f) => f.name);
    expect([...Array(20).keys()].map((i) => names(i + 1))).toEqual([
      ["Expertise", "Sneak Attack", "Thieves' Cant", "Weapon Mastery"],
      ["Cunning Action"],
      ["Rogue Subclass", "Steady Aim", "Fast Hands", "Second-Story Work"],
      ["Ability Score Improvement"],
      ["Cunning Strike", "Uncanny Dodge"],
      [],
      ["Evasion", "Reliable Talent"],
      [],
      ["Supreme Sneak"],
      [],
      ["Improved Cunning Strike"],
      [],
      ["Use Magic Device"],
      ["Devious Strikes"],
      ["Slippery Mind"],
      [],
      ["Thief's Reflexes"],
      ["Elusive"],
      ["Epic Boon"],
      ["Stroke of Luck"],
    ]);
  });

  it("offers a feat at levels 4, 8, 10, 12 and 16, and the Epic Boon at 19", () => {
    const { selections } = build(rogueAt(20));
    const names = (level: number) =>
      selections.filter((s) => s.path.slice(0, 4).join("/") === `class/srd52:rogue/levels/level-${level}` && s.path.length === 5).map((s) => s.name);
    for (const level of [4, 8, 10, 12, 16]) expect(names(level)).toContain("Ability Score Improvement");
    expect(names(19)).toEqual(["Epic Boon"]);
  });
});
