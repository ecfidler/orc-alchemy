import { describe, expect, it } from "vitest";
import { WEAPONS } from "./weapons.ts";

describe("the weapons table", () => {
  it("has the 38 weapons of SRD 5.2.1 with unique keys", () => {
    expect(WEAPONS).toHaveLength(38);
    expect(new Set(WEAPONS.map((w) => w.key)).size).toBe(38);
    expect(WEAPONS.filter((w) => w.category === "simple")).toHaveLength(14);
  });

  it("gives each weapon the mastery in docs/kb/srd-5.2-rules-delta.md §B9", () => {
    const byMastery: Record<string, string[]> = {};
    for (const weapon of WEAPONS) (byMastery[weapon.mastery] ??= []).push(weapon.name);
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

  it("reads a fixed damage amount", () => {
    expect(WEAPONS.find((w) => w.key === "blowgun")?.damage).toEqual({ count: 1, die: 1 });
    expect(WEAPONS.find((w) => w.key === "greatsword")?.damage).toEqual({ count: 2, die: 6 });
  });
});
