// A test for each hook of the engine.

import { describe, expect, it } from "vitest";
import { buildWithContributions } from "../../core/build.ts";
import type { Entity2024 } from "../evaluate.ts";
import { loadContentPack } from "../packs.ts";
import { createTemplate } from "../template.ts";
import { testClass, testPackFile } from "../testing.ts";
import { HOOKS } from "./index.ts";

const unarmoredClass = (key: string, args: Record<string, unknown>) =>
  testClass(key, { armorTraining: ["light", "shield"], effects: [{ hook: "armor-class", args }] });

const pack = (classes: unknown[]) => loadContentPack(testPackFile({ classes }));

describe("armor-class", () => {
  const loaded = pack([
    unarmoredClass("brute", { name: "Unarmored Defense", base: 10, abilities: ["dex", "con"] }),
    unarmoredClass("sage", { name: "Calm Defense", base: 10, abilities: ["dex", "wis"], shield: false }),
  ]);
  if (!loaded.pack) throw new Error("the test pack does not load");
  const template = createTemplate({ packs: [loaded.pack] });

  // Dex 14: +2. Con 16: +3. Wis 12: +1.
  const build = (classKey: string, { armor, shield }: { armor?: string; shield?: boolean } = {}) => {
    const entity: Entity2024 = {
      selections: [
        { key: "ability-scores", option: { key: "manual", value: { str: 10, dex: 14, con: 16, int: 10, wis: 12, cha: 10 } } },
        { key: "class", options: [{ key: classKey, selections: [{ key: "levels", options: [{ key: "level-1" }] }] }] },
        ...(armor ? [{ key: "armor", option: { key: armor } }] : []),
        ...(shield ? [{ key: "shield", option: { key: "shield" } }] : []),
      ],
    };
    return buildWithContributions(entity, template);
  };

  it("is in the registry", () => {
    expect(HOOKS.has("armor-class")).toBe(true);
    expect(loaded.issues).toEqual([]);
  });

  it("gives the base Armor Class without armor when it is the best formula", () => {
    const { built, contributions } = build("test:brute");
    // 10 + Dex +2 + Con +3 = 15, more than 10 + Dex +2 = 12.
    expect(built.armorClass).toBe(15);
    expect(built.unarmoredArmorClass).toBe(15);
    expect(built.armorClassFormula).toBe("test:brute/unarmored-defense");
    expect(contributions.baseArmorClass).toEqual([{ name: "Unarmored Defense", source: ["class", "test:brute"], from: 0, to: 15 }]);
  });

  it("keeps a formula with a Shield when the formula allows one", () => {
    // 15 + Shield 2.
    expect(build("test:brute", { shield: true }).built.armorClass).toBe(17);
  });

  it("does not apply with armor", () => {
    // Leather Armor: 11 + Dex +2.
    const { built } = build("test:brute", { armor: "leather-armor" });
    expect(built.armorClass).toBe(13);
    expect(built.armorClassFormula).toBe("armor");
  });

  it("does not apply with a Shield when the formula does not allow one", () => {
    // 10 + Dex +2 + Wis +1 = 13.
    expect(build("test:sage").built.armorClass).toBe(13);
    // With a Shield: the base 10 + Dex +2 = 12, then the Shield +2.
    const { built } = build("test:sage", { shield: true });
    expect(built.armorClassFormula).toBe("unarmored");
    expect(built.armorClass).toBe(14);
  });

  it("takes the first formula on a tie", () => {
    // Dex 14, Con 10: 10 + 2 + 0 = 12, the same as the base calculation.
    const entity: Entity2024 = {
      selections: [
        { key: "ability-scores", option: { key: "manual", value: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } } },
        { key: "class", options: [{ key: "test:brute", selections: [{ key: "levels", options: [{ key: "level-1" }] }] }] },
      ],
    };
    expect(buildWithContributions(entity, template).built.armorClassFormula).toBe("unarmored");
  });

  it("refuses arguments that are not valid, so the record loads without its effects", () => {
    const { issues } = pack([unarmoredClass("bad", { name: "Bad", base: "ten" })]);
    expect(issues).toEqual([
      { path: ["classes", 0, "effects", 0, "args"], message: expect.stringContaining("so the record loads without its effects"), dropped: "effects" },
    ]);
  });
});

/** A species of a test pack with one effect, at a character level. */
function speciesWith(effect: unknown) {
  const loaded = loadContentPack(
    testPackFile({
      classes: [testClass("plain")],
      species: [{ key: "thing", name: "Thing", creatureType: "humanoid", size: "medium", speed: 30, effects: [effect] }],
    }),
  );
  const template = loaded.pack && createTemplate({ packs: [loaded.pack] });
  const build = (level: number, speciesSelections: Entity2024["selections"] = []) =>
    template &&
    buildWithContributions(
      {
        selections: [
          { key: "ability-scores", option: { key: "manual", value: { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 } } },
          {
            key: "class",
            options: [{ key: "test:plain", selections: [{ key: "levels", options: Array.from({ length: level }, (_, i) => ({ key: `level-${i + 1}` })) }] }],
          },
          { key: "species", option: { key: "test:thing", selections: speciesSelections } },
        ],
      },
      template,
    ).built;
  return { issues: loaded.issues, build };
}

describe("always-prepared-spells", () => {
  const spells = [
    { spell: "test:light" },
    { spell: "test:shield", level: 3, uses: { amount: "proficiency-bonus", recover: [{ on: "long-rest", amount: "all" }] } },
  ];

  it("gives each spell from its character level, with one ability and no choice", () => {
    const { issues, build } = speciesWith({ hook: "always-prepared-spells", args: { abilities: ["wis"], spells } });
    expect(issues).toEqual([]);
    expect(build(1)?.spells).toEqual([{ spell: "test:light", source: "test:thing", ability: "wis" }]);
    // Level 3: the PB is +2, so two casts without a slot. Level 5: +3.
    expect(build(3)?.spells[1]).toEqual({
      spell: "test:shield",
      source: "test:thing",
      ability: "wis",
      uses: { amount: 2, recover: [{ on: "long-rest", amount: "all" }] },
    });
    expect(build(5)?.spells[1].uses?.amount).toBe(3);
  });

  it("opens the ability choice for more than one ability", () => {
    const { build } = speciesWith({ hook: "always-prepared-spells", args: { abilities: ["int", "cha"], spells } });
    expect(build(1)?.spells).toEqual([]);
    expect(build(1, [{ key: "spellcasting-ability", option: { key: "cha" } }])?.spells.map((s) => s.ability)).toEqual(["cha"]);
  });

  it("refuses an empty list", () => {
    expect(speciesWith({ hook: "always-prepared-spells", args: { abilities: [], spells } }).issues.map((i) => i.dropped)).toEqual(["effects"]);
  });
});

describe("saving-throw-attack", () => {
  const args = {
    name: "Spit",
    save: "con",
    dcAbility: "con",
    die: 6,
    dice: [
      [1, 1],
      [5, 3],
    ],
    damageType: "test:acid",
  };

  it("gives the DC and the dice of the character level", () => {
    const { issues, build } = speciesWith({ hook: "saving-throw-attack", args });
    expect(issues).toEqual([]);
    // DC 8 + Con +2 + PB +2 = 12, and 1d6.
    expect(build(1)?.savingThrowAttacks).toEqual([
      { key: "test:thing/spit", name: "Spit", source: "test:thing", save: "con", dc: 12, damage: "1d6", damageType: "test:acid" },
    ]);
    // Level 5: PB +3, so DC 13, and 3d6.
    expect(build(5)?.savingThrowAttacks[0]).toMatchObject({ dc: 13, damage: "3d6" });
  });

  it("refuses dice that do not start at level 1", () => {
    expect(speciesWith({ hook: "saving-throw-attack", args: { ...args, dice: [[5, 2]] } }).issues.map((i) => i.dropped)).toEqual(["effects"]);
  });
});

describe("ability-score-increase", () => {
  it("increases each ability of the list when the count is the whole list", () => {
    const { issues, build } = speciesWith({ hook: "ability-score-increase", args: { abilities: ["str", "con"], choose: 2, amount: 2, max: 30 } });
    expect(issues).toEqual([]);
    expect(build(1)?.abilityIncreases).toEqual([
      { ability: "str", amount: 2, max: 30, source: "test:thing" },
      { ability: "con", amount: 2, max: 30, source: "test:thing" },
    ]);
  });

  it("opens a choice of the abilities otherwise", () => {
    const { build } = speciesWith({ hook: "ability-score-increase", args: { abilities: ["str", "dex", "con"], choose: 2 } });
    expect(build(1)?.abilityIncreases).toEqual([]);
    // Con 14 + 1 = 15.
    expect(build(1, [{ key: "abilities", options: [{ key: "dex" }, { key: "con" }] }])?.abilities).toMatchObject({ dex: 11, con: 15 });
  });

  it("refuses a count above the number of abilities, and a cap above 30", () => {
    expect(speciesWith({ hook: "ability-score-increase", args: { abilities: ["str"], choose: 2 } }).issues.map((i) => i.dropped)).toEqual(["effects"]);
    expect(speciesWith({ hook: "ability-score-increase", args: { max: 31 } }).issues.map((i) => i.dropped)).toEqual(["effects"]);
  });
});

describe("feat-choice", () => {
  const feats = [
    { key: "keen", name: "Keen", category: "origin", repeatable: false },
    { key: "tough", name: "Tough", category: "general", repeatable: false },
  ];
  const withFeats = (args: unknown) =>
    loadContentPack(
      testPackFile({
        classes: [testClass("plain")],
        feats,
        species: [{ key: "thing", name: "Thing", creatureType: "humanoid", size: "medium", speed: 30, effects: [{ hook: "feat-choice", args }] }],
      }),
    );

  it("offers the feats of the categories in the content", () => {
    const loaded = withFeats({ name: "Gift", categories: ["origin"] });
    expect(loaded.issues).toEqual([]);
    if (!loaded.pack) throw new Error("the test pack does not load");
    const thing = createTemplate({ packs: [loaded.pack] }).selections.find((s) => s.key === "species")?.options[0];
    expect(thing?.selections.map((s) => [s.key, s.options.map((o) => o.key)])).toEqual([["gift", ["test:keen"]]]);
  });

  it("refuses a feat that offers a choice of its own category, so the pack still loads", () => {
    const loaded = loadContentPack(
      testPackFile({
        classes: [testClass("plain")],
        feats: [
          ...feats,
          {
            key: "gifted",
            name: "Gifted",
            category: "origin",
            repeatable: false,
            effects: [{ hook: "feat-choice", args: { name: "Gift", categories: ["origin"] } }],
          },
        ],
      }),
    );
    expect(loaded.issues).toEqual([
      {
        path: ["feats", 2, "effects", 0, "args"],
        message: "the feats offer each other in a loop: test:gifted > test:gifted, so the record loads without its effects",
        dropped: "effects",
      },
    ]);
  });

  it("refuses a category that does not exist", () => {
    expect(withFeats({ name: "Gift", categories: ["heroic"] }).issues.map((i) => i.dropped)).toEqual(["effects"]);
  });
});

// feats.test.ts has the choices of the hook through the Magic Initiate feat, and backgrounds.test.ts the list that a background fixes.
describe("magic-initiate", () => {
  it("refuses an empty list of spell lists", () => {
    expect(speciesWith({ hook: "magic-initiate", args: { lists: [] } }).issues.map((i) => i.dropped)).toEqual(["effects"]);
  });
});
