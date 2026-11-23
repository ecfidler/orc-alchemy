// The 9 species of SRD 5.2.1 (ORC-226), with each lineage, legacy and
// ancestry, at character levels 1, 5 and 11. The class is the Wizard of the
// pack, which has no effects yet, so every value below comes from the
// species. Each expected number has its arithmetic from SRD 5.2.1 p83 to
// p86 in a comment. fighter.test.ts checks the Dwarf against the values of
// the spike.

import { describe, expect, it } from "vitest";
import pack from "../../content/srd52.json" with { type: "json" };
import { buildWithContributions, findProblems } from "../core/build.ts";
import type { StrictOption, StrictSelection } from "../core/entity.ts";
import { SRD52 } from "./built-in.ts";
import type { Entity2024 } from "./evaluate.ts";
import { loadContentPack } from "./packs.ts";
import { template2024 } from "./template.ts";

// Standard Array: Str 8, Dex 14, Con 13, Int 15, Wis 12, Cha 10. Con +1.
const SCORES = { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 };
const LEVELS = [1, 5, 11] as const;
// The Proficiency Bonus at levels 1, 5 and 11: +2, +3, +4 (SRD p23).
const PB: Record<number, number> = { 1: 2, 5: 3, 11: 4 };

function character(species: string, level: number, selections: StrictSelection[] = []): Entity2024 {
  const option: StrictOption = { key: `srd52:${species}`, ...(selections.length ? { selections } : {}) };
  return {
    selections: [
      { key: "ability-scores", option: { key: "standard-array", value: SCORES } },
      {
        key: "class",
        options: [
          {
            key: "srd52:wizard",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "arcana" }, { key: "history" }] },
              { key: "levels", options: Array.from({ length: level }, (_, i) => ({ key: `level-${i + 1}` })) },
            ],
          },
        ],
      },
      { key: "species", option },
      { key: "languages", options: [{ key: "srd52:draconic" }, { key: "srd52:elvish" }] },
    ],
  };
}

function build(species: string, level: number, selections: StrictSelection[] = []) {
  const entity = character(species, level, selections);
  const { built, contributions } = buildWithContributions(entity, template2024);
  return { built, contributions, problems: findProblems(entity, built, template2024) };
}

const choose = (key: string, option: string, selections?: StrictSelection[]): StrictSelection => ({
  key,
  option: { key: option, ...(selections ? { selections } : {}) },
});
const withAbility = (ability: string) => [choose("spellcasting-ability", ability)];
const uses = (built: ReturnType<typeof build>["built"], trait: string) => built.features.find((f) => f.key === `srd52:${trait}`)?.uses;
const spellKeys = (built: ReturnType<typeof build>["built"]) => built.spells.map((s) => s.spell.replace("srd52:", ""));
const longRest = [{ on: "long-rest", amount: "all" }];

describe("every species", () => {
  const species = SRD52.species.map((s) => s.key);

  it("is in the template", () => {
    expect(species).toEqual(["dragonborn", "dwarf", "elf", "gnome", "goliath", "halfling", "human", "orc", "tiefling"]);
  });

  it.each(species)("%s gives no ability scores and no languages, and shows each trait", (key) => {
    const { built } = build(key, 1);
    expect(built.abilities).toEqual(SCORES);
    expect(built.languages).toEqual(["srd52:common", "srd52:draconic", "srd52:elvish"]);
    const traits = SRD52.species.find((s) => s.key === key)?.traits ?? [];
    expect(built.features.filter((f) => f.source === `srd52:${key}`).map((f) => f.name)).toEqual(traits.map((t) => t.name));
  });

  it("still loads and shows its traits without its effects", () => {
    const bare = { ...pack, species: pack.species.map(({ effects: _effects, ...rest }) => rest) };
    const { pack: loaded, issues } = loadContentPack(bare);
    expect(issues).toEqual([]);
    for (const record of loaded?.species ?? []) {
      expect(record.effects).toBeUndefined();
      expect(record.traits?.length).toBeGreaterThan(0);
    }
  });
});

describe("Dragonborn", () => {
  const DRAGONS = {
    black: "acid",
    blue: "lightning",
    brass: "fire",
    bronze: "lightning",
    copper: "acid",
    green: "poison",
    gold: "fire",
    red: "fire",
    silver: "cold",
    white: "cold",
  };

  describe.each(Object.entries(DRAGONS))("%s dragon", (dragon, damage) => {
    it.each(LEVELS)("at level %i", (level) => {
      const { built, problems } = build("dragonborn", level, [choose("draconic-ancestry", dragon)]);
      expect(problems).toEqual([]);
      expect(built.lineage).toBe(dragon);
      expect(built.darkvision).toBe(60);
      expect(built.resistances).toEqual([`srd52:${damage}`]);
      // DC 8 + Con +1 + PB. 1d10, 2d10 at level 5, 3d10 at level 11.
      expect(built.savingThrowAttacks).toEqual([
        {
          key: "srd52:dragonborn/breath-weapon",
          name: "Breath Weapon",
          source: "srd52:dragonborn",
          save: "dex",
          dc: 8 + 1 + PB[level],
          damage: `${{ 1: 1, 5: 2, 11: 3 }[level]}d10`,
          damageType: `srd52:${damage}`,
        },
      ]);
      // Breath Weapon: uses equal to the PB. Draconic Flight: once from level 5.
      expect(uses(built, "dragonborn/breath-weapon")).toEqual({ amount: PB[level], recover: longRest });
      expect(uses(built, "dragonborn/draconic-flight")).toEqual({ amount: level >= 5 ? 1 : 0, recover: longRest });
    });
  });

  it("gives 4d10 at level 17", () => {
    const { built } = build("dragonborn", 17, [choose("draconic-ancestry", "red")]);
    // PB +6 at level 17: DC 8 + 1 + 6 = 15.
    expect(built.savingThrowAttacks[0]).toMatchObject({ damage: "4d10", dc: 15 });
  });
});

describe("Dwarf", () => {
  it.each(LEVELS)("at level %i", (level) => {
    const { built, contributions } = build("dwarf", level);
    expect(built).toMatchObject({ darkvision: 120, resistances: ["srd52:poison"], size: "medium", speed: 30, lineage: null });
    // Wizard: 6 at level 1, then the fixed 4 for each level. Con +1 for each level. Dwarven Toughness: +1 for each level.
    // Level 1: 6 + 1 + 1 = 8. Level 5: 6 + 16 + 5 + 5 = 32. Level 11: 6 + 40 + 11 + 11 = 68.
    expect(built.maxHitPoints).toBe({ 1: 8, 5: 32, 11: 68 }[level]);
    expect(contributions.maxHitPoints).toEqual([
      { name: "Dwarven Toughness", source: ["species", "srd52:dwarf"], from: built.maxHitPoints - level, to: built.maxHitPoints },
    ]);
    expect(uses(built, "dwarf/stonecunning")).toEqual({ amount: PB[level], recover: longRest });
  });
});

describe("Elf", () => {
  const LINEAGES = {
    drow: { darkvision: 120, speed: 30, spells: ["dancing-lights", "faerie-fire", "darkness"] },
    "high-elf": { darkvision: 60, speed: 30, spells: ["prestidigitation", "detect-magic", "misty-step"] },
    "wood-elf": { darkvision: 60, speed: 35, spells: ["druidcraft", "longstrider", "pass-without-trace"] },
  };

  describe.each(Object.entries(LINEAGES))("%s", (lineage, expected) => {
    it.each(LEVELS)("at level %i", (level) => {
      const { built, problems } = build("elf", level, [choose("elven-lineage", lineage, withAbility("wis")), choose("keen-senses", "perception")]);
      expect(problems).toEqual([]);
      expect(built).toMatchObject({ lineage, darkvision: expected.darkvision, speed: expected.speed });
      // The cantrip at level 1, then a spell at levels 3 and 5.
      expect(spellKeys(built)).toEqual(level === 1 ? expected.spells.slice(0, 1) : expected.spells);
      expect(built.spells.every((s) => s.ability === "wis" && s.source === "srd52:elf")).toBe(true);
      // The leveled spells: one cast without a slot, back on a Long Rest.
      expect(built.spells.slice(1).map((s) => s.uses)).toEqual(built.spells.slice(1).map(() => ({ amount: 1, recover: longRest })));
      expect(built.spells[0].uses).toBeUndefined();
      // Keen Senses: Perception. Wis +1 + PB.
      expect(built.skillBonuses.perception).toBe(1 + PB[level]);
    });
  });

  it("asks for the spellcasting ability", () => {
    const { problems } = build("elf", 1, [choose("elven-lineage", "drow", withAbility("str"))]);
    expect(problems.map((p) => p.reason)).toEqual(['"str" is not an option of "Spellcasting Ability"']);
  });
});

describe("Gnome", () => {
  it.each(LEVELS)("Forest Gnome at level %i", (level) => {
    const { built } = build("gnome", level, [choose("gnomish-lineage", "forest-gnome", withAbility("int"))]);
    expect(built).toMatchObject({ lineage: "forest-gnome", size: "small", darkvision: 60 });
    expect(spellKeys(built)).toEqual(["minor-illusion", "speak-with-animals"]);
    // Speak with Animals without a slot: uses equal to the PB.
    expect(built.spells[1].uses).toEqual({ amount: PB[level], recover: longRest });
    // Small: Str 8 x 15 lb. (SRD p178).
    expect(built.carryingCapacity).toBe(120);
  });

  it.each(LEVELS)("Rock Gnome at level %i", (level) => {
    const { built } = build("gnome", level, [choose("gnomish-lineage", "rock-gnome", withAbility("cha"))]);
    expect(built.lineage).toBe("rock-gnome");
    expect(spellKeys(built)).toEqual(["mending", "prestidigitation"]);
    expect(built.spells.map((s) => s.ability)).toEqual(["cha", "cha"]);
  });
});

describe("Goliath", () => {
  const GIANTS = ["cloud", "fire", "frost", "hill", "stone", "storm"];

  describe.each(GIANTS)("%s giant", (giant) => {
    it.each(LEVELS)("at level %i", (level) => {
      const { built, problems } = build("goliath", level, [choose("giant-ancestry", giant)]);
      expect(problems).toEqual([]);
      expect(built).toMatchObject({ lineage: giant, speed: 35, size: "medium" });
      expect(uses(built, "goliath/giant-ancestry")).toEqual({ amount: PB[level], recover: longRest });
      // Large Form: once from level 5.
      expect(uses(built, "goliath/large-form")).toEqual({ amount: level >= 5 ? 1 : 0, recover: longRest });
      // Powerful Build: one size larger, Large. Str 8 x 30 lb. = 240. Drag, lift or push: 480 (SRD p178).
      expect(built.carryingCapacity).toBe(240);
      expect(built.dragLiftPush).toBe(480);
    });
  });
});

describe("Halfling", () => {
  it.each(LEVELS)("at level %i", (level) => {
    const { built } = build("halfling", level);
    expect(built).toMatchObject({ size: "small", speed: 30, darkvision: 0, lineage: null });
    expect(built.features.filter((f) => f.source === "srd52:halfling").map((f) => f.name)).toEqual([
      "Brave",
      "Halfling Nimbleness",
      "Luck",
      "Naturally Stealthy",
    ]);
  });
});

describe("Human", () => {
  it.each(LEVELS)("at level %i", (level) => {
    const { built, problems } = build("human", level, [choose("size", "small"), choose("skillful", "stealth"), choose("versatile", "alert")]);
    expect(problems).toEqual([]);
    expect(built.size).toBe("small");
    // Skillful: Stealth. Dex +2 + PB.
    expect(built.skillBonuses.stealth).toBe(2 + PB[level]);
    // Versatile: the Origin feat.
    expect(built.feats).toEqual([{ key: "srd52:alert", name: "Alert", category: "origin" }]);
  });

  it("offers the 18 skills and the 4 Origin feats", () => {
    const selections = template2024.selections.find((s) => s.key === "species")?.options.find((o) => o.key === "srd52:human")?.selections;
    expect(selections?.map((s) => [s.key, s.options.length])).toEqual([
      ["size", 2],
      ["skillful", 18],
      ["versatile", 4],
    ]);
  });
});

describe("Orc", () => {
  it.each(LEVELS)("at level %i", (level) => {
    const { built } = build("orc", level);
    expect(built.darkvision).toBe(120);
    // Adrenaline Rush: uses equal to the PB, all back on a Short or a Long Rest.
    expect(uses(built, "orc/adrenaline-rush")).toEqual({
      amount: PB[level],
      recover: [
        { on: "short-rest", amount: "all" },
        { on: "long-rest", amount: "all" },
      ],
    });
    expect(uses(built, "orc/relentless-endurance")).toEqual({ amount: 1, recover: longRest });
  });
});

describe("Tiefling", () => {
  const LEGACIES = {
    abyssal: { damage: "poison", spells: ["poison-spray", "thaumaturgy", "ray-of-sickness", "hold-person"] },
    chthonic: { damage: "necrotic", spells: ["chill-touch", "thaumaturgy", "false-life", "ray-of-enfeeblement"] },
    infernal: { damage: "fire", spells: ["fire-bolt", "thaumaturgy", "hellish-rebuke", "darkness"] },
  };

  describe.each(Object.entries(LEGACIES))("%s", (legacy, expected) => {
    it.each(LEVELS)("at level %i", (level) => {
      const { built, problems } = build("tiefling", level, [choose("size", "medium"), choose("fiendish-legacy", legacy, withAbility("cha"))]);
      expect(problems).toEqual([]);
      expect(built).toMatchObject({ lineage: legacy, darkvision: 60, resistances: [`srd52:${expected.damage}`], size: "medium" });
      // The legacy cantrip and Thaumaturgy (Otherworldly Presence) at level 1, then spells at levels 3 and 5.
      expect(spellKeys(built)).toEqual(level === 1 ? expected.spells.slice(0, 2) : expected.spells);
      expect(built.spells.every((s) => s.ability === "cha")).toBe(true);
    });
  });

  it("gives the level 3 spell at level 3, before the level 5 spell", () => {
    const { built } = build("tiefling", 3, [choose("size", "small"), choose("fiendish-legacy", "infernal", withAbility("int"))]);
    expect(spellKeys(built)).toEqual(["fire-bolt", "thaumaturgy", "hellish-rebuke"]);
  });
});

describe("the spells of the species", () => {
  it("name spells of the pack", () => {
    const keys = new Set(SRD52.spells.map((s) => `srd52:${s.key}`));
    const named = JSON.stringify(pack.species).match(/"spell":"(srd52:[a-z-]+)"|"spell": "(srd52:[a-z-]+)"/g) ?? [];
    expect(named.length).toBeGreaterThan(0);
    for (const entry of named) expect(keys.has(entry.replace(/"spell": ?"|"/g, ""))).toBe(true);
  });
});
