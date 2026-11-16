// Custom Origin (ORC-138): the slots of a base race, the copy that the
// picks make, the picks that Edit finds again, and the save.
import "fake-indexeddb/auto";
import { beforeAll, expect, test } from "vitest";
import { addCharacter } from "../state/character.ts";
import { getCharacter } from "../storage/characters.ts";
import { CONTENT_TYPES } from "./content.ts";
import { CUSTOM_PACK, characterContent, saveCopy, srdRaceRecord } from "./custom.ts";
import {
  baseRaceRecord,
  CUSTOM_ORIGIN,
  changedSlots,
  lostChoices,
  type OriginLists,
  type OriginSlot,
  originBase,
  originPicks,
  originRecord,
  originSlots,
  putBack,
  RACE_TYPE,
  saveCustomOrigin,
  slotOptions,
  slotValueName,
  withPick,
} from "./custom-origin.ts";
import { type Content, engine, loadEngine } from "./engine.ts";
import { characterFile, readCharacterFile } from "./import.ts";
import { remapOption, withoutOption } from "./reconcile.ts";
import { fighter20 } from "./test-feats.ts";
import { RACE_PACKS, SYLVAR, TAGGED_RACES, withSylvar } from "./test-races.ts";

beforeAll(() => loadEngine());

const SRD: Content = { homebrew: undefined };
const SRD_RACES = ["dragonborn", "dwarf", "elf", "gnome", "half-elf", "half-orc", "halfling", "human", "tiefling"];

/** Short lists of each kind, as the app gives them from the content lists. */
const LISTS: OriginLists = {
  language: ["Common", "Dwarvish", "Elvish", "Orc", "Sylvan"].map((name) => ({ key: name, name })),
  skill: [
    { key: "intimidation", name: "Intimidation" },
    { key: "perception", name: "Perception" },
    { key: "stealth", name: "Stealth" },
  ],
  tool: [
    { key: "smiths-tools", name: "Smith's Tools", group: "Artisan's tools" },
    { key: "thieves-tools", name: "Thieves' Tools", group: "Other tools" },
  ],
  weapon: [
    { key: "battleaxe", name: "Battleaxe" },
    { key: "handaxe", name: "Handaxe" },
    { key: "light-hammer", name: "Light hammer" },
    { key: "longbow", name: "Longbow" },
    { key: "warhammer", name: "Warhammer" },
  ],
};

const slot = (kind: OriginSlot["kind"], race: string, value = race, amount?: number): OriginSlot => ({
  kind,
  ...(amount !== undefined && { amount }),
  race,
  value,
});

/** The Half-Orc's record with +2 Strength moved to Dexterity, +1 Constitution to Wisdom, Orc to Elvish and Intimidation to Stealth. */
async function movedHalfOrc() {
  const base = (await srdRaceRecord("half-orc"))!;
  let slots = originSlots(base);
  slots = withPick(slots, 0, "ability:dex");
  slots = withPick(slots, 1, "ability:wis");
  slots = withPick(slots, 3, "language:Elvish");
  slots = withPick(slots, 4, "skill:stealth");
  return { base, slots, copy: originRecord(base, slots, "half-orc", "Half-Orc") };
}

test("the slots of a base race: its bonuses in the sheet's order, its languages, and its skill, tool and weapon proficiencies", async () => {
  expect(originSlots((await srdRaceRecord("half-orc"))!)).toEqual([
    slot("ability", "ability:str", "ability:str", 2),
    slot("ability", "ability:con", "ability:con", 1),
    slot("language", "language:Common"),
    slot("language", "language:Orc"),
    slot("skill", "skill:intimidation"),
  ]);
  expect(originSlots((await srdRaceRecord("dwarf"))!)).toEqual([
    slot("ability", "ability:con", "ability:con", 2),
    slot("language", "language:Dwarvish"),
    slot("language", "language:Common"),
    ...["handaxe", "battleaxe", "light-hammer", "warhammer"].map((w) => slot("weapon", `weapon:${w}`)),
  ]);
  // A pack race's own record: its bonuses, languages and weapon.
  expect(originSlots(SYLVAR)).toEqual([
    slot("ability", "ability:dex", "ability:dex", 1),
    slot("ability", "ability:wis", "ability:wis", 2),
    slot("language", "language:Common"),
    slot("language", "language:Sylvan"),
    slot("weapon", "weapon:longbow"),
  ]);
});

test("the copy with moved bonuses and swapped picks: each value in the place of the race's, with the name and the base race; Edit finds the same picks", async () => {
  const { base, slots, copy } = await movedHalfOrc();
  expect(changedSlots(slots)).toBe(true);
  expect(changedSlots(originSlots(base))).toBe(false);
  expect(copy).toEqual({
    ...base,
    "~:name": "Half-Orc (Custom Origin)",
    [CUSTOM_ORIGIN]: "~:half-orc",
    "~:abilities": { "~:orcpub.dnd.e5.character/dex": 2, "~:orcpub.dnd.e5.character/wis": 1 },
    "~:languages": { "~#set": ["Common", "Elvish"] },
    "~:props": { "~:skill-prof": { "~:stealth": true } },
  });
  expect(originBase(copy)).toBe("half-orc");
  expect(originBase(base)).toBeUndefined();
  expect(originPicks(base, copy)).toEqual(slots);
  // The validator keeps the key that names the base race.
  expect(engine().validate.race({ ...copy, "~:key": "~:half-orc-custom-origin", "~:option-pack": CUSTOM_PACK })).toEqual({
    ok: true,
    problems: [],
    item: { ...copy, "~:key": "~:half-orc-custom-origin", "~:option-pack": CUSTOM_PACK },
  });
});

test("an option that another slot holds is not offered; the slot's own value is; Put back trades places with the slot that holds the race's value", async () => {
  const { base, slots } = await movedHalfOrc();
  // +2 is on Dexterity and +1 on Wisdom: the +2 slot can take each ability but Wisdom.
  expect(slotOptions(base, slots, 0, LISTS).map((o) => o.id)).toEqual(["ability:str", "ability:dex", "ability:con", "ability:int", "ability:cha"]);
  expect(slotOptions(base, slots, 3, LISTS).map((o) => o.name)).toEqual(["Dwarvish", "Elvish", "Orc", "Sylvan"]);
  expect(slotOptions(base, slots, 4, LISTS).map((o) => o.name)).toEqual(["Intimidation", "Perception", "Stealth"]);
  // The +1 moves to Strength, which the +2 slot gives; Put back on the +2 slot then trades: +2 Strength, +1 Dexterity.
  const traded = putBack(withPick(slots, 1, "ability:str"), 0);
  expect(traded.slice(0, 2)).toEqual([slot("ability", "ability:str", "ability:str", 2), slot("ability", "ability:con", "ability:dex", 1)]);
  expect(putBack(slots, 3)[3]).toEqual(slot("language", "language:Orc"));
  expect(slotValueName("ability:wis", LISTS)).toBe("Wisdom");
  expect(slotValueName("tool:smiths-tools", LISTS)).toBe("Smith's Tools");
  expect(slotValueName("language:Abyssal", LISTS)).toBe("Abyssal");
});

test("Human: +1 on each of the six abilities, so no bonus slot can take another ability", async () => {
  const human = (await srdRaceRecord("human"))!;
  const slots = originSlots(human);
  const bonuses = slots.flatMap((s, i) => (s.kind === "ability" ? [i] : []));
  expect(bonuses).toHaveLength(6);
  for (const i of bonuses) expect(slotOptions(human, slots, i, LISTS).map((o) => o.id)).toEqual([slots[i].race]);
});

test("Dwarf: a weapon can become a tool, which goes into the tools; Edit finds the weapon slot that holds it", async () => {
  const base = (await srdRaceRecord("dwarf"))!;
  const slots = originSlots(base);
  const battleaxe = slots.findIndex((s) => s.race === "weapon:battleaxe");
  expect(slotOptions(base, slots, battleaxe, LISTS)).toEqual([
    { id: "weapon:battleaxe", name: "Battleaxe" },
    { id: "weapon:longbow", name: "Longbow" },
    { id: "tool:smiths-tools", name: "Smith's Tools", group: "Artisan's tools" },
    { id: "tool:thieves-tools", name: "Thieves' Tools", group: "Other tools" },
  ]);
  const picked = withPick(slots, battleaxe, "tool:smiths-tools");
  const copy = originRecord(base, picked, "dwarf", "Dwarf");
  expect(copy).toEqual({
    ...base,
    "~:name": "Dwarf (Custom Origin)",
    [CUSTOM_ORIGIN]: "~:dwarf",
    "~:props": { "~:weapon-prof": { "~:handaxe": true, "~:light-hammer": true, "~:warhammer": true } },
    "~:profs": { "~:tool": { "~:smiths-tools": true } },
  });
  expect(originPicks(base, copy)).toEqual(picked);
});

test("the copy of each SRD race with no edits gives the skills that the race gives, as the engine builds them", async () => {
  const skills = (built: { "skill-profs": Record<string, unknown> | null }) => Object.keys(built["skill-profs"] ?? {});
  const given: Record<string, string[]> = {};
  for (const key of SRD_RACES) {
    const base = (await srdRaceRecord(key))!;
    const raceOnly = engine().select(engine().emptyCharacter(), ["race"], key);
    const saved = saveCustomOrigin(raceOnly, undefined, SRD, { item: originRecord(base, originSlots(base), key, key), baseKey: key, selected: key });
    expect(skills(engine().evaluate(saved.entity, saved.content).built)).toEqual(skills(engine().evaluate(raceOnly).built));
    given[key] = skills(engine().evaluate(raceOnly).built);
  }
  expect(Object.entries(given).filter(([, s]) => s.length > 0)).toEqual([
    ["elf", ["perception"]],
    ["half-orc", ["intimidation"]],
  ]);
});

test("the choices of a base race that its copy does not have", async () => {
  const lost = async (key: string) => {
    const base = (await srdRaceRecord(key))!;
    return lostChoices(key, originRecord(base, originSlots(base), key, key), SRD);
  };
  expect(await lost("dwarf")).toEqual(["Subrace", "Tool Proficiency"]);
  expect(await lost("half-elf")).toEqual(["Ability Score Improvement", "Skill Proficiency", "Languages"]);
  expect(await lost("half-orc")).toEqual([]);
});

test("Custom Origin on fighter-20's Human as a Half-Orc: the moved bonuses, the language and the skill show on the built character, and the Human's picks go", async () => {
  const { copy } = await movedHalfOrc();
  const saved = saveCustomOrigin(fighter20(), undefined, SRD, { item: copy, baseKey: "half-orc", selected: "human" });
  expect(saved.key).toBe("half-orc-custom-origin");
  expect(saved.removed).toEqual([
    ["race", "human", "subrace", "illuskan"],
    ["race", "human", "variant", "standard-human"],
  ]);
  let expected = withoutOption(fighter20(), ["race", "human", "subrace", "illuskan"]);
  expected = withoutOption(expected, ["race", "human", "variant", "standard-human"]);
  expect(saved.entity).toEqual(remapOption(expected, ["race", "human"], "half-orc-custom-origin"));
  expect(saved.custom).toEqual({
    [TAGGED_RACES]: { "~:half-orc-custom-origin": { ...copy, "~:key": "~:half-orc-custom-origin", "~:option-pack": CUSTOM_PACK } },
  });
  const { built } = engine().evaluate(saved.entity, saved.content);
  expect([built.race, built["race-ability-increases"], built.languages, Object.keys(built["skill-profs"] ?? {}).includes("stealth")]).toEqual([
    "Half-Orc (Custom Origin)",
    { "orcpub.dnd.e5.character/dex": 2, "orcpub.dnd.e5.character/wis": 1 },
    expect.arrayContaining(["common", "elvish"]),
    true,
  ]);
  expect(built.languages).not.toContain("orc");
});

test("a second Custom Origin replaces the first copy, with the key of its new base race; without a race the base race is selected first", async () => {
  const { copy } = await movedHalfOrc();
  const first = saveCustomOrigin(fighter20(), undefined, SRD, { item: copy, baseKey: "half-orc", selected: "human" });
  const elf = (await srdRaceRecord("elf"))!;
  const elfCopy = originRecord(elf, withPick(originSlots(elf), 0, "ability:str"), "elf", "Elf");
  const second = saveCustomOrigin(first.entity, first.custom, SRD, { item: elfCopy, baseKey: "elf", selected: "half-orc-custom-origin" });
  expect(second.entity).toEqual(remapOption(first.entity, ["race", "half-orc-custom-origin"], "elf-custom-origin"));
  expect(Object.keys((second.custom as Record<string, object>)[TAGGED_RACES])).toEqual(["~:elf-custom-origin"]);

  const noRace = withoutOption(fighter20(), ["race", "human"]);
  const fresh = saveCustomOrigin(noRace, undefined, SRD, { item: elfCopy, baseKey: "elf", selected: undefined });
  expect(fresh.removed).toEqual([]);
  expect(engine().evaluate(fresh.entity, fresh.content).built.race).toBe("Elf (Custom Origin)");
});

test("a pack race is a base race too: its record is the pack item", async () => {
  const content: Content = { homebrew: RACE_PACKS };
  const base = (await baseRaceRecord(content.homebrew, "sylvar"))!;
  const { "~:key": _key, "~:option-pack": _pack, ...record } = SYLVAR;
  expect(base).toEqual(record);
  expect(await baseRaceRecord(content.homebrew, "dwarf")).toEqual(await srdRaceRecord("dwarf"));
  const copy = originRecord(base, withPick(originSlots(base), 4, "weapon:battleaxe"), "sylvar", "Sylvar");
  expect(copy).toEqual({ ...record, "~:name": "Sylvar (Custom Origin)", [CUSTOM_ORIGIN]: "~:sylvar", "~:props": { "~:weapon-prof": { "~:battleaxe": true } } });
  const saved = saveCustomOrigin(withSylvar(), undefined, content, { item: copy, baseKey: "sylvar", selected: "sylvar" });
  expect(saved.entity).toEqual(remapOption(withSylvar(), ["race", "sylvar"], "sylvar-custom-origin"));
  expect(engine().evaluate(saved.entity, saved.content).built.race).toBe("Sylvar (Custom Origin)");
});

test("the copy's base race survives the character file's export and import, so Edit finds the same picks", async () => {
  const { base, slots, copy } = await movedHalfOrc();
  const saved = saveCustomOrigin(fighter20(), undefined, SRD, { item: copy, baseKey: "half-orc", selected: "human" });
  const record = (await getCharacter(await addCharacter(saved.entity, "2014", null, saved.custom)))!;
  const { characters, failures } = readCharacterFile(JSON.stringify(characterFile(record)));
  expect(failures).toEqual([]);
  expect(characters[0].custom).toEqual(saved.custom);
  const item = (characters[0].custom as Record<string, Record<string, Record<string, unknown>>>)[TAGGED_RACES]["~:half-orc-custom-origin"];
  expect(originBase(item)).toBe("half-orc");
  expect(originPicks(base, item)).toEqual(slots);
  expect(CONTENT_TYPES.find((t) => t.type === RACE_TYPE)?.validator).toBe("race");
  expect(characterContent(SRD, characters[0].custom)).toEqual({ homebrew: { [CUSTOM_PACK]: saved.custom } });
});

test("a bonus moved onto another of the race's own abilities: Edit finds the picks, and a save after Edit writes the same copy", async () => {
  const base = (await srdRaceRecord("half-orc"))!;
  for (const [plus2, plus1] of [
    ["ability:con", "ability:str"],
    ["ability:wis", "ability:str"],
  ]) {
    const slots = withPick(withPick(originSlots(base), 1, plus1 === "ability:str" ? "ability:int" : plus1), 0, plus2);
    const picked = withPick(slots, 1, plus1);
    const copy = originRecord(base, picked, "half-orc", "Half-Orc");
    expect(copy["~:abilities"]).toEqual({ [`~:orcpub.dnd.e5.character/${plus2.slice(8)}`]: 2, [`~:orcpub.dnd.e5.character/${plus1.slice(8)}`]: 1 });
    const again = originPicks(base, copy);
    expect(again).toEqual(picked);
    expect(changedSlots(again)).toBe(true);
    // The save after Edit writes the same copy, and the character the same entity.
    expect(originRecord(base, again, "half-orc", "Half-Orc")).toEqual(copy);
    const first = saveCustomOrigin(fighter20(), undefined, SRD, { item: copy, baseKey: "half-orc", selected: "human" });
    const second = saveCustomOrigin(first.entity, first.custom, SRD, {
      item: originRecord(base, again, "half-orc", "Half-Orc"),
      baseKey: "half-orc",
      selected: "half-orc-custom-origin",
    });
    expect([second.entity, second.custom]).toEqual([first.entity, first.custom]);
  }
});

test("a language moved onto another language of the race keeps the copy's languages after Edit", async () => {
  const base = (await srdRaceRecord("half-orc"))!;
  // Orc becomes Elvish, then Common becomes Orc: the copy speaks Orc and Elvish.
  const picked = withPick(withPick(originSlots(base), 3, "language:Elvish"), 2, "language:Orc");
  const copy = originRecord(base, picked, "half-orc", "Half-Orc");
  expect(copy["~:languages"]).toEqual({ "~#set": ["Orc", "Elvish"] });
  const again = originPicks(base, copy);
  expect(changedSlots(again)).toBe(true);
  expect(new Set(setOf(originRecord(base, again, "half-orc", "Half-Orc")["~:languages"]))).toEqual(new Set(["Orc", "Elvish"]));
});
const setOf = (value: unknown) => (value as { "~#set": string[] })["~#set"];

test("a value that the record holds outside its slots is not offered, so a pick never replaces it", () => {
  const base = {
    "~:name": "Stonefolk",
    "~:abilities": { "~:orcpub.dnd.e5.character/con": 2, "~:orcpub.dnd.e5.character/int": -2, "~:orcpub.dnd.e5.character/wis": 1 },
    "~:languages": { "~#set": ["Common"] },
    "~:props": { "~:weapon-prof": { "~:battleaxe": true, "~:longbow": false } },
  };
  const slots = originSlots(base);
  expect(slots.map((s) => s.race)).toEqual(["ability:con", "ability:wis", "language:Common", "weapon:battleaxe"]);
  expect(slotOptions(base, slots, 1, LISTS).map((o) => o.id)).toEqual(["ability:str", "ability:dex", "ability:wis", "ability:cha"]);
  expect(slotOptions(base, slots, 3, LISTS).map((o) => o.id)).not.toContain("weapon:longbow");
  const copy = originRecord(base, withPick(slots, 1, "ability:str"), "stonefolk", "Stonefolk");
  expect(copy["~:abilities"]).toEqual({
    "~:orcpub.dnd.e5.character/con": 2,
    "~:orcpub.dnd.e5.character/int": -2,
    "~:orcpub.dnd.e5.character/str": 1,
  });
});

test("Custom Origin on a race that is a plain Customize copy replaces the copy, so the character keeps one copy", async () => {
  const elf = (await srdRaceRecord("elf"))!;
  const withElf = engine().select(fighter20(), ["race"], "elf");
  const plain = saveCopy(withElf, undefined, SRD, { contentType: RACE_TYPE, path: ["race", "elf"], item: { ...elf, "~:name": "Elf (Custom)" } });
  const copy = originRecord(elf, withPick(originSlots(elf), 0, "ability:str"), "elf", "Elf");
  const saved = saveCustomOrigin(plain.entity, plain.custom, SRD, { item: copy, baseKey: "elf", selected: "elf-custom" });
  expect(Object.keys((saved.custom as Record<string, object>)[TAGGED_RACES])).toEqual(["~:elf-custom-origin"]);
  expect(saved.entity).toEqual(remapOption(plain.entity, ["race", "elf-custom"], "elf-custom-origin"));
});
