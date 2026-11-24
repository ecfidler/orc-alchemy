// The 2024 adapter (ORC-238) on the golden Fighter of the engine. The
// numbers come from the golden character, whose file has their arithmetic.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate } from "@orc-alchemy/engine";
import { GOLDEN_CHARACTERS } from "@orc-alchemy/engine/golden/characters";
import { describe, expect, test } from "vitest";
import { editionOf, loadSheet } from "./edition.ts";
import { recoveryTag, type Sheet } from "./sheet.ts";
import { toSheet2024 } from "./sheet-2024.ts";

const fighter = GOLDEN_CHARACTERS.find((character) => character.name.startsWith("Fighter"))!;
const sheetAt = (level: number): Sheet => {
  const check = fighter.checks.find((c) => c.level === level);
  if (!check) throw new Error(`No check at level ${level}`);
  return toSheet2024(evaluate(check.entity, { rules: "2024" }).built);
};
const feature = (sheet: Sheet, name: string) => sheet.features.traits.find((f) => f.name === name);

describe("toSheet2024, the golden Fighter at level 20", () => {
  const sheet = sheetAt(20);

  test("names the class, the subclass, the species and the background from the records", () => {
    expect(sheet.name).toBe("Brunhild");
    expect(sheet.classes).toEqual([{ key: "srd52:fighter", name: "Fighter", level: 20, hitDie: 10, subclass: "Champion" }]);
    expect(sheet.race).toBe("Dwarf");
    expect(sheet.background).toBe("Soldier");
    expect(sheet.totalLevel).toBe(20);
  });

  test("has the numbers of the golden character", () => {
    expect(sheet.abilities.find((a) => a.ability === "str")).toEqual({ ability: "str", score: 21, modifier: 5, save: 11, saveProficient: true });
    expect(sheet.proficiencyBonus).toBe(6);
    expect(sheet.maxHitPoints).toBe(244);
    expect(sheet.armorClass).toBe(17);
    expect(sheet.armorClassOptions).toEqual([{ armor: { key: "srd52:chain-mail", name: "Chain Mail" }, shield: null, ac: 17 }]);
    expect(sheet.passivePerception).toBe(18);
    expect(sheet.skills.find((s) => s.key === "athletics")).toMatchObject({ bonus: 11, proficient: true, expertise: false });
    expect(sheet.numberOfAttacks).toBe(4);
    expect(sheet.speeds).toEqual([{ feet: 30, label: null }]);
    expect(sheet.darkvision).toBe(120);
    expect(sheet.resistances).toEqual(["Poison"]);
    expect(sheet.languages).toEqual(["Common", "Dwarvish", "Giant"]);
  });

  test("gives each attack its damage dice and its mastery property", () => {
    expect(sheet.weaponAttacks).toEqual([
      {
        key: "srd52:greatsword",
        name: "Greatsword",
        attackBonus: 11,
        damageModifier: 5,
        offHandDamageModifier: null,
        proficient: true,
        damage: "2d6+5 Slashing",
        mastery: "Graze",
      },
      {
        key: "srd52:longbow",
        name: "Longbow",
        attackBonus: 10,
        damageModifier: 2,
        offHandDamageModifier: null,
        proficient: true,
        damage: "1d8+2 Piercing",
        mastery: "Slow",
      },
    ]);
  });

  test("gives the uses of a feature with each rest that gives them back", () => {
    // Second Wind: 4 uses at level 10 and up; one back on a Short Rest, all on a Long Rest (p47, p48).
    const secondWind = feature(sheet, "Second Wind")?.uses;
    expect(secondWind).toEqual({
      amount: 4,
      recharge: null,
      recover: [
        { rest: "Short rest", amount: 1 },
        { rest: "Long rest", amount: "all" },
      ],
    });
    expect(secondWind && recoveryTag(secondWind)).toBe("Short rest (1), Long rest");
    // Action Surge: 2 uses at level 17; all back on a Short or Long Rest (p48).
    expect(recoveryTag(feature(sheet, "Action Surge")?.uses ?? { amount: 0, recharge: null })).toBe("Short rest, Long rest");
    // Indomitable: 3 uses at level 17; all back on a Long Rest (p48). One rule that gives back all is the plain recharge.
    expect(feature(sheet, "Indomitable")?.uses).toEqual({ amount: 3, recharge: "Long rest" });
  });

  test("gives the category of the feat that gives a feature", () => {
    expect(feature(sheet, "Savage Attacker")?.category).toBe("Origin feat");
    expect(feature(sheet, "Archery")?.category).toBe("Fighting Style feat");
    expect(feature(sheet, "Punch and Grab")?.category).toBe("Grappler, General feat");
    expect(feature(sheet, "Second Wind")?.category).toBeUndefined();
    // The Ability Score Improvement feat, taken five times: its description, one feature each time.
    expect(sheet.features.traits.filter((f) => f.name === "Ability Score Improvement").map((f) => f.category)).toEqual([
      undefined,
      ...Array(5).fill("General feat"),
    ]);
  });

  test("lists the weapons, the armor and the gold", () => {
    expect(sheet.equipment.weapons.map((item) => item.name)).toEqual(["Greatsword", "Longbow"]);
    expect(sheet.equipment.armor).toEqual([{ key: "srd52:chain-mail", name: "Chain Mail", quantity: 1, equipped: true }]);
    // 155 GP from the Fighter and 50 GP from the Soldier (p47, p83).
    expect(sheet.equipment.treasure).toEqual([{ key: "gp", name: "Gp", quantity: 205, equipped: false }]);
    expect(sheet.spellcasting).toBeNull();
  });
});

describe("the edition of a character", () => {
  test("is 2014 without a rules tag, and the tag otherwise", () => {
    expect(editionOf({})).toBe("2014");
    expect(editionOf({ rules: "2014" })).toBe("2014");
    expect(editionOf({ rules: "2024" })).toBe("2024");
    expect(() => editionOf({ rules: "2030" })).toThrow("Unknown rules edition: 2030");
  });

  test("picks the 2024 engine for a 2024 character", async () => {
    const sheet = await loadSheet({ rules: "2024" }, fighter.checks[0].entity);
    expect(sheet.classes.map((c) => c.name)).toEqual(["Fighter"]);
    expect(sheet.maxHitPoints).toBe(13);
  });

  test("picks the 2014 engine without a tag", async () => {
    const entity = JSON.parse(readFileSync(join(import.meta.dirname, "ranger-20-evasion.strict.json"), "utf8"));
    const sheet = await loadSheet({}, entity);
    expect(sheet.classes.map((c) => [c.name, c.level])).toEqual([["Ranger", 20]]);
    expect(sheet.weaponAttacks.every((attack) => attack.damage === undefined)).toBe(true);
  });
});

describe("toSheet2024, the golden Monk at level 5 (ORC-251)", () => {
  const monk = GOLDEN_CHARACTERS.find((character) => character.name.startsWith("Monk"))!;
  const check = monk.checks.find((c) => c.level === 5)!;
  const sheet = toSheet2024(evaluate(check.entity, { rules: "2024" }).built);

  test("has proficiency with the Shortsword, which the class names by its key", () => {
    expect(sheet.weaponAttacks.find((a) => a.name === "Shortsword")).toMatchObject({ proficient: true, attackBonus: 7, damage: "1d8+4 Piercing" });
  });

  test("shows the Unarmed Strike of Martial Arts", () => {
    expect(sheet.weaponAttacks.find((a) => a.name === "Unarmed Strike")).toMatchObject({ proficient: true, attackBonus: 7, damage: "1d8+4 Bludgeoning" });
  });
});
