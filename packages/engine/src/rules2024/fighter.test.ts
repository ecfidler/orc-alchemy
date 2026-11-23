// The 2024 Fighter slice with hand-checked values at levels 1, 3 and 5.
//
// The character: a Dwarf Soldier Fighter. Scores before increases, from the
// Standard Array: Str 15, Dex 13, Con 14, Int 8, Wis 12, Cha 10. The
// background gives Str +2 and Con +1. Each expected number below has its
// arithmetic in a comment, from the rules of SRD 5.2.1.

import { describe, expect, it } from "vitest";
import { canChoose } from "../core/build.ts";
import type { StrictOption } from "../core/entity.ts";
import { BUILT_IN } from "./built-in.ts";
import { recordsOf } from "./content.ts";
import {
  addLevel,
  autofill,
  buildCharacter,
  type ContentPack,
  deselect,
  type Entity2024,
  evaluate,
  removeLevel,
  select,
  setOptionValue,
  setValue,
} from "./evaluate.ts";
import { featSelection } from "./records.ts";
import { type Choices, fighterCharacter as character, stepAt } from "./testing.ts";

const build = (choices: Choices) => evaluate(character(choices), { rules: "2024" });
const attack = (built: ReturnType<typeof build>["built"], weapon: string) => built.weaponAttacks.find((a) => a.weapon === weapon);
const feature = (built: ReturnType<typeof build>["built"], name: string) => built.features.find((f) => f.name === name);

describe("level 1", () => {
  const { built, selections } = build({ level: 1 });

  it("has the identity of the choices", () => {
    expect(built.name).toBe("Brunhild");
    expect(built.species).toBe("srd52:dwarf");
    expect(built.background).toBe("srd52:soldier");
    expect(built.classes).toEqual(["srd52:fighter"]);
    expect(built.classLevels).toEqual({ "srd52:fighter": 1 });
    expect(built.hitDice).toEqual({ "srd52:fighter": 10 });
    expect(built.subclasses).toEqual({});
    expect(built.totalLevel).toBe(1);
    expect(built.size).toBe("medium");
    expect(built.speed).toBe(30);
    expect(built.darkvision).toBe(120);
  });

  it("adds the background's +2 and +1 to the scores", () => {
    // Str 15 + 2 = 17. Con 14 + 1 = 15. The others do not change.
    expect(built.abilities).toEqual({ str: 17, dex: 13, con: 15, int: 8, wis: 12, cha: 10 });
    // floor((score - 10) / 2): 17 -> +3, 13 -> +1, 15 -> +2, 8 -> -1, 12 -> +1, 10 -> 0.
    expect(built.abilityModifiers).toEqual({ str: 3, dex: 1, con: 2, int: -1, wis: 1, cha: 0 });
  });

  it("has 13 Hit Points", () => {
    // Fighter level 1: 10. Con modifier: +2. Dwarven Toughness: +1 for level 1.
    expect(built.maxHitPoints).toBe(13);
  });

  it("has a Proficiency Bonus of +2 in Strength and Constitution saves", () => {
    expect(built.proficiencyBonus).toBe(2);
    expect(built.savingThrowProficiencies).toEqual(["str", "con"]);
    // Str +3 + 2 = +5. Con +2 + 2 = +4. The others are the ability modifier.
    expect(built.saveBonuses).toEqual({ str: 5, dex: 1, con: 4, int: -1, wis: 1, cha: 0 });
  });

  it("has the skills of the background and the class", () => {
    expect([...built.skillProficiencies].sort()).toEqual(["athletics", "intimidation", "perception", "survival"]);
    // Athletics: Str +3 + 2. Intimidation: Cha 0 + 2. Perception and Survival: Wis +1 + 2.
    expect(built.skillBonuses).toMatchObject({ athletics: 5, intimidation: 2, perception: 3, survival: 3 });
    // Not proficient: the ability modifier only.
    expect(built.skillBonuses).toMatchObject({ stealth: 1, arcana: -1, persuasion: 0 });
    // 10 + Perception +3.
    expect(built.passivePerception).toBe(13);
  });

  it("has the other proficiencies", () => {
    expect(built.weaponProficiencies).toEqual(["simple", "martial"]);
    expect(built.armorTraining).toEqual(["light", "medium", "heavy", "shield"]);
    expect(built.toolProficiencies).toEqual(["srd52:dice"]);
    expect(built.languages).toEqual(["srd52:common", "srd52:dwarvish", "srd52:giant"]);
    expect(built.resistances).toEqual(["srd52:poison"]);
  });

  it("has Armor Class 17 in Chain Mail with the Defense feat", () => {
    // Without armor: 10 + Dex +1.
    expect(built.unarmoredArmorClass).toBe(11);
    // Chain Mail 16, no Dexterity. Defense: +1 while wearing armor.
    expect(built.wornArmor).toBe("srd52:chain-mail");
    expect(built.armorClass).toBe(17);
    expect(built.initiative).toBe(1);
  });

  it("has the Origin feat of the background and the Fighting Style feat", () => {
    expect(built.feats).toEqual([
      { key: "srd52:defense", name: "Defense", category: "fighting-style" },
      { key: "srd52:savage-attacker", name: "Savage Attacker", category: "origin" },
    ]);
  });

  it("attacks once, with the mastery of the chosen weapons only", () => {
    expect(built.attacksPerAction).toBe(1);
    expect(built.criticalHitMinimum).toBe(20);
    expect(built.weaponMasteries).toEqual(["srd52:greatsword", "srd52:longbow", "srd52:flail"]);
    // Greatsword: Str +3 + PB 2 = +5, and 2d6 + 3.
    expect(attack(built, "srd52:greatsword")).toEqual({
      weapon: "srd52:greatsword",
      name: "Greatsword",
      attackBonus: 5,
      damage: "2d6+3",
      damageType: "srd52:slashing",
      properties: ["heavy", "two-handed"],
      mastery: "graze",
      disadvantage: false,
    });
    // Longbow, a Ranged weapon: Dex +1 + PB 2 = +3, and 1d8 + 1.
    expect(attack(built, "srd52:longbow")).toMatchObject({ attackBonus: 3, damage: "1d8+1", mastery: "slow" });
    // Dagger, Finesse: the higher of Str +3 and Dex +1. Not a chosen mastery.
    expect(attack(built, "srd52:dagger")).toMatchObject({ attackBonus: 5, damage: "1d4+3", mastery: null });
  });

  it("has the level 1 features with their uses", () => {
    expect(built.features.map((f) => f.name)).toEqual([
      "Fighting Style",
      "Second Wind",
      "Weapon Mastery",
      // A feat with no traits, such as Defense, is one feature with its description.
      "Defense",
      // The spike Dwarf had no Darkvision feature. srd52:dwarf lists each trait of the SRD as a feature.
      "Darkvision",
      "Dwarven Resilience",
      "Dwarven Toughness",
      "Stonecunning",
      "Savage Attacker",
    ]);
    // Second Wind: 2 uses at levels 1 to 3.
    expect(feature(built, "Second Wind")?.uses).toEqual({
      amount: 2,
      recover: [
        { on: "short-rest", amount: 1 },
        { on: "long-rest", amount: "all" },
      ],
    });
    // Stonecunning: uses equal to the Proficiency Bonus, +2.
    expect(feature(built, "Stonecunning")?.uses).toEqual({ amount: 2, recover: [{ on: "long-rest", amount: "all" }] });
    expect(feature(built, "Second Wind")).toMatchObject({ key: "srd52:fighter/second-wind", source: "srd52:fighter", level: 1 });
  });

  it("has every selection filled", () => {
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
    expect(selections.map((s) => s.path.join("/"))).toEqual([
      "ability-scores",
      "class",
      "class/srd52:fighter/skill-proficiencies",
      "class/srd52:fighter/starting-equipment",
      "class/srd52:fighter/levels",
      "class/srd52:fighter/levels/level-1/fighting-style",
      "class/srd52:fighter/levels/level-1/weapon-mastery",
      "species",
      "background",
      "background/srd52:soldier/ability-scores",
      "background/srd52:soldier/ability-scores/two-and-one/plus-two",
      "background/srd52:soldier/ability-scores/two-and-one/plus-one",
      "background/srd52:soldier/tool",
      "background/srd52:soldier/starting-equipment",
      "languages",
      "armor",
      "shield",
      "weapons",
      "equipment",
    ]);
  });

  it("offers 3 Weapon Masteries from the 38 weapons", () => {
    expect(selections.find((s) => s.key === "weapon-mastery")).toEqual({
      key: "weapon-mastery",
      name: "Weapon Mastery",
      path: ["class", "srd52:fighter", "levels", "level-1", "weapon-mastery"],
      actualPath: ["weapon-mastery"],
      ref: ["weapon-mastery"],
      min: 3,
      max: 3,
      remaining: 0,
      optionCount: 38,
      selected: ["srd52:greatsword", "srd52:longbow", "srd52:flail"],
      multiselect: true,
    });
  });
});

describe("level 3", () => {
  const { built, selections } = build({ level: 3 });

  it("has 31 Hit Points", () => {
    // Level 1: 10. Levels 2 and 3: 6 each. Con +2 for 3 levels: 6. Dwarven Toughness: 3.
    expect(built.maxHitPoints).toBe(31);
  });

  it("uses a rolled Hit Point number in place of the fixed 6", () => {
    // Level 2 rolled 9, and level 3 rolled 4: 10 + 9 + 4 + 6 + 3.
    expect(build({ level: 3, rolledHitPoints: { 2: 9, 3: 4 } }).built.maxHitPoints).toBe(32);
    // Level 2 rolled 10: 10 + 10 + 6 + 6 + 3.
    expect(build({ level: 3, rolledHitPoints: { 2: 10 } }).built.maxHitPoints).toBe(35);
  });

  it("is a Champion with Improved Critical", () => {
    expect(built.classLevels).toEqual({ "srd52:fighter": 3 });
    expect(built.subclasses).toEqual({ "srd52:fighter": "srd52:champion" });
    expect(built.criticalHitMinimum).toBe(19);
    expect(built.features.filter((f) => f.level === 3).map((f) => f.name)).toEqual(["Fighter Subclass", "Improved Critical", "Remarkable Athlete"]);
  });

  it("has Action Surge once and Second Wind twice", () => {
    // Action Surge: "until you finish a Short or Long Rest" (p48).
    expect(feature(built, "Action Surge")?.uses).toEqual({
      amount: 1,
      recover: [
        { on: "short-rest", amount: "all" },
        { on: "long-rest", amount: "all" },
      ],
    });
    expect(feature(built, "Second Wind")?.uses?.amount).toBe(2);
    expect(feature(built, "Tactical Mind")).toBeDefined();
  });

  it("keeps the level 1 numbers that level 3 does not change", () => {
    expect(built.proficiencyBonus).toBe(2);
    expect(built.attacksPerAction).toBe(1);
    expect(built.armorClass).toBe(17);
    expect(built.abilities.str).toBe(17);
    expect(attack(built, "srd52:greatsword")?.attackBonus).toBe(5);
  });

  it("offers the subclass at level 3, and has no selection left to fill", () => {
    expect(selections.find((s) => s.key === "subclass")).toMatchObject({
      path: ["class", "srd52:fighter", "levels", "level-3", "subclass"],
      selected: ["srd52:champion"],
    });
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
  });
});

describe("level 5", () => {
  const { built, selections } = build({ level: 5 });

  it("has the level 4 Ability Score Improvement in the scores", () => {
    // Str 17 + 1 = 18. Con 15 + 1 = 16.
    expect(built.abilities).toEqual({ str: 18, dex: 13, con: 16, int: 8, wis: 12, cha: 10 });
    expect(built.abilityModifiers).toMatchObject({ str: 4, con: 3 });
    expect(built.feats.map((f) => f.key)).toEqual(["srd52:defense", "srd52:ability-score-improvement", "srd52:savage-attacker"]);
  });

  it("has 54 Hit Points", () => {
    // Level 1: 10. Levels 2 to 5: 4 x 6 = 24. Con +3 for all 5 levels: 15. Dwarven Toughness: 5.
    expect(built.maxHitPoints).toBe(54);
  });

  it("has a Proficiency Bonus of +3", () => {
    expect(built.proficiencyBonus).toBe(3);
    // Str +4 + 3 = +7. Con +3 + 3 = +6.
    expect(built.saveBonuses).toEqual({ str: 7, dex: 1, con: 6, int: -1, wis: 1, cha: 0 });
    // Athletics: Str +4 + 3. Intimidation: 0 + 3. Perception and Survival: Wis +1 + 3.
    expect(built.skillBonuses).toMatchObject({ athletics: 7, intimidation: 3, perception: 4, survival: 4, stealth: 1 });
    expect(built.passivePerception).toBe(14);
  });

  it("attacks twice", () => {
    expect(built.attacksPerAction).toBe(2);
    expect(built.criticalHitMinimum).toBe(19);
    // Greatsword: Str +4 + PB 3 = +7, and 2d6 + 4.
    expect(attack(built, "srd52:greatsword")).toMatchObject({ attackBonus: 7, damage: "2d6+4", mastery: "graze" });
    // Longbow: Dex +1 + PB 3 = +4.
    expect(attack(built, "srd52:longbow")).toMatchObject({ attackBonus: 4, damage: "1d8+1", mastery: "slow" });
    // Dagger: Str +4 + PB 3 = +7. It is the fourth mastery, chosen at level 4.
    expect(attack(built, "srd52:dagger")).toMatchObject({ attackBonus: 7, damage: "1d4+4", mastery: "nick" });
  });

  it("has more uses of the features that follow the level", () => {
    // Second Wind: 3 uses from level 4. Stonecunning: Proficiency Bonus +3.
    expect(feature(built, "Second Wind")?.uses?.amount).toBe(3);
    expect(feature(built, "Stonecunning")?.uses?.amount).toBe(3);
    expect(feature(built, "Action Surge")?.uses?.amount).toBe(1);
    expect(built.features.filter((f) => f.level === 5).map((f) => f.name)).toEqual(["Extra Attack", "Tactical Shift"]);
  });

  it("keeps Armor Class 17", () => {
    // Chain Mail 16 + Defense 1. Heavy armor does not add Dexterity.
    expect(built.wornArmor).toBe("srd52:chain-mail");
    expect(built.armorClass).toBe(17);
  });

  it("pools the Weapon Mastery choices of levels 1 and 4 into 4", () => {
    const pools = selections.filter((s) => s.key === "weapon-mastery");
    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({ min: 4, max: 4, remaining: 0, selected: ["srd52:greatsword", "srd52:longbow", "srd52:flail", "srd52:dagger"] });
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
  });

  it("reports one Weapon Mastery to choose when level 4 added none", () => {
    const three = build({ level: 5, masteries: ["srd52:greatsword", "srd52:longbow", "srd52:flail"] });
    expect(three.selections.find((s) => s.key === "weapon-mastery")?.remaining).toBe(1);
    expect(attack(three.built, "srd52:dagger")?.mastery).toBeNull();
  });
});

describe("levels 1 to 20 (ORC-230)", () => {
  // The Fighter Features table (SRD 5.2.1 p47) and the Champion (p49). The
  // test fills the open choices of each level with autofill, so the
  // numbers below do not read the ability scores.
  //   Proficiency Bonus: +2 at 1, +3 at 5, +4 at 9, +5 at 13, +6 at 17 (p47).
  //   Weapon Mastery: 3, 4 at 4, 5 at 10, 6 at 16 (table column).
  //   Second Wind: 2, 3 at 4, 4 at 10 (table column).
  //   Action Surge: 1 use from 2, 2 uses at 17 (p48).
  //   Indomitable: 1 use from 9, 2 at 13, 3 at 17 (p48).
  //   Extra Attack: 2 attacks at 5, 3 at 11, 4 at 20 (p48, p49).
  //   Improved Critical 19 at 3, Superior Critical 18 at 15 (p49).
  const at = (level: number) => {
    const entity = autofill(character({ level }), { rules: "2024", seed: level });
    return evaluate(entity, { rules: "2024" });
  };
  const featureNames = (built: ReturnType<typeof build>["built"], level: number) =>
    built.features.filter((f) => f.level === level && f.source.startsWith("srd52:")).map((f) => f.name);

  for (let level = 1; level <= 20; level++) {
    it(`builds level ${level} with no open selection and no problem`, () => {
      const { built, selections, problems } = at(level);
      expect(problems).toEqual([]);
      expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
      expect(built.classLevels).toEqual({ "srd52:fighter": level });
      expect(built.subclasses).toEqual(level >= 3 ? { "srd52:fighter": "srd52:champion" } : {});
      expect(built.proficiencyBonus).toBe(
        stepAt(level, [
          [1, 2],
          [5, 3],
          [9, 4],
          [13, 5],
          [17, 6],
        ]),
      );
      expect(built.weaponMasteries).toHaveLength(
        stepAt(level, [
          [1, 3],
          [4, 4],
          [10, 5],
          [16, 6],
        ]) ?? 0,
      );
      expect(feature(built, "Second Wind")?.uses?.amount).toBe(
        stepAt(level, [
          [1, 2],
          [4, 3],
          [10, 4],
        ]),
      );
      expect(feature(built, "Action Surge")?.uses?.amount).toBe(
        stepAt(level, [
          [2, 1],
          [17, 2],
        ]),
      );
      expect(feature(built, "Indomitable")?.uses?.amount).toBe(
        stepAt(level, [
          [9, 1],
          [13, 2],
          [17, 3],
        ]),
      );
      expect(built.attacksPerAction).toBe(
        stepAt(level, [
          [1, 1],
          [5, 2],
          [11, 3],
          [20, 4],
        ]),
      );
      expect(built.criticalHitMinimum).toBe(
        stepAt(level, [
          [1, 20],
          [3, 19],
          [15, 18],
        ]),
      );
    });
  }

  it("has the features of the table at each level", () => {
    const built = at(20).built;
    expect([...Array(20).keys()].map((i) => featureNames(built, i + 1))).toEqual([
      ["Fighting Style", "Second Wind", "Weapon Mastery"],
      ["Action Surge", "Tactical Mind"],
      ["Fighter Subclass", "Improved Critical", "Remarkable Athlete"],
      ["Ability Score Improvement"],
      ["Extra Attack", "Tactical Shift"],
      [],
      ["Additional Fighting Style"],
      [],
      ["Indomitable", "Tactical Master"],
      ["Heroic Warrior"],
      ["Two Extra Attacks"],
      [],
      ["Studied Attacks"],
      [],
      ["Superior Critical"],
      [],
      [],
      ["Survivor"],
      ["Epic Boon"],
      ["Three Extra Attacks"],
    ]);
  });

  it("offers a feat at each Ability Score Improvement level and the Epic Boon at 19", () => {
    const { selections } = at(20);
    const names = (level: number) =>
      selections.filter((s) => s.path.slice(0, 4).join("/") === `class/srd52:fighter/levels/level-${level}` && s.path.length === 5).map((s) => s.name);
    for (const level of [4, 6, 8, 12, 14, 16]) expect(names(level)).toContain("Ability Score Improvement");
    expect(names(19)).toEqual(["Epic Boon"]);
  });

  it("offers the Additional Fighting Style from level 7 only", () => {
    const additional = (entity: Entity2024) => evaluate(entity, { rules: "2024" }).selections.find((s) => s.name === "Additional Fighting Style");
    expect(additional(character({ level: 6 }))).toBeUndefined();
    expect(additional(character({ level: 7 }))).toMatchObject({ min: 1, remaining: 1 });
  });

  it("reports the Additional Fighting Style and gives nothing from it when the class level goes below 7", () => {
    const seven = character({ level: 7 });
    const path = evaluate(seven, { rules: "2024" }).selections.find((s) => s.name === "Additional Fighting Style")?.actualPath ?? [];
    const archery = select(seven, path, "srd52:archery");
    const longbow = (entity: Entity2024) => attack(evaluate(entity, { rules: "2024" }).built, "srd52:longbow")?.attackBonus;
    // Longbow at level 7: Dex +1, PB +3 = +4. Archery: +2 = +6 (p87).
    expect(longbow(seven)).toBe(4);
    expect(longbow(archery)).toBe(6);
    const six = removeLevel(archery, "srd52:fighter");
    // The choice stays in the entity under the level 3 subclass. At level 6 it gives no bonus, and it is a problem.
    expect(longbow(six)).toBe(4);
    expect(evaluate(six, { rules: "2024" }).problems.map((p) => p.path.join("/"))).toEqual([[...path, "srd52:archery"].join("/")]);
  });
});

describe("the background's ability score choice", () => {
  it("can add 1 to all three abilities", () => {
    // Str 15 + 1, Dex 13 + 1, Con 14 + 1.
    const { built, selections } = build({ level: 1, backgroundAbilities: { key: "three-ones" } });
    expect(built.abilities).toMatchObject({ str: 16, dex: 14, con: 15 });
    expect(selections.map((s) => s.key)).not.toContain("plus-two");
  });

  it("does not raise a score above 20", () => {
    // Str 19 + 2 stops at 20.
    const { built } = build({ level: 1, scores: { str: 19, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } });
    expect(built.abilities.str).toBe(20);
  });

  it("asks for the +1 when only the +2 is chosen", () => {
    const { selections } = build({ level: 1, backgroundAbilities: { key: "two-and-one", selections: [{ key: "plus-two", option: { key: "dex" } }] } });
    expect(selections.find((s) => s.key === "plus-one")?.remaining).toBe(1);
  });
});

describe("feats", () => {
  it("adds 2 to Ranged weapon attacks with Archery, and Defense is then absent", () => {
    const { built } = build({ level: 1, fightingStyle: "srd52:archery" });
    // Longbow: Dex +1 + PB 2 + Archery 2 = +5. The Greatsword does not change.
    expect(attack(built, "srd52:longbow")?.attackBonus).toBe(5);
    expect(attack(built, "srd52:greatsword")?.attackBonus).toBe(5);
    // Chain Mail 16 without Defense.
    expect(built.armorClass).toBe(16);
  });

  it("gives the Defense bonus only with armor", () => {
    const { built } = build({ level: 1, armor: null });
    expect(built.unarmoredArmorClass).toBe(11);
    expect(built.wornArmor).toBeNull();
    expect(built.armorClass).toBe(11);
  });

  it("can add 2 to one ability with the Ability Score Improvement feat", () => {
    const plusTwoStr: StrictOption = {
      key: "srd52:ability-score-improvement",
      selections: [{ key: "increase", option: { key: "two", selections: [{ key: "ability", option: { key: "str" } }] } }],
    };
    // Str 17 + 2 = 19.
    expect(build({ level: 4, level4Feat: plusTwoStr }).built.abilities.str).toBe(19);
  });

  it("increases Strength or Dexterity by 1 with Grappler", () => {
    const grappler: StrictOption = { key: "srd52:grappler", selections: [{ key: "ability", option: { key: "dex" } }] };
    const { built } = build({ level: 4, level4Feat: grappler });
    // Dex 13 + 1 = 14, so the modifier is +2 and the Armor Class without armor is 12.
    expect(built.abilities.dex).toBe(14);
    expect(built.unarmoredArmorClass).toBe(12);
    // The 4 traits of the record, the increase among them.
    expect(built.features.filter((f) => f.source === "srd52:grappler")).toHaveLength(4);
  });

  it("offers a feat only when the character meets its prerequisites", () => {
    const anyFeat = featSelection(BUILT_IN, "Feat");
    const available = (level: number) => anyFeat.options.filter((o) => canChoose(o, buildCharacter(character({ level })))).map((o) => o.key);
    // Level 1: no General feat and no Epic Boon. Defense and Savage Attacker are taken, and neither is repeatable.
    // Magic Initiate and Skilled are repeatable.
    expect(available(1)).toEqual([
      "srd52:alert",
      "srd52:magic-initiate",
      "srd52:skilled",
      "srd52:archery",
      "srd52:great-weapon-fighting",
      "srd52:two-weapon-fighting",
    ]);
    // Level 3, before the level 4 choice: the same.
    expect(available(3)).toEqual(available(1));
    // Level 5: the General feats too. Ability Score Improvement is repeatable.
    expect(available(5)).toEqual([
      "srd52:alert",
      "srd52:magic-initiate",
      "srd52:skilled",
      "srd52:ability-score-improvement",
      "srd52:grappler",
      "srd52:archery",
      "srd52:great-weapon-fighting",
      "srd52:two-weapon-fighting",
    ]);
  });

  it("has the 17 SRD feats", () => {
    expect(recordsOf(BUILT_IN, "feats")).toHaveLength(17);
  });
});

describe("the facade", () => {
  it("refuses any edition but 2024", () => {
    // @ts-expect-error The type allows only "2024".
    expect(() => evaluate(character({ level: 1 }), { rules: "2014" })).toThrow("Unsupported rules edition: 2014");
  });

  it("takes no homebrew packs yet", () => {
    expect(() => evaluate(character({ level: 1 }), { rules: "2024", packs: [{} as ContentPack] })).toThrow("ORC-235");
    expect(evaluate(character({ level: 1 }), { rules: "2024", packs: [] }).built.name).toBe("Brunhild");
  });
});

describe("problems", () => {
  it("has none for the characters of this file", () => {
    for (const level of [1, 3, 5]) expect(build({ level }).problems).toEqual([]);
  });

  it("reports a choice that the template does not offer, which then gives nothing", () => {
    const entity = character({ level: 1 });
    const elf: Entity2024 = { ...entity, selections: entity.selections.map((s) => (s.key === "species" ? { key: "species", option: { key: "elf" } } : s)) };
    const { built, problems } = evaluate(elf, { rules: "2024" });
    expect(problems).toEqual([{ kind: "unknown-choice", path: ["species", "elf"], reason: '"elf" is not an option of "Species"' }]);
    expect(built.species).toBeNull();
    expect(built.darkvision).toBe(0);
  });

  it("reports a feat that the character took two times", () => {
    // Defense at level 1 and again at level 4. Defense is not repeatable, so neither choice is still valid.
    const { problems } = build({ level: 4, level4Feat: { key: "srd52:defense" } });
    expect(problems).toEqual([
      {
        kind: "prerequisite",
        path: ["class", "srd52:fighter", "levels", "level-1", "fighting-style", "srd52:defense"],
        reason: '"Defense" needs: Not taken already',
      },
      {
        kind: "prerequisite",
        path: ["class", "srd52:fighter", "levels", "level-4", "ability-score-improvement", "srd52:defense"],
        reason: '"Defense" needs: Not taken already',
      },
    ]);
  });
});

describe("contributions", () => {
  const { contributions } = build({ level: 1 });

  it("gives the Defense bonus to the Armor Class with its source", () => {
    // Chain Mail 16, then Defense +1.
    expect(contributions.armorClass).toEqual([
      { name: "Defense", source: ["class", "srd52:fighter", "levels", "level-1", "fighting-style", "srd52:defense"], from: 16, to: 17 },
    ]);
  });

  it("gives Dwarven Toughness to the Hit Points", () => {
    // Fighter level 1: 10, and Con +2: 12. Dwarven Toughness: +1.
    expect(contributions.maxHitPoints).toEqual([{ name: "Dwarven Toughness", source: ["species", "srd52:dwarf"], from: 12, to: 13 }]);
  });
});

describe("mutations", () => {
  const levelOne = character({ level: 1 });
  const hitPoints = (entity: Entity2024) => evaluate(entity, { rules: "2024" }).built.maxHitPoints;

  it("adds and removes a level", () => {
    const two = addLevel(levelOne, "srd52:fighter");
    expect(evaluate(two, { rules: "2024" }).built.classLevels).toEqual({ "srd52:fighter": 2 });
    // 13, then level 2: 6, Con +2, Dwarven Toughness +1.
    expect(hitPoints(two)).toBe(22);
    expect(hitPoints(removeLevel(two, "srd52:fighter"))).toBe(13);
    expect(() => removeLevel(levelOne, "srd52:fighter")).toThrow('"Levels" needs at least 1');
  });

  it("sets a rolled Hit Point number on a level", () => {
    // Level 2 rolled 10: 13 + 10 + 2 + 1.
    expect(hitPoints(setOptionValue(addLevel(levelOne, "srd52:fighter"), ["class", "srd52:fighter", "levels", "level-2"], 10))).toBe(26);
  });

  it("chooses and removes armor", () => {
    const plate = select(levelOne, ["armor"], "srd52:plate-armor");
    // Plate Armor 18, then Defense +1.
    expect(evaluate(plate, { rules: "2024" }).built.armorClass).toBe(19);
    expect(evaluate(deselect(plate, ["armor"], "srd52:plate-armor"), { rules: "2024" }).built.wornArmor).toBeNull();
  });

  it("sets the name", () => {
    expect(evaluate(setValue(levelOne, "name", "Hild"), { rules: "2024" }).built.name).toBe("Hild");
  });

  it("refuses a feat that the character cannot choose", () => {
    const four = character({ level: 4 });
    const slot = ["class", "srd52:fighter", "levels", "level-4", "ability-score-improvement"];
    // The Soldier gives Savage Attacker, and it is not repeatable.
    expect(() => select(four, slot, "srd52:savage-attacker")).toThrow('"Savage Attacker" needs: Not taken already');
    expect(() => select(levelOne, ["class", "srd52:fighter", "levels", "level-1", "fighting-style"], "srd52:alert")).toThrow(
      '"srd52:alert" is not an option of "Fighting Style"',
    );
    expect(evaluate(select(four, slot, "srd52:alert"), { rules: "2024" }).built.feats.map((f) => f.key)).toContain("srd52:alert");
  });
});

describe("autofill", () => {
  it("gives the same character for the same seed, with no open selection and no problem", () => {
    const first = autofill({ selections: [] }, { rules: "2024", seed: 42 });
    expect(autofill({ selections: [] }, { rules: "2024", seed: 42 })).toEqual(first);
    const { built, selections, problems } = evaluate(first, { rules: "2024" });
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
    expect(problems).toEqual([]);
    // One class at level 1. The class is any class of the template.
    expect(built.totalLevel).toBe(1);
    // The scores are the Standard Array in some order.
    expect(Object.values(built.baseAbilities).sort((a, b) => a - b)).toEqual([8, 10, 12, 13, 14, 15]);
  });

  it("keeps the choices that the character has", () => {
    const start: Entity2024 = { selections: [{ key: "languages", options: [{ key: "srd52:elvish" }, { key: "srd52:orc" }] }] };
    for (const seed of [1, 2, 3]) {
      const { built } = evaluate(autofill(start, { rules: "2024", seed }), { rules: "2024" });
      expect(built.languages).toEqual(["srd52:common", "srd52:elvish", "srd52:orc"]);
    }
  });
});
