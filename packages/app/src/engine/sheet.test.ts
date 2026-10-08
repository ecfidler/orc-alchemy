import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { expect, test } from "vitest";
import { toSheet } from "./sheet.ts";

// expected.json is evaluate(strict).built, so these tests need no engine.
const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const builtOf = (name: string): Built2014 => readFixture(`${name}.expected.json`);

const srdGolden = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => readFixture(`${name}.meta.json`).orcbrew.length === 0);

test.each(srdGolden)("toSheet(%s) maps without throwing", (name) => {
  const sheet = toSheet(builtOf(name), {});
  expect(sheet.abilities).toHaveLength(6);
  expect(sheet.skills).toHaveLength(18);
});

test("fighter-20", () => {
  const built = builtOf("fighter-20");
  const sheet = toSheet(built, {});

  expect(sheet.name).toBe(built["character-name"]);
  expect(sheet.classes).toEqual([{ key: "fighter", name: "Fighter", level: 20, hitDie: 10, subclass: "Champion" }]);
  // Worn plate and a wielded shield.
  expect(sheet.armorClass).toBe(built["armor-class-with-armor"].find((o) => o.armor === "plate" && o.shield === "shield")!.ac);
  expect(sheet.armorClass).toBe(20);
  expect(sheet.armorClassOptions).toContainEqual({
    armor: { key: "chain-mail", name: "Chain Mail" },
    shield: null,
    ac: 16,
  });
  expect(sheet.maxHitPoints).toBe(built["max-hit-points"]);
  expect(sheet.proficiencyBonus).toBe(built["proficiency-bonus"]);
  expect(sheet.initiative).toBe(built.initiative);
  expect(sheet.passivePerception).toBe(built["passive-perception"]);
  expect(sheet.speeds).toEqual([{ feet: 30, label: null }]);

  expect(sheet.abilities.map((a) => a.ability)).toEqual(["str", "dex", "con", "int", "wis", "cha"]);
  for (const a of sheet.abilities) {
    const key = `orcpub.dnd.e5.character/${a.ability}` as const;
    expect(a).toEqual({
      ability: a.ability,
      score: built.abilities[key],
      modifier: built["ability-bonuses"][key],
      save: built["save-bonuses"][key],
      saveProficient: built["saving-throws"].includes(key),
    });
  }
  expect(sheet.abilities.filter((a) => a.saveProficient).map((a) => a.ability)).toEqual(["str", "con"]);

  const skill = (key: string) => sheet.skills.find((s) => s.key === key)!;
  expect(skill("athletics")).toEqual({
    key: "athletics",
    name: "Athletics",
    ability: "str",
    bonus: built["skill-bonuses"].athletics,
    proficient: true,
    expertise: false,
  });
  expect(skill("sleight-of-hand")).toMatchObject({ name: "Sleight of Hand", bonus: 6, proficient: false });
  expect(skill("religion")).toMatchObject({ proficient: true, bonus: 7 });
  expect(sheet.skills.map((s) => s.name)).toEqual([...sheet.skills.map((s) => s.name)].sort());

  expect(sheet.weaponAttacks).toEqual([
    { key: "handaxe", name: "Handaxe", attackBonus: 11, damageModifier: 5, offHandDamageModifier: 0, proficient: true },
    { key: "longsword", name: "Longsword", attackBonus: 11, damageModifier: 5, offHandDamageModifier: null, proficient: true },
    { key: "longsword-1", name: "Longsword 1", attackBonus: 12, damageModifier: 6, offHandDamageModifier: null, proficient: true },
  ]);
  expect(sheet.numberOfAttacks).toBe(4);

  expect(sheet.features.actions).toEqual([
    { name: "Action Surge", text: "Take an extra action (use twice/rest)." },
    { name: "Grappler", text: "Restrain a creature you are grappling." },
  ]);
  expect(sheet.features.bonusActions.map((f) => f.name)).toEqual(["Second Wind"]);
  expect(sheet.features.reactions.map((f) => f.name)).toEqual(["Protection Fighting Style"]);
  expect(sheet.features.traits.map((f) => f.name)).toEqual(
    built.traits.map((t) => t.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
  );

  expect(sheet.equipment.armor.map((i) => i.name)).toEqual(["Chain Mail", "Plate", "Shield"]);
  expect(sheet.equipment.magicItems.map((i) => i.key)).toEqual(["amulet-of-health", "longsword-1"]);
  expect(sheet.equipment.treasure).toEqual([{ key: "gp", name: "Gp", quantity: 15, equipped: true }]);
  expect(sheet.languages).toEqual(["Common", "Draconic", "Elvish"]);
  expect(sheet.weaponProficiencies).toEqual(["Simple", "Martial"]);
  expect(sheet.spellcasting).toBeNull();
  expect(sheet.xp).toBe(355000);
  expect(sheet.details.personalityTraits).toEqual([]);
  expect(sheet.details.ideals).toBeNull();
});

test("wizard-20 spellcasting", () => {
  const built = builtOf("wizard-20");
  const sheet = toSheet(built, {});
  const spellcasting = sheet.spellcasting!;

  expect(spellcasting.slots).toEqual(
    Object.entries(built["spell-slots"]).map(([level, count]) => ({ level: Number(level), count })),
  );
  expect(spellcasting.slots.map((s) => s.count)).toEqual([4, 3, 3, 3, 3, 2, 2, 1, 1]);
  expect(spellcasting.byLevel.map((l) => [l.level, l.spells.length])).toEqual(
    Object.entries(built["spells-known"]).map(([level, spells]) => [Number(level), spells.__entries.length]),
  );
  expect(spellcasting.byLevel[0]!.spells[0]).toEqual({
    key: "acid-splash",
    name: "Acid Splash",
    source: "Wizard",
    ability: "int",
    alwaysPrepared: false,
    prepared: false,
  });
  for (const { spells } of spellcasting.byLevel) {
    expect(spells.map((s) => s.key)).toEqual(spells.map((s) => s.key).sort());
  }
  expect(spellcasting.casters).toEqual([
    {
      name: "Wizard",
      ability: "int",
      saveDc: built["spell-modifiers"].Wizard!["spell-save-dc"],
      attackBonus: built["spell-modifiers"].Wizard!["spell-attack-modifier"],
      canPrepare: built["prepare-spell-count"].Wizard,
    },
  ]);
  expect(spellcasting.casters[0]).toMatchObject({ saveDc: 19, attackBonus: 11, canPrepare: 25 });
  expect(sheet.classes[0]!.name).toBe("Wizard");
});

test("wizard-1 knows spells through its race, which does not prepare", () => {
  const casters = toSheet(builtOf("wizard-1"), {}).spellcasting!.casters;
  expect(casters.find((c) => c.name === "High Elf")).toMatchObject({ ability: "int", canPrepare: null });
});

test("barbarian-5 speed depends on armor", () => {
  expect(toSheet(builtOf("barbarian-5"), {}).speeds).toEqual([
    { feet: 40, label: "unarmored" },
    { feet: 30, label: "Chain Mail armor" },
    { feet: 40, label: "Hide armor" },
  ]);
});

test("fighter-1 armor class and hit points", () => {
  const sheet = toSheet(builtOf("fighter-1"), {});
  expect(sheet.armorClass).toBe(19);
  expect(sheet.maxHitPoints).toBe(12);
});

test("resistances and immunities become display strings", () => {
  expect(toSheet(builtOf("fighter-5"), {}).resistances).toEqual(["Poison"]);
  expect(toSheet(builtOf("wizard-1"), {}).immunities).toEqual(["Magical Sleep"]);
});

test("with nothing worn or wielded, AC is the best combination, as in the old app", () => {
  const built = { ...builtOf("fighter-1"), "worn-armor": null, "wielded-shield": null };
  expect(toSheet(built, {}).armorClass).toBe(19);
});

test("armor or a shield set to none counts as none, as in the old app", () => {
  const built = builtOf("fighter-1");
  const ac = (worn: string | null, shield: string | null) => toSheet({ ...built, "worn-armor": worn, "wielded-shield": shield }, {}).armorClass;
  const option = (armor: string | null, shield: string | null) =>
    built["armor-class-with-armor"].find((o) => o.armor === armor && o.shield === shield)!.ac;
  expect(ac("none", "shield")).toBe(option(null, "shield"));
  expect(ac("chain-mail", "none")).toBe(option("chain-mail", null));
  expect(ac("none", "none")).toBe(option(null, null));
  expect(ac("none", "none")).toBeLessThan(ac(null, null));
});

test("special attacks read like the old display's attack-description", () => {
  const built: Built2014 = {
    ...builtOf("fighter-1"),
    attacks: [
      {
        name: "Breath Weapon",
        "attack-type": "area",
        "area-type": "cone",
        length: 15,
        "damage-type": "fire",
        "damage-die": 6,
        "damage-die-count": 2,
        save: "orcpub.dnd.e5.character/dex",
        "save-dc": 13,
      } as NonNullable<Built2014["attacks"]>[number],
    ],
  };
  expect(toSheet(built, {}).specialAttacks).toEqual([
    { name: "Breath Weapon", text: "15 ft. cone, 2d6 fire damage, DC13 dex save." },
  ]);
});

test("a special attack without damage dice or type prints only what it has", () => {
  const built: Built2014 = {
    ...builtOf("fighter-1"),
    attacks: [
      { name: "Frightful Glare", summary: "frighten a creature", save: "orcpub.dnd.e5.character/wis", "save-dc": 12 },
    ],
  };
  expect(toSheet(built, {}).specialAttacks[0].text).toBe("Frighten a creature, melee, DC12 wis save.");
});

// Prepared spells come from the strict entity (ORC-104).
const VALUES = "~:orcpub.entity.strict/values";
const BY_CLASS = "~:orcpub.dnd.e5.character/prepared-spells-by-class";
const CLASS_NAME = "~:orcpub.dnd.e5.character/class-name";
const SPELLS = "~:orcpub.dnd.e5.character/prepared-spells";
type PreparedEntry = { [CLASS_NAME]: string; [SPELLS]: { "~#set": string[] } };
const strictOf = (name: string) => readFixture(`${name}.strict.json`);
/** The spells the sheet marks prepared, as "Class/spell-key", sorted. */
const markedPrepared = (sheet: ReturnType<typeof toSheet>) =>
  (sheet.spellcasting?.byLevel ?? [])
    .flatMap(({ spells }) => spells.filter((s) => s.prepared).map((s) => `${s.source}/${s.key}`))
    .sort();
/** The entity with its prepared spells replaced by these keys for one class. */
const preparing = (entity: Record<string, object>, className: string, keys: string[]) => ({
  ...entity,
  [VALUES]: { ...entity[VALUES], [BY_CLASS]: [{ [CLASS_NAME]: className, [SPELLS]: { "~#set": keys.map((key) => `~:${key}`) } }] },
});

const withPrepared = srdGolden.filter((name) => BY_CLASS in strictOf(name)[VALUES]);

test("the SRD golden characters with prepared spells are the wizards", () => {
  expect(withPrepared).toEqual(["fighter-3-wizard-2", "wizard-1", "wizard-11", "wizard-20", "wizard-5"]);
});

test.each(withPrepared)("%s marks exactly the entity's prepared spells, and no cantrip", (name) => {
  const entity = strictOf(name);
  const fromEntity = (entity[VALUES][BY_CLASS] as PreparedEntry[])
    .flatMap((entry) => entry[SPELLS]["~#set"].map((key) => `${entry[CLASS_NAME]}/${key.slice(2)}`))
    .sort();
  const sheet = toSheet(builtOf(name), entity);
  expect(markedPrepared(sheet)).toEqual(fromEntity);
  expect(sheet.spellcasting!.byLevel[0]!.spells.some((s) => s.prepared)).toBe(false);
  // The entity as JSON text, which StrictEntity also allows, reads the same.
  expect(markedPrepared(toSheet(builtOf(name), JSON.stringify(entity)))).toEqual(fromEntity);
});

test("wizard-1 marks its four prepared spells, and none for an entity without prepared spells", () => {
  expect(markedPrepared(toSheet(builtOf("wizard-1"), strictOf("wizard-1")))).toEqual([
    "Wizard/alarm",
    "Wizard/burning-hands",
    "Wizard/charm-person",
    "Wizard/color-spray",
  ]);
  expect(markedPrepared(toSheet(builtOf("wizard-1"), {}))).toEqual([]);
});

test("a cantrip in the prepared spells is not marked", () => {
  const sheet = toSheet(builtOf("wizard-1"), preparing(strictOf("wizard-1"), "Wizard", ["acid-splash", "alarm"]));
  expect(markedPrepared(sheet)).toEqual(["Wizard/alarm"]);
});

test("a class that does not prepare never marks a spell", () => {
  // The warlock knows its spells. Its pack does not matter: expected.json needs no engine.
  const built = builtOf("warlock-10-drow");
  expect(built["prepares-spells"]).toBeNull();
  const keys = Object.values(built["spells-known"]).flatMap((level) => level.__entries.map(([[, key]]) => key));
  expect(markedPrepared(toSheet(built, preparing(strictOf("warlock-10-drow"), "Warlock", keys)))).toEqual([]);
});
