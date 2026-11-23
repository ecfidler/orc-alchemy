// The Monk and the Warrior of the Open Hand (ORC-251), SRD 5.2.1 p49 to
// p52. The character is the golden Monk: a Human Criminal with Str 8,
// Dex 17, Con 14 and Wis 14 at level 1. golden/characters/monk.ts has its
// full sheet at levels 1, 5 and 20.

import { describe, expect, it } from "vitest";
import { monkAt } from "../../golden/characters/monk.ts";
import { UNARMED_STRIKE } from "./built.ts";
import { type Entity2024, evaluate, select } from "./evaluate.ts";
import { stepAt } from "./testing.ts";

const build = (entity: Entity2024) => evaluate(entity, { rules: "2024" });
type Built = ReturnType<typeof build>["built"];
const feature = (built: Built, name: string) => built.features.find((f) => f.name === name);
const attack = (built: Built, weapon: string) => built.weaponAttacks.find((a) => a.weapon === weapon);

describe("level 1", () => {
  const { built } = build(monkAt(1));

  it("has Unarmored Defense, but not with a Shield", () => {
    // 10 + Dex 3 + Wis 2 = 15 (p50).
    expect(built.armorClassFormula).toBe("srd52:monk/unarmored-defense");
    expect(built.armorClass).toBe(15);
    // "While you aren't wearing armor or wielding a Shield" (p50): 10 + Dex 3 = 13. The Monk has no Shield
    // training, so the Shield adds nothing (p92).
    const shield = build(select(monkAt(1), ["shield"], "srd52:shield")).built;
    expect(shield.armorClassFormula).not.toBe("srd52:monk/unarmored-defense");
    expect(shield.armorClass).toBe(13);
  });

  it("uses Dexterity and the Martial Arts die with Monk weapons and the Unarmed Strike", () => {
    // Spear, Simple Melee: Dex 3 + PB 2 = +5, 1d6 + 3 (p50).
    expect(attack(built, "srd52:spear")).toMatchObject({ attackBonus: 5, damage: "1d6+3", versatileDamage: "1d8+3" });
    expect(attack(built, UNARMED_STRIKE)).toMatchObject({ name: "Unarmed Strike", attackBonus: 5, damage: "1d6+3", damageType: "srd52:bludgeoning" });
  });

  it("does not use Martial Arts with a weapon that is not a Monk weapon", () => {
    // Longsword, Martial and not Light: Str -1, no proficiency (p49), 1d8 (p91).
    const longsword = build(select(monkAt(1), ["weapons"], "srd52:longsword")).built;
    expect(attack(longsword, "srd52:longsword")).toMatchObject({ attackBonus: -1, damage: "1d8-1" });
    // The Light Hand Crossbow is a Ranged weapon, so not a Monk weapon. Dex 3 + PB 2, 1d6 + 3, as without Martial Arts.
    const crossbow = build(select(monkAt(1), ["weapons"], "srd52:hand-crossbow")).built;
    expect(attack(crossbow, "srd52:hand-crossbow")).toMatchObject({ attackBonus: 5, damage: "1d6+3" });
  });

  it("loses Martial Arts in armor or with a Shield", () => {
    for (const [path, key] of [
      [["armor"], "srd52:leather-armor"],
      [["shield"], "srd52:shield"],
    ] as const) {
      const { built: geared } = build(select(monkAt(1), [...path], key));
      // Spear: Str -1 + PB 2 = +1, 1d6 - 1. No line for the Unarmed Strike.
      expect(attack(geared, "srd52:spear")).toMatchObject({ attackBonus: 1, damage: "1d6-1" });
      expect(attack(geared, UNARMED_STRIKE)).toBeUndefined();
    }
  });

  it("has no Focus Points before level 2", () => {
    expect(feature(built, "Monk's Focus")).toBeUndefined();
    expect(built.features.filter((f) => f.source === "srd52:monk").map((f) => f.name)).toEqual(["Martial Arts", "Unarmored Defense"]);
  });
});

describe("level 3", () => {
  const { built } = build(monkAt(3));

  it("is a Warrior of the Open Hand with 3 Focus Points", () => {
    expect(built.subclasses).toEqual({ "srd52:monk": "srd52:warrior-of-the-open-hand" });
    expect(built.features.filter((f) => f.level === 3).map((f) => f.name)).toEqual(["Deflect Attacks", "Monk Subclass", "Open Hand Technique"]);
    // Focus Points: the Monk level, back on a Short or Long Rest (p50).
    expect(feature(built, "Monk's Focus")?.uses).toEqual({
      amount: 3,
      recover: [
        { on: "short-rest", amount: "all" },
        { on: "long-rest", amount: "all" },
      ],
    });
    expect(feature(built, "Uncanny Metabolism")?.uses).toEqual({ amount: 1, recover: [{ on: "long-rest", amount: "all" }] });
  });
});

describe("level 5", () => {
  const { built } = build(monkAt(5));

  it("attacks twice with the d8 of Martial Arts", () => {
    expect(built.attacksPerAction).toBe(2);
    // Dex 4 + PB 3 = +7 (p50).
    expect(attack(built, UNARMED_STRIKE)).toMatchObject({ attackBonus: 7, damage: "1d8+4" });
  });

  it("moves 10 feet more only without armor and a Shield", () => {
    // 30 + 10 (p51).
    expect(built.speed).toBe(40);
    expect(build(select(monkAt(5), ["shield"], "srd52:shield")).built.speed).toBe(30);
  });
});

describe("level 11", () => {
  const { built } = build(monkAt(11));

  it("has the Martial Arts die 1d10, 11 Focus Points and Fleet Step", () => {
    expect(built.martialArtsDie).toBe(10);
    expect(feature(built, "Monk's Focus")?.uses?.amount).toBe(11);
    // Wholeness of Body: the Wis modifier, at least 1. Wis 15 at level 11 -> 2 (p52).
    expect(feature(built, "Wholeness of Body")?.uses).toEqual({ amount: 2, recover: [{ on: "long-rest", amount: "all" }] });
    expect(built.features.filter((f) => f.level === 11).map((f) => f.name)).toEqual(["Fleet Step"]);
    // Unarmored Movement +20 ft. from level 10 (p50).
    expect(built.speed).toBe(50);
  });
});

describe("level 20", () => {
  const { built } = build(monkAt(20));

  it("has Body and Mind: Dexterity and Wisdom +4, at most 25", () => {
    // Dex 20 + 4 = 24, then the Epic Boon + 1 = 25. Wis 18 + 4 = 22 (p52, p88).
    expect(built.abilities).toMatchObject({ dex: 25, wis: 22 });
    expect(feature(built, "Body and Mind")).toMatchObject({ level: 20, source: "srd52:monk" });
  });

  it("has proficiency in every saving throw from Disciplined Survivor", () => {
    expect(built.savingThrowProficiencies).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  });
});

describe("levels 1 to 20", () => {
  // The Monk Features table (p50):
  //   Proficiency Bonus: +2 at 1, +3 at 5, +4 at 9, +5 at 13, +6 at 17.
  //   Martial Arts: 1d6, 1d8 at 5, 1d10 at 11, 1d12 at 17.
  //   Focus Points: the Monk level from level 2.
  //   Unarmored Movement: +10 ft. at 2, +15 at 6, +20 at 10, +25 at 14, +30 at 18.
  //   Extra Attack at 5 (p51).
  for (let level = 1; level <= 20; level++) {
    it(`builds level ${level} with no open selection and no problem`, () => {
      const { built, selections, problems } = build(monkAt(level));
      expect(problems).toEqual([]);
      expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
      expect(built.classLevels).toEqual({ "srd52:monk": level });
      expect(built.proficiencyBonus).toBe(
        stepAt(level, [
          [1, 2],
          [5, 3],
          [9, 4],
          [13, 5],
          [17, 6],
        ]),
      );
      const die = stepAt(level, [
        [1, 6],
        [5, 8],
        [11, 10],
        [17, 12],
      ]);
      const movement =
        stepAt(level, [
          [2, 10],
          [6, 15],
          [10, 20],
          [14, 25],
          [18, 30],
        ]) ?? 0;
      const focus = level >= 2 ? level : 0;
      expect(built.martialArtsDie).toBe(die);
      expect(built.classColumns["srd52:monk"]).toEqual({ "martial-arts-die": die, "focus-points": focus, "unarmored-movement-bonus": movement });
      expect(feature(built, "Monk's Focus")?.uses?.amount).toBe(level >= 2 ? focus : undefined);
      expect(built.speed).toBe(30 + movement);
      expect(built.attacksPerAction).toBe(level >= 5 ? 2 : 1);
      expect(built.savingThrowProficiencies).toHaveLength(level >= 14 ? 6 : 2);
    });
  }

  it("has the features of the table and the subclass at each level", () => {
    const { built } = build(monkAt(20));
    const names = (level: number) => built.features.filter((f) => f.level === level).map((f) => f.name);
    expect([...Array(20).keys()].map((i) => names(i + 1))).toEqual([
      ["Martial Arts", "Unarmored Defense"],
      ["Monk's Focus", "Unarmored Movement", "Uncanny Metabolism"],
      ["Deflect Attacks", "Monk Subclass", "Open Hand Technique"],
      ["Ability Score Improvement", "Slow Fall"],
      ["Extra Attack", "Stunning Strike"],
      // The subclass is a choice of level 3, so its features come before the class features of a later level.
      ["Wholeness of Body", "Empowered Strikes"],
      ["Evasion"],
      [],
      ["Acrobatic Movement"],
      ["Heightened Focus", "Self-Restoration"],
      ["Fleet Step"],
      [],
      ["Deflect Energy"],
      ["Disciplined Survivor"],
      ["Perfect Focus"],
      [],
      ["Quivering Palm"],
      ["Superior Defense"],
      ["Epic Boon"],
      ["Body and Mind"],
    ]);
  });

  it("offers a feat at levels 4, 8, 12 and 16, and the Epic Boon at 19", () => {
    const { selections } = build(monkAt(20));
    const names = (level: number) =>
      selections.filter((s) => s.path.slice(0, 4).join("/") === `class/srd52:monk/levels/level-${level}` && s.path.length === 5).map((s) => s.name);
    for (const level of [4, 8, 12, 16]) expect(names(level)).toContain("Ability Score Improvement");
    expect(names(19)).toEqual(["Epic Boon"]);
  });
});
