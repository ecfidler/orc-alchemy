// The equipment of SRD 5.2.1 (ORC-228), p89 to p103: the attack lines of
// the weapons that a character uses, Weapon Mastery, the armor and the
// Shield, the items that a character carries, and the starting equipment of
// each class and background. Each expected number has its arithmetic in a
// comment.

import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { buildWithContributions, findProblems } from "../core/build.ts";
import type { StrictOption, StrictSelection } from "../core/entity.ts";
import type { EquipmentItem } from "../format/schema.ts";
import { BUILT_IN, SRD52 } from "./built-in.ts";
import { recordsOf } from "./content.ts";
import type { Entity2024 } from "./evaluate.ts";
import { loadContentPack } from "./packs.ts";
import { createTemplate, template2024 } from "./template.ts";
import { fighterCharacter, testPackFile, twoAndOne } from "./testing.ts";

const srd = (key: string) => `srd52:${key}`;

function build(entity: Entity2024) {
  const { built } = buildWithContributions(entity, template2024);
  return { built, problems: findProblems(entity, built, template2024).map((p) => p.reason) };
}

const attack = (built: ReturnType<typeof build>["built"], weapon: string) => built.weaponAttacks.find((a) => a.weapon === srd(weapon));

/** A character of one class at level 1, with the given choices of the class and the top-level selections. */
function classCharacter(classKey: string, classSelections: StrictSelection[] = [], more: StrictSelection[] = []): Entity2024 {
  return {
    selections: [
      { key: "ability-scores", option: { key: "manual", value: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } } },
      {
        key: "class",
        options: [{ key: srd(classKey), selections: [{ key: "levels", options: [{ key: "level-1" }] }, ...classSelections] }],
      },
      ...more,
    ],
  };
}

describe("the attack line of a weapon", () => {
  // The Fighter: Str 15 + 2 = 17 (+3), Dex 13 (+1), Proficiency Bonus 2, with Simple and Martial weapons.
  const fighter = (weapons: string[], choices: Parameters<typeof fighterCharacter>[0] = { level: 1 }) =>
    build(
      fighterCharacter({
        masteries: ["rapier", "longbow", "longsword"].map(srd),
        ...choices,
        weapons: weapons.map(srd),
      }),
    ).built;

  it("uses the better of Strength and Dexterity for a Finesse weapon", () => {
    // Rapier, Finesse, 1d8 Piercing: Str +3 is better than Dex +1. +3 + PB 2 = +5, and 1d8 + 3.
    expect(attack(fighter(["rapier"]), "rapier")).toEqual({
      weapon: "srd52:rapier",
      name: "Rapier",
      attackBonus: 5,
      damage: "1d8+3",
      damageType: "srd52:piercing",
      properties: ["finesse"],
      mastery: "vex",
      disadvantage: false,
    });
    // Str 8 + 2 = 10 (+0) and Dex 15 (+2): Dex +2 + PB 2 = +4 for the Rapier, and Str +0 + PB 2 = +2 for the Greatsword.
    const nimble = fighter(["rapier", "greatsword"], { level: 1, scores: { str: 8, dex: 15, con: 14, int: 10, wis: 13, cha: 12 } });
    expect(attack(nimble, "rapier")).toMatchObject({ attackBonus: 4, damage: "1d8+2" });
    expect(attack(nimble, "greatsword")).toMatchObject({ attackBonus: 2, damage: "2d6" });
  });

  it("uses Finesse for the Dart, a Ranged weapon with Finesse", () => {
    // Dart, 1d4 Piercing: Str +3 is better than Dex +1. +3 + PB 2 = +5, and 1d4 + 3. Range 20/60 feet.
    expect(attack(fighter(["dart"]), "dart")).toMatchObject({ attackBonus: 5, damage: "1d4+3", range: [20, 60] });
  });

  it("marks Disadvantage for a Heavy weapon without the score 13", () => {
    // Str 17 and Dex 13: no Disadvantage with the Greatsword (Melee) or the Longbow (Ranged).
    const strong = fighter(["greatsword", "longbow"]);
    expect([attack(strong, "greatsword")?.disadvantage, attack(strong, "longbow")?.disadvantage]).toEqual([false, false]);
    // Str 8 + 2 = 10 and Dex 15: Disadvantage with the Greatsword only (SRD 5.2.1 p89).
    const nimble = fighter(["greatsword", "longbow"], { level: 1, scores: { str: 8, dex: 15, con: 14, int: 10, wis: 13, cha: 12 } });
    expect([attack(nimble, "greatsword")?.disadvantage, attack(nimble, "longbow")?.disadvantage]).toEqual([true, false]);
  });

  it("uses Dexterity for a Ranged weapon, with its range", () => {
    // Longbow: Dex +1 + PB 2 = +3, and 1d8 + 1. Range 150/600 feet.
    expect(attack(fighter(["longbow"]), "longbow")).toEqual({
      weapon: "srd52:longbow",
      name: "Longbow",
      attackBonus: 3,
      damage: "1d8+1",
      damageType: "srd52:piercing",
      properties: ["ammunition", "heavy", "two-handed"],
      range: [150, 600],
      mastery: "slow",
      disadvantage: false,
    });
  });

  it("gives the two-handed damage of a Versatile weapon", () => {
    // Longsword, 1d8 Slashing, Versatile (1d10): Str +3 + PB 2 = +5. 1d8 + 3 with one hand, 1d10 + 3 with two.
    expect(attack(fighter(["longsword"]), "longsword")).toEqual({
      weapon: "srd52:longsword",
      name: "Longsword",
      attackBonus: 5,
      damage: "1d8+3",
      versatileDamage: "1d10+3",
      damageType: "srd52:slashing",
      properties: ["versatile"],
      mastery: "sap",
      disadvantage: false,
    });
  });

  it("subtracts a negative modifier from the damage", () => {
    // Str 8 (-1), as the Soldier puts +2 on Dex and +1 on Con: -1 + PB 2 = +1, and 2d6 - 1.
    const weak = fighter(["greatsword"], {
      level: 1,
      scores: { str: 8, dex: 15, con: 14, int: 10, wis: 13, cha: 12 },
      backgroundAbilities: twoAndOne("dex", "con"),
    });
    expect(attack(weak, "greatsword")).toMatchObject({ attackBonus: 1, damage: "2d6-1" });
  });

  it("adds the Proficiency Bonus only with proficiency, by category or by weapon", () => {
    // A Wizard has Simple weapons only. Str 8 (-1), Dex 14 (+2).
    const wizard = build(classCharacter("wizard", [], [{ key: "weapons", options: [{ key: srd("longsword") }, { key: srd("dagger") }] }])).built;
    // Longsword, Martial: -1 and no PB.
    expect(attack(wizard, "longsword")?.attackBonus).toBe(-1);
    // Dagger, Simple and Finesse: Dex +2 + PB 2 = +4.
    expect(attack(wizard, "dagger")?.attackBonus).toBe(4);
    // A Rogue has the Martial weapons with Finesse or Light by name, as the Rapier, and not the Longsword (SRD 5.2.1 p62). Dex +2 + PB 2 = +4.
    const rogue = build(classCharacter("rogue", [], [{ key: "weapons", options: [{ key: srd("rapier") }, { key: srd("longsword") }] }])).built;
    expect(attack(rogue, "rapier")?.attackBonus).toBe(4);
    expect(attack(rogue, "longsword")?.attackBonus).toBe(-1);
  });
});

describe("Weapon Mastery", () => {
  it("shows the mastery property only for the weapons of the chosen kinds", () => {
    const { built } = build(fighterCharacter({ level: 1, masteries: ["greatsword", "longbow", "flail"].map(srd), weapons: ["greatsword", "dagger"].map(srd) }));
    expect(attack(built, "greatsword")?.mastery).toBe("graze");
    expect(attack(built, "dagger")?.mastery).toBeNull();
  });

  it("offers the weapons of the records, with the mastery of docs/kb/srd-5.2-rules-delta.md §B9", () => {
    const byMastery: Record<string, string[]> = {};
    for (const { record } of recordsOf(BUILT_IN, "equipment")) if (record.weapon) (byMastery[record.weapon.mastery] ??= []).push(record.name);
    for (const names of Object.values(byMastery)) names.sort();
    expect(byMastery).toEqual({
      cleave: ["Greataxe", "Halberd"],
      graze: ["Glaive", "Greatsword"],
      nick: ["Dagger", "Light Hammer", "Scimitar", "Sickle"],
      push: ["Greatclub", "Heavy Crossbow", "Pike", "Warhammer"],
      sap: ["Flail", "Longsword", "Mace", "Morningstar", "Spear", "War Pick"],
      slow: ["Club", "Javelin", "Light Crossbow", "Longbow", "Musket", "Sling", "Whip"],
      topple: ["Battleaxe", "Lance", "Maul", "Quarterstaff", "Trident"],
      vex: ["Blowgun", "Dart", "Hand Crossbow", "Handaxe", "Pistol", "Rapier", "Shortbow", "Shortsword"],
    });
  });
});

describe("armor", () => {
  it("puts the row of the armor table on the sheet", () => {
    const { built } = build(fighterCharacter({ level: 1, armor: srd("chain-mail") }));
    expect(built.wornArmorStats).toEqual({
      key: "srd52:chain-mail",
      name: "Chain Mail",
      category: "heavy",
      base: 16,
      dexLimit: 0,
      strength: 13,
      stealthDisadvantage: true,
    });
    // Chain Mail gives Disadvantage on Dexterity (Stealth) checks (SRD 5.2.1 p92).
    expect(built.stealthDisadvantage).toBe(true);
    expect(build(fighterCharacter({ level: 1, armor: srd("leather-armor") })).built.stealthDisadvantage).toBe(false);
    expect(build(fighterCharacter({ level: 1, armor: null })).built).toMatchObject({ wornArmorStats: null, stealthDisadvantage: false });
  });

  it("takes 10 feet of Speed without the Strength score of the armor", () => {
    // The Dwarf has Speed 30. Str 15 + 2 = 17: Plate Armor needs 15.
    expect(build(fighterCharacter({ level: 1, armor: srd("plate-armor") })).built.speed).toBe(30);
    // Str 13, as the Soldier puts +2 on Con and +1 on Dex: 30 - 10 = 20. Chain Mail needs only 13.
    const weak = (armor: string) =>
      build(
        fighterCharacter({
          level: 1,
          armor: srd(armor),
          scores: { str: 13, dex: 15, con: 14, int: 10, wis: 12, cha: 8 },
          backgroundAbilities: twoAndOne("con", "dex"),
        }),
      ).built.speed;
    expect(weak("plate-armor")).toBe(20);
    expect(weak("chain-mail")).toBe(30);
  });
});

describe("carried items", () => {
  it("carries each chosen item, with the value of the option as the quantity", () => {
    const { built } = build(classCharacter("wizard", [], [{ key: "equipment", options: [{ key: srd("rope") }, { key: srd("torch"), value: 10 }] }]));
    expect(built.inventory).toEqual([
      { item: "srd52:rope", quantity: 1 },
      { item: "srd52:torch", quantity: 10 },
    ]);
  });
});

describe("starting equipment", () => {
  // The gold of each option, A first (SRD 5.2.1 p28 to p78 for the classes, p83 for the backgrounds).
  const GOLD: Record<string, number[]> = {
    "srd52:barbarian": [15, 75],
    "srd52:bard": [19, 90],
    "srd52:cleric": [7, 110],
    "srd52:druid": [9, 50],
    "srd52:fighter": [4, 11, 155],
    "srd52:monk": [11, 50],
    "srd52:paladin": [9, 150],
    "srd52:ranger": [7, 150],
    "srd52:rogue": [8, 100],
    "srd52:sorcerer": [28, 50],
    "srd52:warlock": [15, 100],
    "srd52:wizard": [5, 55],
    "srd52:acolyte": [8, 50],
    "srd52:criminal": [16, 50],
    "srd52:sage": [8, 50],
    "srd52:soldier": [14, 50],
  };

  const firstOf = (category: string) => recordsOf(BUILT_IN, "equipment").find(({ record }) => record.category === category)?.reference ?? "";

  /** The choices that an option needs: the first item of each category. */
  const categoryChoices = (items: readonly z.infer<typeof EquipmentItem>[]): StrictSelection[] =>
    items.flatMap(({ item }) => (typeof item === "object" && "category" in item ? [{ key: item.category, option: { key: firstOf(item.category) } }] : []));

  /** The inventory that an option lists. A `{ chosen }` item is the tool `tool`. */
  const listed = (reference: string, items: readonly z.infer<typeof EquipmentItem>[], tool: string) =>
    items.map(({ item, quantity }) => ({
      item: typeof item === "string" ? item : "category" in item ? firstOf(item.category) : tool,
      quantity,
      source: reference,
    }));

  const byItem = (a: { item: string }, b: { item: string }) => a.item.localeCompare(b.item);

  const packages = [
    ...recordsOf(BUILT_IN, "classes").map(({ reference, record }) => ({ reference, kind: "class" as const, record })),
    ...recordsOf(BUILT_IN, "backgrounds").map(({ reference, record }) => ({ reference, kind: "background" as const, record })),
  ];

  it("has the gold of the SRD for each class and background", () => {
    expect(Object.fromEntries(packages.map(({ reference, record }) => [reference, (record.startingEquipment ?? []).map((o) => o.gold)]))).toEqual(GOLD);
  });

  for (const { reference, kind, record } of packages) {
    it(`${record.name}: each option gives its items and its gold`, () => {
      const toolField = kind === "class" ? record.tools : record.tool;
      const toolChoice = typeof toolField === "object" && !Array.isArray(toolField) ? toolField : undefined;
      const tool = toolChoice ? (Array.isArray(toolChoice.from) ? toolChoice.from[0] : firstOf(toolChoice.from.category)) : "";
      const toolSelections: StrictSelection[] = toolChoice ? [{ key: kind === "class" ? "tool-proficiencies" : "tool", options: [{ key: tool }] }] : [];
      (record.startingEquipment ?? []).forEach((entry, i) => {
        const option: StrictOption = { key: "abc"[i], selections: categoryChoices(entry.items ?? []) };
        const choices = [...toolSelections, { key: "starting-equipment", option }];
        const entity =
          kind === "class"
            ? classCharacter(record.key, choices)
            : classCharacter("wizard", [], [{ key: "background", option: { key: reference, selections: choices } }]);
        const { built } = build(entity);
        const fromPackage = built.inventory.filter((item) => item.source === reference);
        expect(fromPackage.toSorted(byItem)).toEqual(listed(reference, entry.items ?? [], tool).toSorted(byItem));
        expect(built.gold).toBe(GOLD[reference][i]);
      });
    });
  }

  it("gives the Fighter option A of the SRD", () => {
    // SRD 5.2.1 p47: Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer's Pack, and 4 GP.
    const { built } = build(classCharacter("fighter", [{ key: "starting-equipment", option: { key: "a" } }]));
    expect(built.inventory).toEqual(
      [
        ["chain-mail", 1],
        ["greatsword", 1],
        ["flail", 1],
        ["javelin", 8],
        ["dungeoneer-pack", 1],
      ].map(([item, quantity]) => ({ item: srd(item as string), quantity, source: "srd52:fighter" })),
    );
    expect(built.gold).toBe(4);
  });

  it("offers a choice for an item of a category", () => {
    const { built } = build(
      classCharacter("cleric", [{ key: "starting-equipment", option: { key: "a", selections: [{ key: "holy-symbol", option: { key: srd("emblem") } }] } }]),
    );
    expect(built.inventory).toContainEqual({ item: "srd52:emblem", quantity: 1, source: "srd52:cleric" });
    const choice = template2024.selections
      .find((s) => s.key === "class")
      ?.options.find((o) => o.key === "srd52:cleric")
      ?.selections.find((s) => s.key === "starting-equipment")
      ?.options.find((o) => o.key === "a");
    expect(choice?.name).toBe("Chain Shirt, Shield, Mace, Holy Symbol, Priest's Pack, 7 GP");
    expect(choice?.selections.map((s) => [s.name, s.options.map((o) => o.key)])).toEqual([
      ["Holy Symbol", ["srd52:amulet", "srd52:emblem", "srd52:reliquary"]],
    ]);
  });

  it("gives each choice of the same category a key of its own", () => {
    const loaded = loadContentPack(
      testPackFile({
        backgrounds: [
          {
            key: "pilgrim",
            name: "Pilgrim",
            abilityScores: ["wis", "con", "cha"],
            feat: "srd52:alert",
            skills: ["insight", "religion"],
            tool: "srd52:calligraphers-supplies",
            startingEquipment: [
              {
                items: [
                  { item: { category: "holy-symbol" }, quantity: 1 },
                  { item: { category: "holy-symbol" }, quantity: 1 },
                ],
              },
            ],
          },
        ],
      }),
      { packs: [SRD52] },
    );
    expect(loaded.issues).toEqual([]);
    if (!loaded.pack) throw new Error("the test pack does not load");
    const template = createTemplate({ packs: [SRD52, loaded.pack] });
    const choices = template.selections
      .find((s) => s.key === "background")
      ?.options.find((o) => o.key === "test:pilgrim")
      ?.selections.find((s) => s.key === "starting-equipment")?.options[0].selections;
    expect(choices?.map((s) => [s.key, s.name])).toEqual([
      ["holy-symbol", "Holy Symbol"],
      ["holy-symbol-2", "Holy Symbol"],
    ]);
  });

  it("gives the tool that the Soldier chose", () => {
    const soldier = (tool: string) =>
      build(
        classCharacter(
          "wizard",
          [],
          [
            {
              key: "background",
              option: {
                key: srd("soldier"),
                selections: [
                  { key: "tool", option: { key: srd(tool) } },
                  { key: "starting-equipment", option: { key: "a" } },
                ],
              },
            },
          ],
        ),
      ).built;
    expect(soldier("playing-cards").inventory).toContainEqual({ item: "srd52:playing-cards", quantity: 1, source: "srd52:soldier" });
    expect(soldier("dice").inventory).toContainEqual({ item: "srd52:dice", quantity: 1, source: "srd52:soldier" });
    expect(soldier("dice").inventory.map((i) => i.item)).not.toContain("srd52:playing-cards");
  });

  it("is a choice of the first class only", () => {
    const entity: Entity2024 = {
      selections: [
        { key: "ability-scores", option: { key: "manual", value: { str: 13, dex: 14, con: 13, int: 15, wis: 12, cha: 10 } } },
        {
          key: "class",
          options: [
            {
              key: srd("rogue"),
              selections: [
                { key: "levels", options: [{ key: "level-1" }] },
                { key: "starting-equipment", option: { key: "b" } },
              ],
            },
            {
              key: srd("wizard"),
              selections: [
                { key: "levels", options: [{ key: "level-1" }] },
                { key: "starting-equipment", option: { key: "b" } },
              ],
            },
          ],
        },
      ],
    };
    const { built, problems } = build(entity);
    // The 100 GP of the Rogue. The 55 GP of the Wizard do not count.
    expect(built.gold).toBe(100);
    expect(problems).toContain('"Starting Equipment" is not offered: its prerequisite fails');
  });
});
