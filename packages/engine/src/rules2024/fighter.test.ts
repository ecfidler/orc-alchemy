// The 2024 Fighter slice with hand-checked values at levels 1, 3 and 5.
//
// The character: a Dwarf Soldier Fighter. Scores before increases, from the
// Standard Array: Str 15, Dex 13, Con 14, Int 8, Wis 12, Cha 10. The
// background gives Str +2 and Con +1. Each expected number below has its
// arithmetic in a comment, from the rules of SRD 5.2.1.

import { describe, expect, it } from "vitest";
import { canChoose } from "../core/build.ts";
import type { StrictOption } from "../core/entity.ts";
import { FEATS, featSelection } from "./content/feats.ts";
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
import { type Choices, fighterCharacter as character } from "./testing.ts";

const build = (choices: Choices) => evaluate(character(choices), { rules: "2024" });
const attack = (built: ReturnType<typeof build>["built"], weapon: string) => built.weaponAttacks.find((a) => a.weapon === weapon);
const feature = (built: ReturnType<typeof build>["built"], name: string) => built.features.find((f) => f.name === name);

describe("level 1", () => {
  const { built, selections } = build({ level: 1 });

  it("has the identity of the choices", () => {
    expect(built.name).toBe("Brunhild");
    expect(built.species).toBe("dwarf");
    expect(built.background).toBe("soldier");
    expect(built.classes).toEqual(["fighter"]);
    expect(built.classLevels).toEqual({ fighter: 1 });
    expect(built.hitDice).toEqual({ fighter: 10 });
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
    expect(built.toolProficiencies).toEqual(["dice"]);
    expect(built.languages).toEqual(["srd52:common", "srd52:dwarvish", "srd52:giant"]);
    expect(built.resistances).toEqual(["poison"]);
  });

  it("has Armor Class 17 in Chain Mail with the Defense feat", () => {
    // Without armor: 10 + Dex +1.
    expect(built.unarmoredArmorClass).toBe(11);
    // Chain Mail 16, no Dexterity. Defense: +1 while wearing armor.
    expect(built.wornArmor).toBe("chain-mail");
    expect(built.armorClass).toBe(17);
    expect(built.initiative).toBe(1);
  });

  it("has the Origin feat of the background and the Fighting Style feat", () => {
    expect(built.feats).toEqual([
      { key: "defense", name: "Defense", category: "fighting-style" },
      { key: "savage-attacker", name: "Savage Attacker", category: "origin" },
    ]);
  });

  it("attacks once, with the mastery of the chosen weapons only", () => {
    expect(built.attacksPerAction).toBe(1);
    expect(built.criticalHitMinimum).toBe(20);
    expect(built.weaponMasteries).toEqual(["greatsword", "longbow", "flail"]);
    // Greatsword: Str +3 + PB 2 = +5, and 2d6 + 3.
    expect(attack(built, "greatsword")).toEqual({
      weapon: "greatsword",
      name: "Greatsword",
      attackBonus: 5,
      damage: "2d6+3",
      damageType: "slashing",
      mastery: "graze",
    });
    // Longbow, a Ranged weapon: Dex +1 + PB 2 = +3, and 1d8 + 1.
    expect(attack(built, "longbow")).toMatchObject({ attackBonus: 3, damage: "1d8+1", mastery: "slow" });
    // Dagger, Finesse: the higher of Str +3 and Dex +1. Not a chosen mastery.
    expect(attack(built, "dagger")).toMatchObject({ attackBonus: 5, damage: "1d4+3", mastery: null });
  });

  it("has the level 1 features with their uses", () => {
    expect(built.features.map((f) => f.name)).toEqual([
      "Fighting Style",
      "Second Wind",
      "Weapon Mastery",
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
    expect(feature(built, "Second Wind")).toMatchObject({ key: "fighter/second-wind", source: "fighter", level: 1 });
  });

  it("has every selection filled", () => {
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
    expect(selections.map((s) => s.path.join("/"))).toEqual([
      "ability-scores",
      "class",
      "class/fighter/skill-proficiencies",
      "class/fighter/levels",
      "class/fighter/levels/level-1/fighting-style",
      "class/fighter/levels/level-1/weapon-mastery",
      "species",
      "background",
      "background/soldier/ability-scores",
      "background/soldier/ability-scores/two-and-one/plus-two",
      "background/soldier/ability-scores/two-and-one/plus-one",
      "background/soldier/gaming-set",
      "languages",
      "armor",
      "shield",
      "weapons",
    ]);
  });

  it("offers 3 Weapon Masteries from the 38 weapons", () => {
    expect(selections.find((s) => s.key === "weapon-mastery")).toEqual({
      key: "weapon-mastery",
      name: "Weapon Mastery",
      path: ["class", "fighter", "levels", "level-1", "weapon-mastery"],
      actualPath: ["weapon-mastery"],
      ref: ["weapon-mastery"],
      min: 3,
      max: 3,
      remaining: 0,
      optionCount: 38,
      selected: ["greatsword", "longbow", "flail"],
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
    expect(built.classLevels).toEqual({ fighter: 3 });
    expect(built.subclasses).toEqual({ fighter: "champion" });
    expect(built.criticalHitMinimum).toBe(19);
    expect(built.features.filter((f) => f.level === 3).map((f) => f.name)).toEqual(["Improved Critical", "Remarkable Athlete"]);
  });

  it("has Action Surge once and Second Wind twice", () => {
    expect(feature(built, "Action Surge")?.uses).toEqual({ amount: 1, recover: [{ on: "short-rest", amount: "all" }] });
    expect(feature(built, "Second Wind")?.uses?.amount).toBe(2);
    expect(feature(built, "Tactical Mind")).toBeDefined();
  });

  it("keeps the level 1 numbers that level 3 does not change", () => {
    expect(built.proficiencyBonus).toBe(2);
    expect(built.attacksPerAction).toBe(1);
    expect(built.armorClass).toBe(17);
    expect(built.abilities.str).toBe(17);
    expect(attack(built, "greatsword")?.attackBonus).toBe(5);
  });

  it("offers the subclass at level 3, and has no selection left to fill", () => {
    expect(selections.find((s) => s.key === "subclass")).toMatchObject({ path: ["class", "fighter", "levels", "level-3", "subclass"], selected: ["champion"] });
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
  });
});

describe("level 5", () => {
  const { built, selections } = build({ level: 5 });

  it("has the level 4 Ability Score Improvement in the scores", () => {
    // Str 17 + 1 = 18. Con 15 + 1 = 16.
    expect(built.abilities).toEqual({ str: 18, dex: 13, con: 16, int: 8, wis: 12, cha: 10 });
    expect(built.abilityModifiers).toMatchObject({ str: 4, con: 3 });
    expect(built.feats.map((f) => f.key)).toEqual(["defense", "ability-score-improvement", "savage-attacker"]);
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
    expect(attack(built, "greatsword")).toMatchObject({ attackBonus: 7, damage: "2d6+4", mastery: "graze" });
    // Longbow: Dex +1 + PB 3 = +4.
    expect(attack(built, "longbow")).toMatchObject({ attackBonus: 4, damage: "1d8+1", mastery: "slow" });
    // Dagger: Str +4 + PB 3 = +7. It is the fourth mastery, chosen at level 4.
    expect(attack(built, "dagger")).toMatchObject({ attackBonus: 7, damage: "1d4+4", mastery: "nick" });
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
    expect(built.wornArmor).toBe("chain-mail");
    expect(built.armorClass).toBe(17);
  });

  it("pools the Weapon Mastery choices of levels 1 and 4 into 4", () => {
    const pools = selections.filter((s) => s.key === "weapon-mastery");
    expect(pools).toHaveLength(1);
    expect(pools[0]).toMatchObject({ min: 4, max: 4, remaining: 0, selected: ["greatsword", "longbow", "flail", "dagger"] });
    expect(selections.filter((s) => s.remaining !== 0)).toEqual([]);
  });

  it("reports one Weapon Mastery to choose when level 4 added none", () => {
    const three = build({ level: 5, masteries: ["greatsword", "longbow", "flail"] });
    expect(three.selections.find((s) => s.key === "weapon-mastery")?.remaining).toBe(1);
    expect(attack(three.built, "dagger")?.mastery).toBeNull();
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
    const { built } = build({ level: 1, fightingStyle: "archery" });
    // Longbow: Dex +1 + PB 2 + Archery 2 = +5. The Greatsword does not change.
    expect(attack(built, "longbow")?.attackBonus).toBe(5);
    expect(attack(built, "greatsword")?.attackBonus).toBe(5);
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
      key: "ability-score-improvement",
      selections: [{ key: "increase", option: { key: "two", selections: [{ key: "ability", option: { key: "str" } }] } }],
    };
    // Str 17 + 2 = 19.
    expect(build({ level: 4, level4Feat: plusTwoStr }).built.abilities.str).toBe(19);
  });

  it("increases Strength or Dexterity by 1 with Grappler", () => {
    const grappler: StrictOption = { key: "grappler", selections: [{ key: "ability", option: { key: "dex" } }] };
    const { built } = build({ level: 4, level4Feat: grappler });
    // Dex 13 + 1 = 14, so the modifier is +2 and the Armor Class without armor is 12.
    expect(built.abilities.dex).toBe(14);
    expect(built.unarmoredArmorClass).toBe(12);
    expect(built.features.filter((f) => f.source === "grappler")).toHaveLength(3);
  });

  it("offers a feat only when the character meets its prerequisites", () => {
    const anyFeat = featSelection("Feat");
    const available = (level: number) => anyFeat.options.filter((o) => canChoose(o, buildCharacter(character({ level })))).map((o) => o.key);
    // Level 1: no General feat. Defense and Savage Attacker are taken, and neither is repeatable.
    expect(available(1)).toEqual(["alert", "archery", "great-weapon-fighting", "two-weapon-fighting"]);
    // Level 3, before the level 4 choice: the same.
    expect(available(3)).toEqual(available(1));
    // Level 5: the General feats too. Ability Score Improvement is repeatable.
    expect(available(5)).toEqual(["alert", "ability-score-improvement", "grappler", "archery", "great-weapon-fighting", "two-weapon-fighting"]);
  });

  it("has 8 of the 17 SRD feats", () => {
    expect(FEATS).toHaveLength(8);
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
    const { problems } = build({ level: 4, level4Feat: { key: "defense" } });
    expect(problems).toEqual([
      { kind: "prerequisite", path: ["class", "fighter", "levels", "level-1", "fighting-style", "defense"], reason: '"Defense" needs: Not taken already' },
      {
        kind: "prerequisite",
        path: ["class", "fighter", "levels", "level-4", "ability-score-improvement", "defense"],
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
      { name: "Defense", source: ["class", "fighter", "levels", "level-1", "fighting-style", "defense"], from: 16, to: 17 },
    ]);
  });

  it("gives Dwarven Toughness to the Hit Points", () => {
    // Fighter level 1: 10, and Con +2: 12. Dwarven Toughness: +1.
    expect(contributions.maxHitPoints).toEqual([{ name: "Dwarven Toughness", source: ["species", "dwarf"], from: 12, to: 13 }]);
  });
});

describe("mutations", () => {
  const levelOne = character({ level: 1 });
  const hitPoints = (entity: Entity2024) => evaluate(entity, { rules: "2024" }).built.maxHitPoints;

  it("adds and removes a level", () => {
    const two = addLevel(levelOne, "fighter");
    expect(evaluate(two, { rules: "2024" }).built.classLevels).toEqual({ fighter: 2 });
    // 13, then level 2: 6, Con +2, Dwarven Toughness +1.
    expect(hitPoints(two)).toBe(22);
    expect(hitPoints(removeLevel(two, "fighter"))).toBe(13);
    expect(() => removeLevel(levelOne, "fighter")).toThrow('"Levels" needs at least 1');
  });

  it("sets a rolled Hit Point number on a level", () => {
    // Level 2 rolled 10: 13 + 10 + 2 + 1.
    expect(hitPoints(setOptionValue(addLevel(levelOne, "fighter"), ["class", "fighter", "levels", "level-2"], 10))).toBe(26);
  });

  it("chooses and removes armor", () => {
    const plate = select(levelOne, ["armor"], "plate-armor");
    // Plate Armor 18, then Defense +1.
    expect(evaluate(plate, { rules: "2024" }).built.armorClass).toBe(19);
    expect(evaluate(deselect(plate, ["armor"], "plate-armor"), { rules: "2024" }).built.wornArmor).toBeNull();
  });

  it("sets the name", () => {
    expect(evaluate(setValue(levelOne, "name", "Hild"), { rules: "2024" }).built.name).toBe("Hild");
  });

  it("refuses a feat that the character cannot choose", () => {
    const four = character({ level: 4 });
    const slot = ["class", "fighter", "levels", "level-4", "ability-score-improvement"];
    // The Soldier gives Savage Attacker, and it is not repeatable.
    expect(() => select(four, slot, "savage-attacker")).toThrow('"Savage Attacker" needs: Not taken already');
    expect(() => select(levelOne, ["class", "fighter", "levels", "level-1", "fighting-style"], "alert")).toThrow(
      '"alert" is not an option of "Fighting Style"',
    );
    expect(evaluate(select(four, slot, "alert"), { rules: "2024" }).built.feats.map((f) => f.key)).toContain("alert");
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
