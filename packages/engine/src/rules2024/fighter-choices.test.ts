// The choices of the test Fighter: the background, the feats, the problems,
// the contributions, the mutations and autofill, and the facade.
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
import { weaponAttackOf as attack, buildFighter as build, fighterCharacter as character } from "./testing.ts";

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
