// The subrace of a race copy (ORC-248): an SRD subrace in srdRaceCopy, and a
// pack subrace in withSubrace and withPickedSubrace (custom-subrace.ts).
import { beforeAll, expect, test } from "vitest";
import { characterContent, features, formRecord, saveCopy } from "./custom.ts";
import { srdRaceRecord } from "./custom-race.ts";
import { withPickedSubrace, withSubrace } from "./custom-subrace.ts";
import { type Content, engine, loadEngine, type StrictEntity } from "./engine.ts";
import { remapOption, withoutOption } from "./reconcile.ts";
import { ALL_LANGUAGES, noEditCopy, SRD } from "./test-customize.ts";
import { fighter20 } from "./test-feats.ts";
import { DEEP_SYLVAR, RACE_PACK, RACE_PACKS, RACE_TYPE, SYLVAR, TAGGED_RACES, TAGGED_SUBRACES, withHillDwarf, withSylvar, wizard1 } from "./test-races.ts";

beforeAll(() => loadEngine());

// The subrace (ORC-248). The copy of a race has the values of the character's subrace as its own values, and no Subrace choice.

/** What the sheet shows of a race and its subrace, without the name of the subrace and the source of a spell, which a copy changes. */
function subraceParts(entity: StrictEntity, content: Content, custom?: object) {
  const { built, selections } = engine().evaluate(entity, characterContent(content, custom));
  return {
    abilities: built.abilities,
    hitPoints: built["max-hit-points"],
    speed: built["base-land-speed"],
    darkvision: built.darkvision,
    skills: Object.keys(built["skill-profs"] ?? {}).sort(),
    tools: Object.keys(built["tool-profs"] ?? {}),
    weapons: built["weapon-profs"],
    languages: built.languages,
    resistances: built.resistances,
    spells: Object.values(built["spells-known"] ?? {}).flatMap((known) => (known?.__entries ?? []).map(([, spell]) => spell.key)),
    features: features(built)
      .map((f) => f.name)
      .sort(),
    // The picks still to make, or to remove, outside the race: the path of a choice under the race has the key of the race.
    remaining: selections.filter((s) => s.remaining !== 0 && s.path[0] !== "race").map((s) => [s.path.join("/"), s.remaining]),
  };
}

/** The number of picks still to make in each choice with the key under the character's race. Less than 0: picks to remove. */
const raceChoiceRemaining = (entity: StrictEntity, key: string, content: Content, custom?: object) =>
  engine()
    .evaluate(entity, characterContent(content, custom))
    .selections.filter((s) => s.path[0] === "race" && s.key === key)
    .map((s) => s.remaining);

/** wizard-1 without his race, a High Elf. */
const wizardWithoutRace = () => withoutOption(wizard1(), ["race", "elf"]);

test("a Hill Dwarf's copy has the +1 Wisdom and the hit point for each level of the subrace, and a no-edit copy keeps the sheet", async () => {
  const entity = withHillDwarf(wizardWithoutRace());
  const { copy, saved } = await noEditCopy(entity, "dwarf", "Dwarf (Custom)");
  const dwarf = (await srdRaceRecord("dwarf"))!;
  expect(copy.held).toEqual([["race", "dwarf", "subrace", "hill-dwarf"]]);
  expect(copy.record).toEqual({
    ...dwarf,
    "~:abilities": { "~:orcpub.dnd.e5.character/con": 2, "~:orcpub.dnd.e5.character/wis": 1 },
    "~:props": {
      "~:weapon-prof": { "~:handaxe": true, "~:battleaxe": true, "~:light-hammer": true, "~:warhammer": true },
      "~:max-hp-bonus": 1,
      "~:damage-resistance": { "~:poison": true },
    },
  });
  expect(saved.removed).toEqual([]);
  expect(saved.entity).toEqual(remapOption(withoutOption(entity, ["race", "dwarf", "subrace", "hill-dwarf"]), ["race", "dwarf"], "dwarf-custom"));
  const before = subraceParts(entity, SRD);
  expect(subraceParts(saved.entity, SRD, saved.custom)).toEqual(before);
  // Without the subrace, the Dwarf has one hit point and one Wisdom less.
  const plain = subraceParts(withoutOption(entity, ["race", "dwarf", "subrace", "hill-dwarf"]), SRD);
  expect(before.hitPoints).toBe(plain.hitPoints + 1);
  expect(before.abilities["orcpub.dnd.e5.character/wis"]).toBe(plain.abilities["orcpub.dnd.e5.character/wis"] + 1);
});

test("a High Elf's copy has the +1 Intelligence, the weapons and the cantrip pick of the subrace, and its language is a choice that keeps the pick", async () => {
  // wizard-1 is a High Elf with the cantrip Minor Illusion and a language pick.
  const entity = wizard1();
  const { copy, saved } = await noEditCopy(entity, "elf", "Elf (Custom)");
  expect(copy.held).toEqual([
    ["race", "elf", "subrace", "high-elf"],
    ["race", "elf", "subrace", "high-elf", "high-elf-cantrips-known", "minor-illusion"],
  ]);
  expect(copy.record).toEqual({
    ...(await srdRaceRecord("elf")),
    "~:abilities": { "~:orcpub.dnd.e5.character/dex": 2, "~:orcpub.dnd.e5.character/int": 1 },
    // A wizard has no martial weapon, so the probe finds the weapons of the High Elf.
    "~:props": {
      "~:weapon-prof": { "~:longbow": true, "~:longsword": true, "~:shortbow": true, "~:shortsword": true },
      "~:skill-prof": { "~:perception": true },
    },
    "~:profs": { "~:language-options": { "~:choose": 1, "~:options": ALL_LANGUAGES } },
    "~:spells": [{ "~:level": 1, "~:value": { "~:level": 0, "~:ability": "~:orcpub.dnd.e5.character/int", "~:key": "~:minor-illusion" } }],
  });
  // The Elf alone has none of these.
  const elf = (await srdRaceRecord("elf"))!;
  expect(elf["~:profs"]).toBeUndefined();
  expect(elf["~:spells"]).toBeUndefined();
  expect(elf["~:props"]).toEqual({ "~:skill-prof": { "~:perception": true } });
  expect(saved.removed).toEqual([]);
  const before = subraceParts(entity, SRD);
  expect(before.weapons).toEqual(["crossbow-light", "dagger", "dart", "longbow", "longsword", "quarterstaff", "shortbow", "shortsword", "sling"]);
  expect(before.spells).toContain("minor-illusion");
  expect(subraceParts(saved.entity, SRD, saved.custom)).toEqual(before);
  // The language choice of the copy holds as many picks as the choice of the High Elf did.
  expect(raceChoiceRemaining(saved.entity, "languages", SRD, saved.custom)).toEqual(raceChoiceRemaining(entity, "languages", SRD));
});

test("a Rock Gnome's copy has the +1 Constitution, the tinker's tools and the two features of the subrace, and a Lightfoot's copy the +1 Charisma and Naturally Stealthy", async () => {
  const e = engine();
  const gnome = e.select(e.select(wizardWithoutRace(), ["race"], "gnome"), ["race", "gnome", "subrace"], "rock-gnome");
  const rock = await noEditCopy(gnome, "gnome", "Gnome (Custom)");
  const gnomeRecord = (await srdRaceRecord("gnome"))!;
  expect(rock.copy.held).toEqual([["race", "gnome", "subrace", "rock-gnome"]]);
  expect(rock.copy.record).toEqual({
    ...gnomeRecord,
    "~:abilities": { "~:orcpub.dnd.e5.character/con": 1, "~:orcpub.dnd.e5.character/int": 2 },
    "~:profs": { "~:tool": { "~:tinkers-tools": true } },
    "~:traits": [
      ...(gnomeRecord["~:traits"] as object[]),
      {
        "~:name": "Artificer's Lore",
        "~:page": 37,
        "~:description": "Add 2X prof bonus on magical, alchemical, or technological item-related history checks.",
      },
      { "~:name": "Tinker", "~:page": 37, "~:description": "Construct tiny clockwork devices." },
    ],
  });
  expect(rock.saved.removed).toEqual([]);
  expect(subraceParts(rock.saved.entity, SRD, rock.saved.custom)).toEqual(subraceParts(gnome, SRD));

  const halfling = e.select(e.select(wizardWithoutRace(), ["race"], "halfling"), ["race", "halfling", "subrace"], "lightfoot");
  const lightfoot = await noEditCopy(halfling, "halfling", "Halfling (Custom)");
  const halflingRecord = (await srdRaceRecord("halfling"))!;
  expect(lightfoot.copy.held).toEqual([["race", "halfling", "subrace", "lightfoot"]]);
  expect(lightfoot.copy.record).toEqual({
    ...halflingRecord,
    "~:abilities": { "~:orcpub.dnd.e5.character/dex": 2, "~:orcpub.dnd.e5.character/cha": 1 },
    "~:traits": [
      ...(halflingRecord["~:traits"] as object[]),
      { "~:name": "Naturally Stealthy", "~:page": 28, "~:description": "Hide behind creatures larger than you" },
    ],
  });
  expect(lightfoot.saved.removed).toEqual([]);
  expect(subraceParts(lightfoot.saved.entity, SRD, lightfoot.saved.custom)).toEqual(subraceParts(halfling, SRD));
});

/** A pack subrace of Sylvar with a value of each kind that withSubrace adds. */
const FAR_SYLVAR = {
  ...DEEP_SYLVAR,
  "~:key": "~:far-sylvar",
  "~:name": "Far Sylvar",
  "~:speed": 40,
  "~:darkvision": 120,
  "~:abilities": { "~:orcpub.dnd.e5.character/int": 1, "~:orcpub.dnd.e5.character/wis": 1 },
  "~:props": { "~:max-hp-bonus": 2, "~:weapon-prof": { "~:net": true }, "~:damage-resistance": { "~:fire": true }, "~:skill-prof": { "~:arcana": true } },
  "~:profs": { "~:tool": { "~:smiths-tools": true }, "~:skill-options": { "~:choose": 2, "~:options": { "~:history": true, "~:nature": true } } },
  "~:spells": [{ "~:level": 1, "~:value": { "~:level": 0, "~:ability": "~:orcpub.dnd.e5.character/int", "~:key": "~:fire-bolt" } }],
  "~:traits": [{ "~:name": "Far Sight", "~:description": "You see a long way." }],
};
const FAR_PACKS = { [RACE_PACK]: { [TAGGED_RACES]: { "~:sylvar": SYLVAR }, [TAGGED_SUBRACES]: { "~:far-sylvar": FAR_SYLVAR } } };

test("withSubrace adds the values of a pack subrace to those of the race, with its own size, speed and darkvision", () => {
  expect(withSubrace(formRecord(SYLVAR), FAR_SYLVAR)).toEqual({
    ...formRecord(SYLVAR),
    "~:speed": 40,
    "~:darkvision": 120,
    // Sylvar has +2 Wisdom, and the subrace +1 more.
    "~:abilities": { "~:orcpub.dnd.e5.character/wis": 3, "~:orcpub.dnd.e5.character/dex": 1, "~:orcpub.dnd.e5.character/int": 1 },
    "~:props": {
      "~:weapon-prof": { "~:longbow": true, "~:net": true },
      "~:max-hp-bonus": 2,
      "~:damage-resistance": { "~:fire": true },
      "~:skill-prof": { "~:arcana": true },
    },
    "~:profs": FAR_SYLVAR["~:profs"],
    "~:spells": FAR_SYLVAR["~:spells"],
    "~:traits": [...SYLVAR["~:traits"], ...FAR_SYLVAR["~:traits"]],
  });
  // The same choice of the race and of the subrace is one choice of the two numbers together.
  const choice = (choose: number, ...skills: string[]) => ({
    "~:profs": { "~:skill-options": { "~:choose": choose, "~:options": Object.fromEntries(skills.map((s) => [`~:${s}`, true])) } },
  });
  expect(withSubrace(choice(1, "arcana"), choice(2, "history"))).toEqual(choice(3, "arcana", "history"));
  // The engine uses the flying speed of the subrace, not a sum. The hit points for each level are a sum.
  const speeds = (flying: number, hitPoints: number) => ({ "~:props": { "~:flying-speed": flying, "~:max-hp-bonus": hitPoints } });
  expect(withSubrace(speeds(30, 1), speeds(50, 1))).toEqual(speeds(50, 2));
  // The engine offers only the skill choice of a pack subrace, so its other choices do not go to the copy.
  const languageChoice = { "~:language-options": { "~:choose": 1, "~:options": { "~:elvish": true } } };
  expect(withSubrace({}, { "~:profs": languageChoice })).toEqual({});
  expect(withSubrace({}, { "~:profs": { ...languageChoice, "~:tool": { "~:smiths-tools": true } } })).toEqual({
    "~:profs": { "~:tool": { "~:smiths-tools": true } },
  });
  // A subrace with no values changes nothing.
  expect(withSubrace(formRecord(SYLVAR), { "~:name": "Plain", "~:race": "~:sylvar" })).toEqual(formRecord(SYLVAR));
});

test("withPickedSubrace gives the copy the pack subrace of the character, with a skill pick under it as a skill of the copy, and the copy keeps the sheet", () => {
  const e = engine();
  const content: Content = { homebrew: FAR_PACKS };
  let entity = e.select(e.select(fighter20(), ["race"], "sylvar", content), ["race", "sylvar", "subrace"], "far-sylvar", content);
  const skillChoice = ["race", "sylvar", "subrace", "far-sylvar", "skill-proficiency"];
  entity = e.select(entity, skillChoice, "nature", content);
  const plain = { record: formRecord(SYLVAR), held: [] };
  const copy = withPickedSubrace(plain, "sylvar", entity, FAR_PACKS);
  const subracePick = ["race", "sylvar", "subrace", "far-sylvar"];
  expect(copy.held).toEqual([subracePick, [...skillChoice, "nature"]]);
  const merged = withSubrace(formRecord(SYLVAR), FAR_SYLVAR);
  expect(copy.record).toEqual({
    ...merged,
    // The picked skill is a skill of the copy, and one skill is still to choose.
    "~:props": { ...(merged["~:props"] as object), "~:skill-prof": { "~:arcana": true, "~:nature": true } },
    "~:profs": { "~:tool": { "~:smiths-tools": true }, "~:skill-options": { "~:choose": 1, "~:options": { "~:history": true, "~:nature": true } } },
  });
  const item = { ...copy.record, "~:name": "Sylvar (Custom)" };
  const saved = saveCopy(entity, undefined, content, { contentType: RACE_TYPE, path: ["race", "sylvar"], item, held: copy.held });
  expect(saved.removed).toEqual([]);
  expect(subraceParts(saved.entity, content, saved.custom)).toEqual(subraceParts(entity, content));
  // One skill of the choice was still to pick, and it still is.
  expect(raceChoiceRemaining(entity, "skill-proficiency", content)).toEqual([1]);
  expect(raceChoiceRemaining(saved.entity, "skill-proficiency", content, saved.custom)).toEqual([1]);

  // A held pick goes with the picks under it, so saveCopy lists a pick under it that is not held.
  const partly = saveCopy(entity, undefined, content, { contentType: RACE_TYPE, path: ["race", "sylvar"], item, held: [subracePick] });
  expect(partly.removed).toEqual([[...skillChoice, "nature"]]);

  // The copy itself: with no character, with no subrace pick, with a subrace that the copy holds, and with a subrace that no pack has.
  expect(withPickedSubrace(plain, "sylvar", null, FAR_PACKS)).toBe(plain);
  expect(withPickedSubrace(plain, "sylvar", withSylvar(), FAR_PACKS)).toBe(plain);
  const holds = { record: formRecord(SYLVAR), held: [subracePick] };
  expect(withPickedSubrace(holds, "sylvar", entity, FAR_PACKS)).toBe(holds);
  expect(withPickedSubrace(plain, "sylvar", entity, RACE_PACKS)).toBe(plain);
});

test("the copy does not hold the engine's custom subrace, whose picks the probe does not read, so Save names it", async () => {
  const e = engine();
  let entity = e.select(e.select(wizardWithoutRace(), ["race"], "dwarf"), ["race", "dwarf", "subrace"], "custom");
  entity = e.select(entity, ["race", "dwarf", "subrace", "custom", "darkvision"], "ft-90");
  const { copy, saved } = await noEditCopy(entity, "dwarf", "Dwarf (Custom)");
  expect(copy).toEqual({ held: [], record: await srdRaceRecord("dwarf") });
  expect(saved.removed).toEqual([["race", "dwarf", "subrace", "custom"]]);
});
