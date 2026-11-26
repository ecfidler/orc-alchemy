// Customize a race (ORC-136): the SRD race as a form record, and its choices
// (ORC-247), as srdRaceCopy in custom-race.ts gives them.
import { beforeAll, expect, test } from "vitest";
import { characterContent, saveCopy } from "./custom.ts";
import { srdRaceCopy, srdRaceRecord } from "./custom-race.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { remapOption, withoutOption } from "./reconcile.ts";
import { ALL_LANGUAGES, noEditCopy, raceParts, SRD } from "./test-customize.ts";
import { fighter20 } from "./test-feats.ts";
import { RACE_TYPE, withHillDwarf, wizard1 } from "./test-races.ts";

beforeAll(() => loadEngine());

test("srdRaceRecord gives the SRD race in the form's shape, with the resistance that the engine gives, and a copy keeps both", async () => {
  const record = await srdRaceRecord("dwarf");
  expect(record).toEqual({
    "~:name": "Dwarf",
    "~:help": "Dwarves are short and stout and tend to be skilled warriors and craftmen in stone and metal.",
    "~:size": "~:medium",
    "~:speed": 25,
    "~:darkvision": 60,
    "~:abilities": { "~:orcpub.dnd.e5.character/con": 2 },
    "~:languages": { "~#set": ["Dwarvish", "Common"] },
    // The list has the weapons. The poison resistance comes from the engine.
    "~:props": {
      "~:weapon-prof": { "~:handaxe": true, "~:battleaxe": true, "~:light-hammer": true, "~:warhammer": true },
      "~:damage-resistance": { "~:poison": true },
    },
    // The summary of a feature is its description, the field that the form edits.
    "~:traits": [
      { "~:name": "Dwarven Resilience", "~:page": 20, "~:description": "Advantage on poison saves, resistance to poison damage" },
      { "~:name": "Stonecunning", "~:page": 20, "~:description": "2X prof bonus on stonework-related history checks" },
    ],
  });
  expect(await srdRaceRecord("no-such-race")).toBeUndefined();

  // wizard-1 as a Hill Dwarf: a wizard has no martial weapon, so the Dwarf's battleaxe and warhammer show. The copy has no subraces, so the save removes Hill Dwarf.
  const base = wizard1();
  const entity = withHillDwarf(base);
  const before = raceParts(entity, undefined, base);
  expect(before.weapons).toEqual(["battleaxe", "crossbow-light", "dagger", "dart", "handaxe", "light-hammer", "quarterstaff", "sling", "warhammer"]);
  const next = saveCopy(
    entity,
    undefined,
    { homebrew: undefined },
    { contentType: RACE_TYPE, path: ["race", "dwarf"], item: { ...record, "~:name": "Dwarf (Custom)" } },
  );
  expect(next.removed).toEqual([["race", "dwarf", "subrace", "hill-dwarf"]]);
  expect(next.entity).toEqual(remapOption(withoutOption(entity, ["race", "dwarf", "subrace", "hill-dwarf"]), ["race", "dwarf"], "dwarf-custom"));
  // What the copy loses: the subrace (+1 Wisdom). The poison resistance, the weapons and the rest stay.
  expect(before.resistances).toEqual([{ value: "poison", qualifier: null }]);
  expect(raceParts(next.entity, next.custom, base)).toEqual({
    ...before,
    race: "Dwarf (Custom)",
    subrace: null,
    abilities: { ...before.abilities, "orcpub.dnd.e5.character/wis": before.abilities["orcpub.dnd.e5.character/wis"] - 1 },
  });
});

/** The spells that the character knows from the source, such as its race: each key, with its spell level and ability. */
function spellsFrom(entity: StrictEntity, custom: object | undefined, source: string) {
  const { built } = engine().evaluate(entity, characterContent(SRD, custom));
  return Object.entries(built["spells-known"]).flatMap(([level, known]) =>
    known.__entries.filter(([[from]]) => from === source).map(([, spell]) => ({ level: Number(level), key: spell.key, ability: spell.ability })),
  );
}

test("the SRD Tiefling record has the fire resistance, the spells with their unlock levels and the features, and a no-edit copy keeps them", async () => {
  const record = await srdRaceRecord("tiefling");
  const CHA = "~:orcpub.dnd.e5.character/cha";
  expect(record).toEqual({
    "~:name": "Tiefling",
    "~:help":
      "Tieflings bear the distinct marks of their infernal ancestry: horns, a tail, pointed teeth, and solid-colored eyes. They are smart and charismatic.",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:darkvision": 60,
    "~:abilities": { "~:orcpub.dnd.e5.character/int": 1, [CHA]: 2 },
    "~:languages": { "~#set": ["Common", "Infernal"] },
    // The content list has none of the three values below: the engine gives them.
    "~:props": { "~:damage-resistance": { "~:fire": true } },
    "~:spells": [
      { "~:level": 1, "~:value": { "~:level": 0, "~:ability": CHA, "~:key": "~:thaumaturgy" } },
      { "~:level": 3, "~:value": { "~:level": 1, "~:ability": CHA, "~:key": "~:hellish-rebuke" } },
      { "~:level": 5, "~:value": { "~:level": 2, "~:ability": CHA, "~:key": "~:darkness" } },
    ],
    "~:traits": [
      { "~:name": "Hellish Resistance", "~:page": 43, "~:description": "Resistance to fire damage" },
      {
        "~:name": "Infernal Legacy",
        "~:page": 43,
        "~:description": "You know thaumaturgy and can cast Hellish Rebuke and Darkness once per day. CHA is the spellcasting ability.",
      },
    ],
  });

  const copyOf = (entity: StrictEntity) =>
    saveCopy(entity, undefined, SRD, { contentType: RACE_TYPE, path: ["race", "tiefling"], item: { ...record, "~:name": "Tiefling (Custom)" } });
  const cha = "orcpub.dnd.e5.character/cha";
  const spells = [
    { level: 0, key: "thaumaturgy", ability: cha },
    { level: 1, key: "hellish-rebuke", ability: cha },
    { level: 2, key: "darkness", ability: cha },
  ];

  // fighter-20 as a Tiefling: the copy gives each spell, the resistance and the features. The Tiefling has no choices, so Save removes no pick.
  const tiefling = engine().select(fighter20(), ["race"], "tiefling");
  const before = raceParts(tiefling, undefined);
  expect(before.resistances).toEqual([{ value: "fire", qualifier: null }]);
  expect(before.features).toEqual([
    { name: "Hellish Resistance", frequency: null },
    { name: "Infernal Legacy", frequency: null },
  ]);
  expect(spellsFrom(tiefling, undefined, "Tiefling")).toEqual(spells);
  const next = copyOf(tiefling);
  expect(next.removed).toEqual([]);
  expect(raceParts(next.entity, next.custom)).toEqual({ ...before, race: "Tiefling (Custom)" });
  expect(spellsFrom(next.entity, next.custom, "Tiefling (Custom)")).toEqual(spells);

  // wizard-1 as a Tiefling: at level 1, the copy unlocks only the cantrip, as the race does.
  const young = engine().select(wizard1(), ["race"], "tiefling");
  expect(spellsFrom(young, undefined, "Tiefling")).toEqual(spells.slice(0, 1));
  const youngCopy = copyOf(young);
  expect(spellsFrom(youngCopy.entity, youngCopy.custom, "Tiefling (Custom)")).toEqual(spells.slice(0, 1));
});

test("the SRD Human record has +1 in each ability, so a no-edit copy of a standard Human keeps the scores", async () => {
  const record = await srdRaceRecord("human");
  expect(record).toEqual({
    "~:name": "Human",
    "~:help": "Humans are physically diverse and highly adaptable. They excel in nearly every profession.",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:abilities": {
      "~:orcpub.dnd.e5.character/str": 1,
      "~:orcpub.dnd.e5.character/dex": 1,
      "~:orcpub.dnd.e5.character/con": 1,
      "~:orcpub.dnd.e5.character/int": 1,
      "~:orcpub.dnd.e5.character/wis": 1,
      "~:orcpub.dnd.e5.character/cha": 1,
    },
    "~:languages": { "~#set": ["Common"] },
    // The Human's extra language is a choice of the record, with the SRD race's options.
    "~:profs": { "~:language-options": { "~:choose": 1, "~:options": ALL_LANGUAGES } },
    "~:traits": [],
  });
  // fighter-20 is a standard Human of the subrace Illuskan. Without held, saveCopy lists each pick that the save removes.
  const next = saveCopy(
    fighter20(),
    undefined,
    { homebrew: undefined },
    { contentType: RACE_TYPE, path: ["race", "human"], item: { ...record, "~:name": "Human (Custom)" } },
  );
  expect(next.removed).toEqual([
    ["race", "human", "subrace", "illuskan"],
    ["race", "human", "variant", "standard-human"],
  ]);
  expect(raceParts(next.entity, next.custom)).toEqual({ ...raceParts(fighter20(), undefined), race: "Human (Custom)", subrace: null });
});

// The choices of an SRD race (ORC-247). A pick of the character under the race becomes a fixed value of the copy, or stays as the pick of a choice of the copy.

/** What the sheet shows of the race's choices: the scores, the skills, the tools, the languages, the resistances and the picks still to make or to remove. */
function choiceParts(entity: StrictEntity, custom: object | undefined) {
  const { built, selections } = engine().evaluate(entity, characterContent(SRD, custom));
  return {
    abilities: built.abilities,
    skills: Object.keys(built["skill-profs"] ?? {}),
    tools: Object.keys(built["tool-profs"] ?? {}),
    languages: built.languages,
    resistances: built.resistances,
    // The path of a choice under the race has the key of the race, which the copy changes.
    remaining: selections.filter((s) => s.remaining !== 0 && s.path[0] !== "race").map((s) => [s.path.join("/"), s.remaining]),
    raceRemaining: selections.filter((s) => s.remaining !== 0 && s.path[0] === "race").map((s) => [s.key, s.remaining]),
  };
}

const ability = (key: string) => `orcpub.dnd.e5.character/${key}`;

test("a Dwarf's tool pick is a tool proficiency of the copy, and Save does not list the pick", async () => {
  const e = engine();
  const entity = e.select(e.select(fighter20(), ["race"], "dwarf"), ["race", "dwarf", "tool-proficiency"], "smiths-tools");
  const { copy, saved } = await noEditCopy(entity, "dwarf", "Dwarf (Custom)");
  expect(copy.held).toEqual([["race", "dwarf", "tool-proficiency", "smiths-tools"]]);
  expect(copy.record).toEqual({ ...(await srdRaceRecord("dwarf")), "~:profs": { "~:tool": { "~:smiths-tools": true } } });
  expect(saved.removed).toEqual([]);
  // The save removes the pick from the character; the copy gives the tool.
  expect(saved.entity).toEqual(remapOption(withoutOption(entity, ["race", "dwarf", "tool-proficiency", "smiths-tools"]), ["race", "dwarf"], "dwarf-custom"));
  const before = choiceParts(entity, undefined);
  expect(before.tools).toEqual(["smiths-tools"]);
  // The Dwarf had no subrace pick, and the copy has no subrace choice.
  expect(before.raceRemaining).toEqual([["subrace", 1]]);
  expect(choiceParts(saved.entity, saved.custom)).toEqual({ ...before, raceRemaining: [] });

  // Without held, saveCopy lists the pick.
  const plain = saveCopy(entity, undefined, SRD, { contentType: RACE_TYPE, path: ["race", "dwarf"], item: { ...copy.record, "~:name": "Dwarf (Custom)" } });
  expect(plain.removed).toEqual([["race", "dwarf", "tool-proficiency", "smiths-tools"]]);
});

test("a Half-Elf's ability picks are increases of the copy, and its skill and language choices are choices of the copy that keep their picks", async () => {
  const e = engine();
  let entity = e.select(fighter20(), ["race"], "half-elf");
  for (const key of ["dex", "wis"]) entity = e.increaseAbility(entity, ["race", "half-elf", "asi"], ability(key));
  for (const skill of ["arcana", "stealth"]) entity = e.select(entity, ["race", "half-elf", "skill-proficiency"], skill);
  const { copy, saved } = await noEditCopy(entity, "half-elf", "Half-Elf (Custom)");
  expect(copy.held).toEqual([
    ["race", "half-elf", "asi", ability("dex")],
    ["race", "half-elf", "asi", ability("wis")],
  ]);
  const record = (await srdRaceRecord("half-elf"))!;
  expect(record["~:abilities"]).toEqual({ [`~:${ability("cha")}`]: 2 });
  expect(record["~:profs"]).toEqual({
    "~:skill-options": {
      "~:choose": 2,
      "~:options": Object.fromEntries(
        [
          "acrobatics",
          "animal-handling",
          "arcana",
          "athletics",
          "deception",
          "history",
          "insight",
          "intimidation",
          "investigation",
          "medicine",
          "nature",
          "perception",
          "performance",
          "persuasion",
          "religion",
          "sleight-of-hand",
          "stealth",
          "survival",
        ].map((skill) => [`~:${skill}`, true]),
      ),
    },
    "~:language-options": { "~:choose": 1, "~:options": ALL_LANGUAGES },
  });
  expect(copy.record).toEqual({ ...record, "~:abilities": { [`~:${ability("cha")}`]: 2, [`~:${ability("dex")}`]: 1, [`~:${ability("wis")}`]: 1 } });
  expect(saved.removed).toEqual([]);
  // The skill picks stay under the copy. Only the ability picks go.
  let expected = withoutOption(entity, ["race", "half-elf", "asi", ability("dex")]);
  expected = withoutOption(expected, ["race", "half-elf", "asi", ability("wis")]);
  expect(saved.entity).toEqual(remapOption(expected, ["race", "half-elf"], "half-elf-custom"));
  const before = choiceParts(entity, undefined);
  expect(before.skills).toEqual(expect.arrayContaining(["arcana", "stealth"]));
  expect(choiceParts(saved.entity, saved.custom)).toEqual(before);
});

test("a Variant Human's ability picks and skill pick are values of the copy; a Human without a variant pick gets +1 in each ability", async () => {
  const e = engine();
  const variant = ["race", "human", "variant", "variant-human"];
  // fighter-20 with a new Human: no subrace pick. His feat is a pick of the feats list, not of the race.
  let entity = e.select(e.select(fighter20(), ["race"], "dwarf"), ["race"], "human");
  const noVariant = (await srdRaceCopy("human", entity))!;
  expect(noVariant).toEqual({ held: [], record: await srdRaceRecord("human") });

  entity = e.select(entity, ["race", "human", "variant"], "variant-human");
  for (const key of ["dex", "wis"]) entity = e.increaseAbility(entity, [...variant, "asi"], ability(key));
  entity = e.select(entity, [...variant, "skill-proficiency"], "arcana");
  const { copy, saved } = await noEditCopy(entity, "human", "Human (Custom)");
  expect(copy.held).toEqual([variant, [...variant, "asi", ability("dex")], [...variant, "asi", ability("wis")], [...variant, "skill-proficiency", "arcana"]]);
  expect(copy.record).toEqual({
    ...(await srdRaceRecord("human")),
    "~:abilities": { [`~:${ability("dex")}`]: 1, [`~:${ability("wis")}`]: 1 },
    "~:props": { "~:skill-prof": { "~:arcana": true } },
  });
  expect(saved.removed).toEqual([]);
  expect(saved.entity).toEqual(remapOption(withoutOption(entity, variant), ["race", "human"], "human-custom"));
  const before = choiceParts(entity, undefined);
  expect(before.raceRemaining).toEqual([
    ["subrace", 1],
    ["languages", -2],
  ]);
  // The language choice keeps its count. The copy has no subrace choice.
  expect(choiceParts(saved.entity, saved.custom)).toEqual({ ...before, raceRemaining: [["languages", -2]] });
  expect(engine().evaluate(saved.entity, saved.content).built.feats).toEqual(["grappler"]);

  // fighter-20 is a standard Human of the subrace Illuskan: the copy holds the two picks. The subrace of a Human gives no value.
  const standard = await noEditCopy(fighter20(), "human", "Human (Custom)");
  expect(standard.copy).toEqual({
    held: [
      ["race", "human", "subrace", "illuskan"],
      ["race", "human", "variant", "standard-human"],
    ],
    record: await srdRaceRecord("human"),
  });
  expect(standard.saved.removed).toEqual([]);
});

test("a Dragonborn's ancestry gives the copy its damage resistance and the Breath Weapon as a feature; without the pick, the copy has neither", async () => {
  const e = engine();
  const dragonborn = e.select(fighter20(), ["race"], "dragonborn");
  const plain = (await srdRaceRecord("dragonborn"))!;
  expect(plain["~:props"]).toBeUndefined();
  expect(plain["~:traits"]).toEqual([]);
  expect(await srdRaceCopy("dragonborn", dragonborn)).toEqual({ held: [], record: plain });

  const entity = e.select(dragonborn, ["race", "dragonborn", "draconic-ancestry"], "blue");
  const { copy, saved } = await noEditCopy(entity, "dragonborn", "Dragonborn (Custom)");
  expect(copy.held).toEqual([["race", "dragonborn", "draconic-ancestry", "blue"]]);
  expect(copy.record).toEqual({
    ...plain,
    "~:props": { "~:damage-resistance": { "~:lightning": true } },
    "~:traits": [
      {
        "~:name": "Breath Weapon",
        "~:type": "~:action",
        "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": 1 },
        "~:description":
          "Each creature in a line 5 ft. wide and 30 ft. long makes a DEX saving throw, DC 8 + your CON modifier + your proficiency bonus. " +
          "It takes 2d6 lightning damage on a failed save, and half on a success. The damage is 3d6 at level 6, 4d6 at level 11 and 5d6 at level 16.",
      },
    ],
  });
  expect(saved.removed).toEqual([]);
  const before = choiceParts(entity, undefined);
  expect(before.resistances).toEqual([{ value: "lightning", qualifier: null }]);
  expect(choiceParts(saved.entity, saved.custom)).toEqual(before);
  // The Breath Weapon is an attack of the SRD race. The copy gives it as a trait of the type action with one use, which the sheet shows with the actions.
  expect(e.evaluate(entity).built.attacks?.map((a) => a.name)).toEqual(["Breath Weapon"]);
  const after = e.evaluate(saved.entity, saved.content).built;
  expect(after.attacks).toBeNull();
  expect(after.traits.find((t) => t.name === "Breath Weapon")).toMatchObject({
    type: "action",
    frequency: { units: "orcpub.dnd.e5.units/short-rest", amount: 1 },
  });

  // A red dragon breathes a cone.
  const red = (await srdRaceCopy("dragonborn", e.select(dragonborn, ["race", "dragonborn", "draconic-ancestry"], "red")))!;
  expect((red.record["~:traits"] as Record<string, string>[])[0]["~:description"]).toMatch(
    /^Each creature in a 15 ft\. cone makes a DEX saving throw.* 2d6 fire damage/,
  );
});
