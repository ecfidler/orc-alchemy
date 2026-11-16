// Character-local content (ORC-133): the helpers of custom.ts, and a custom
// feat with scaled uses on the open character's sheet.
import "fake-indexeddb/auto";
import type { Inventory } from "@pubdoor/dmv";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { customHash, summaryFingerprint } from "../storage/characters.ts";
import { BACKGROUND_TYPE, optionKeyOf } from "./content.ts";
import {
  builtInText,
  CUSTOM_PACK,
  characterContent,
  copyKey,
  customizeOption,
  features,
  formRecord,
  hasCustomItems,
  optionOrigin,
  pruneCustom,
  saveCopy,
  srdBackgroundRecord,
  srdRaceRecord,
  withCopyStartingEquipment,
  withoutUnresolvedUnder,
} from "./custom.ts";
import { type Content, engine, loadEngine, type StrictEntity } from "./engine.ts";
import { missingContent, remapOption, withoutOption } from "./reconcile.ts";
import { ARTISAN, BACKGROUND_PACK, SAGE, SAGE_PACKS, TAGGED_BACKGROUNDS, withSage } from "./test-backgrounds.ts";
import { FEAT_PACK, fighter20, SKILL, SKILL_EXPERT } from "./test-feats.ts";
import { RACE_PACKS, RACE_TYPE, SYLVAR, TAGGED_RACES, withHillDwarf, withSylvar, wizard1 } from "./test-races.ts";

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
});

const FEATS = "~:orcpub.dnd.e5/feats";
const RACES = "~:orcpub.dnd.e5/races";
const LANGUAGES = "~:orcpub.dnd.e5/languages";
const SELECTIONS = "~:orcpub.entity.strict/selections";
const KEY = "~:orcpub.entity.strict/key";

const feat = (key: string, name: string, more: object = {}) => ({ "~:key": `~:${key}`, "~:name": name, "~:option-pack": CUSTOM_PACK, ...more });
const CUSTOM = {
  [FEATS]: { "~:skill-expert-custom": feat("skill-expert-custom", "Skill Expert Custom", { "~:description": "You are an expert." }) },
  [TAGGED_BACKGROUNDS]: { "~:sage-custom": feat("sage-custom", "Sage Custom") },
  [RACES]: { "~:gnome-custom": feat("gnome-custom", "Gnome Custom", { "~:speed": 30 }) },
  [LANGUAGES]: { "~:sylvan-custom": feat("sylvan-custom", "Sylvan Custom") },
};
const SRD: Content = { homebrew: undefined };

/** The entity with a top-level selection of these options; :feats is where a human takes a feat (see feat-uses.test.tsx). */
const withOptions = (entity: StrictEntity, selection: string, ...keys: string[]): StrictEntity => {
  const e = entity as Record<string, object[]>;
  return { ...e, [SELECTIONS]: [...e[SELECTIONS], { [KEY]: `~:${selection}`, "~:orcpub.entity.strict/options": keys.map((k) => ({ [KEY]: `~:${k}` })) }] };
};
const withFeats = (entity: StrictEntity, ...keys: string[]) => withOptions(entity, "feats", ...keys);

test("characterContent adds custom as the reserved pack, and gives the same object for the same pair", () => {
  const pack = { "Some Pack": { [FEATS]: {} } };
  const content: Content = { homebrew: pack };
  expect(characterContent(content, undefined)).toBe(content);
  expect(characterContent(content, { [FEATS]: {} })).toBe(content);
  const custom = { [FEATS]: CUSTOM[FEATS] };
  const result = characterContent(content, custom);
  expect(result).toEqual({ homebrew: { ...pack, [CUSTOM_PACK]: custom } });
  expect(characterContent(content, custom)).toBe(result);
  expect(characterContent(content, { ...custom })).not.toBe(result);
  expect(characterContent(SRD, custom)).toEqual({ homebrew: { [CUSTOM_PACK]: custom } });
  expect(hasCustomItems(undefined)).toBe(false);
  expect(hasCustomItems(custom)).toBe(true);
});

test("pruneCustom keeps the feat, background, race and language that the character selects, and drops the others", () => {
  const e = engine();
  const options = characterContent(SRD, CUSTOM);
  let entity: StrictEntity = e.select(e.emptyCharacter(), ["race"], "gnome-custom", options);
  entity = e.select(entity, ["background"], "sage-custom", options);
  entity = withFeats(entity, "skill-expert-custom");
  // A language option elsewhere in the entity, at any depth.
  const all = withOptions(entity, "languages", "sylvan-custom");

  expect(pruneCustom(all, CUSTOM)).toBe(CUSTOM);
  // The report gives each content type and its bare key.
  expect(
    e
      .reconcileMissingContent(entity)
      .items.map(({ contentType, key, path }) => ({ contentType, key, path }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  ).toEqual([
    { contentType: "race", key: "gnome-custom", path: ["race", "gnome-custom"] },
    { contentType: "background", key: "sage-custom", path: ["background", "sage-custom"] },
    { contentType: "feat", key: "skill-expert-custom", path: ["feats", "skill-expert-custom"] },
  ]);
  const { [LANGUAGES]: _, ...withoutLanguage } = CUSTOM;
  expect(pruneCustom(entity, CUSTOM)).toEqual(withoutLanguage);
  expect(pruneCustom(e.emptyCharacter(), CUSTOM)).toBeUndefined();
  expect(pruneCustom(entity, undefined)).toBeUndefined();
  // A selected item stays when a loaded pack has its key too: the check does not read the loaded content.
  expect(pruneCustom(entity, { [FEATS]: CUSTOM[FEATS] })).toEqual({ [FEATS]: CUSTOM[FEATS] });
});

test("customHash is short and the same for the same content; summaryFingerprint adds it to the homebrew fingerprint", () => {
  expect(customHash(undefined)).toBeUndefined();
  expect(customHash({ [FEATS]: {} })).toBeUndefined();
  const hash = customHash(CUSTOM)!;
  expect(hash).toMatch(/^[0-9a-z]{1,7}$/);
  expect(customHash(structuredClone(CUSTOM))).toBe(hash);
  expect(customHash({ ...CUSTOM, [LANGUAGES]: {} })).not.toBe(hash);
  expect(summaryFingerprint("abc", undefined)).toBe("abc");
  expect(summaryFingerprint("abc", hash)).not.toBe("abc");
  expect(summaryFingerprint("abc", hash)).not.toBe(summaryFingerprint("", hash));
});

test("a custom feat with scaled uses shows its bubble on the open character's sheet", () => {
  const custom = {
    [FEATS]: {
      "~:tireless-custom": feat("tireless-custom", "Tireless Custom", {
        "~:description": "You keep going.",
        "~:type": "~:b-action",
        // One use for each character level, back on a short rest (engine 0.4.0 :frequency).
        "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": { "~:level": true } },
      }),
    },
  };
  const e = engine();
  let entity: StrictEntity = e.select(e.emptyCharacter(), ["race"], "human");
  for (let level = 1; level < 3; level++) entity = e.addLevel(entity, "barbarian");
  entity = withFeats(entity, "tireless-custom");

  const { result } = renderHook(() => useOpenCharacter());
  act(() => useCharacter.getState().load("t", entity, false, custom));
  const sheet = result.current.sheet!;
  expect(sheet.features.bonusActions.filter((f) => f.name === "Tireless Custom")).toEqual([
    { name: "Tireless Custom", text: "You keep going.", uses: { amount: 3, recharge: "Short rest" } },
  ]);
  render(<CharacterSheet sheet={sheet} />);
  const bubble = within(screen.getByRole("group", { name: "Features & traits" })).getByRole("group", { name: "Tireless Custom" });
  expect(within(bubble).getAllByRole("button", { name: /^Use / })).toHaveLength(3);
  expect(within(bubble).getByText("Short rest")).toBeTruthy();

  // Without its custom content, the character has no such feat.
  act(() => useCharacter.getState().load("t", entity));
  expect(
    Object.values(result.current.sheet!.features)
      .flat()
      .some((f) => f.name === "Tireless Custom"),
  ).toBe(false);
});

// Customize (ORC-134): the save step and the origin of an option, without React.

const PACKS = { [FEAT_PACK]: { [FEATS]: { "~:skill-expert": SKILL_EXPERT } } };

/** fighter-20 with the pack feat Skill Expert in place of Grappler, and Arcana for its skill choice. */
function withSkillExpert(): StrictEntity {
  const e = engine();
  const options = { homebrew: PACKS };
  let entity = e.deselect(fighter20(), ["feats"], "grappler", options);
  entity = e.select(entity, ["feats"], "skill-expert", options);
  entity = e.select(entity, SKILL, "skill", options);
  return e.select(entity, [...SKILL, "skill", "skill-proficiency"], "arcana", options);
}
const skills = (entity: StrictEntity, custom: object | undefined) =>
  Object.keys(engine().evaluate(entity, characterContent({ homebrew: PACKS }, custom)).built["skill-profs"] ?? {});
const feats = (entity: StrictEntity, custom: object | undefined) =>
  engine()
    .evaluate(entity, characterContent({ homebrew: PACKS }, custom))
    .selections.find((s) => s.key === "feats")!.selected;

test("copyKey of a feat is the key of the name without a dash at either end", () => {
  const feat = "orcpub.dnd.e5/feats";
  expect(copyKey(feat, "Skill Expert (Custom)")).toBe("skill-expert-custom");
  expect(copyKey(feat, "Grappler's Edge!")).toBe("grapplers-edge");
  expect(copyKey(feat, "()")).toBe("");
});

test("optionOrigin tells a custom copy, a pack item and a built-in apart", () => {
  const custom = { [FEATS]: { "~:skill-expert": { "~:name": "Mine" } } };
  expect(optionOrigin(PACKS, custom, "orcpub.dnd.e5/feats", "skill-expert")).toEqual({ from: "custom", item: { "~:name": "Mine" } });
  expect(optionOrigin(PACKS, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toEqual({ from: "pack", pack: FEAT_PACK, item: SKILL_EXPERT });
  expect(optionOrigin(PACKS, undefined, "orcpub.dnd.e5/feats", "grappler")).toEqual({ from: "built-in" });
  expect(optionOrigin(undefined, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toEqual({ from: "built-in" });
  // The last pack with the key wins; an item with the old app's off flag is not there.
  const two = { ...PACKS, Later: { [FEATS]: { "~:skill-expert": { "~:name": "Later" } } } };
  expect(optionOrigin(two, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toMatchObject({ pack: "Later" });
  const off = { ...PACKS, Later: { [FEATS]: { "~:skill-expert": { "~:name": "Later", "~:disabled?": true } } } };
  expect(optionOrigin(off, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toMatchObject({ pack: FEAT_PACK });
  expect(formRecord(SKILL_EXPERT)).toEqual({
    "~:name": "Skill Expert",
    "~:description": "You know skills.",
    "~:ability-increases": { "~#set": [] },
    "~:props": { "~:skill-tool-choice": 1 },
  });
});

test("customizeOption writes the copy and selects it in place of the pack feat, and the feat's choices stay", () => {
  const entity = withSkillExpert();
  expect(skills(entity, undefined)).toContain("arcana");
  const item = { ...formRecord(SKILL_EXPERT), "~:name": "Skill Expert (Custom)" };
  const result = customizeOption(entity, undefined, { contentType: "orcpub.dnd.e5/feats", path: ["feats", "skill-expert"], item });
  expect(result.custom).toEqual({
    [FEATS]: { "~:skill-expert-custom": { ...item, "~:key": "~:skill-expert-custom", "~:option-pack": CUSTOM_PACK } },
  });
  expect(feats(result.entity, result.custom)).toEqual(["skill-expert-custom"]);
  expect(skills(result.entity, result.custom)).toContain("arcana");
  // The original is still a feat to pick.
  const template = engine()
    .buildTemplate(characterContent({ homebrew: PACKS }, result.custom).homebrew)
    .shape.find((s) => s.key === "feats")!;
  expect(template.options.map((o) => o.key)).toEqual(expect.arrayContaining(["skill-expert", "skill-expert-custom", "grappler"]));
});

test("customizeOption replaces an edited copy, and with a new name removes the old item and remaps again", () => {
  const first = customizeOption(
    withSkillExpert(),
    { [LANGUAGES]: CUSTOM[LANGUAGES] },
    {
      contentType: "orcpub.dnd.e5/feats",
      path: ["feats", "skill-expert"],
      item: { ...formRecord(SKILL_EXPERT), "~:name": "Skill Expert (Custom)" },
    },
  );
  const path = ["feats", "skill-expert-custom"];
  const same = customizeOption(first.entity, first.custom, {
    contentType: "orcpub.dnd.e5/feats",
    path,
    item: { ...formRecord(SKILL_EXPERT), "~:name": "Skill Expert (Custom)", "~:description": "Changed." },
    replacedKey: "skill-expert-custom",
  });
  expect(same.entity).toBe(first.entity);
  expect(same.custom).toEqual({
    [LANGUAGES]: CUSTOM[LANGUAGES],
    [FEATS]: {
      "~:skill-expert-custom": {
        ...formRecord(SKILL_EXPERT),
        "~:name": "Skill Expert (Custom)",
        "~:description": "Changed.",
        "~:key": "~:skill-expert-custom",
        "~:option-pack": CUSTOM_PACK,
      },
    },
  });

  const renamed = customizeOption(same.entity, same.custom, {
    contentType: "orcpub.dnd.e5/feats",
    path,
    item: { ...formRecord(SKILL_EXPERT), "~:name": "Skill Savant" },
    replacedKey: "skill-expert-custom",
  });
  // The old item goes, and other content types stay.
  expect(renamed.custom).toEqual({
    [LANGUAGES]: CUSTOM[LANGUAGES],
    [FEATS]: { "~:skill-savant": { ...formRecord(SKILL_EXPERT), "~:name": "Skill Savant", "~:key": "~:skill-savant", "~:option-pack": CUSTOM_PACK } },
  });
  expect(feats(renamed.entity, renamed.custom)).toEqual(["skill-savant"]);
  expect(skills(renamed.entity, renamed.custom)).toContain("arcana");
  expect(() =>
    customizeOption(renamed.entity, renamed.custom, { contentType: "orcpub.dnd.e5/feats", path: ["feats", "skill-savant"], item: { "~:name": "!" } }),
  ).toThrow("The copy needs a name");
});

test("builtInText gives the text of the SRD feat's feature", () => {
  const { built } = engine().evaluate(fighter20());
  expect(builtInText(built, "Grappler")).toBe("Restrain a creature you are grappling");
  expect(builtInText(built, "No Such Feat")).toBe("");
});

// Customize a background (ORC-135). The engine keys a background by the name, not by the stored key.

const evaluateWith = (entity: StrictEntity, custom: object | undefined) => engine().evaluate(entity, characterContent({ homebrew: SAGE_PACKS }, custom));
/** What the sheet shows of a background: the background, the skills and tools, the language picks, the starting equipment and the features. */
function backgroundParts(entity: StrictEntity, custom: object | undefined) {
  const { built, selections } = evaluateWith(entity, custom);
  const fromBackground = (items: Inventory) =>
    Object.keys(items ?? {}).filter((key) => items?.[key]["orcpub.dnd.e5.character.equipment/background-starting-equipment?"]);
  return {
    background: built.background,
    // The skills that the background gives, by their source.
    skills: Object.entries(built["skill-profs"] ?? {})
      .filter(([, sources]) => built.background !== null && Object.keys(sources as object).includes(built.background))
      .map(([key]) => key)
      .sort(),
    tools: Object.keys(built["tool-profs"] ?? {}).sort(),
    languages: selections.find((s) => s.key === "languages")!.max,
    equipment: fromBackground(built.equipment).sort(),
    gold: built.treasure?.gp?.["orcpub.dnd.e5.character.equipment/quantity"],
    features: (built.traits ?? []).map((t) => t.name).filter((name) => !["Grappler Feat", "Remarkable Athlete", "Survivor", "Indomitable"].includes(name)),
  };
}

test("copyKey gives a background copy the engine's key of its name, with its dashes, and a feat copy the key without the dashes", () => {
  expect(copyKey(BACKGROUND_TYPE, "Sage (Custom)")).toBe("sage-custom-");
  expect(copyKey("orcpub.dnd.e5/feats", "Sage (Custom)")).toBe("sage-custom");
  expect(copyKey(BACKGROUND_TYPE, "Sage")).toBe("sage");
  expect(copyKey(BACKGROUND_TYPE, "()")).toBe("");
  // The engine gives the option the key of the name and ignores the stored key.
  for (const stored of ["sage-custom", "sage-custom-"]) {
    const custom = { [TAGGED_BACKGROUNDS]: { [`~:${stored}`]: { ...SAGE, "~:key": `~:${stored}`, "~:name": "Sage (Custom)", "~:option-pack": CUSTOM_PACK } } };
    const shape = engine().buildTemplate(characterContent({ homebrew: undefined }, custom).homebrew).shape;
    expect(shape.find((s) => s.key === "background")!.options.map((o) => o.key)).toContain("sage-custom-");
    expect(shape.find((s) => s.key === "background")!.options.map((o) => o.key)).not.toContain("sage-custom");
  }
});

test("optionOrigin finds a background by the key of its name, as the engine does", () => {
  // A pack background whose stored key is not the key of its name (ORC-130).
  const odd = { ...SAGE, "~:key": "~:old-sage" };
  const packs = { [BACKGROUND_PACK]: { [TAGGED_BACKGROUNDS]: { "~:old-sage": odd } } };
  expect(optionOrigin(packs, undefined, BACKGROUND_TYPE, "sage")).toEqual({ from: "pack", pack: BACKGROUND_PACK, item: odd });
  expect(optionOrigin(packs, undefined, BACKGROUND_TYPE, "old-sage")).toEqual({ from: "built-in" });
  const copy = { ...SAGE, "~:key": "~:sage-custom-", "~:name": "Sage (Custom)" };
  expect(optionOrigin(packs, { [TAGGED_BACKGROUNDS]: { "~:sage-custom-": copy } }, BACKGROUND_TYPE, "sage-custom-")).toEqual({ from: "custom", item: copy });
  expect(optionOrigin(packs, undefined, BACKGROUND_TYPE, "acolyte")).toEqual({ from: "built-in" });
});

test("customizeOption selects a background copy by the engine's key; its tool choice stays, and an edit and a rename keep the sheet", () => {
  const entity = withSage();
  const original = backgroundParts(entity, undefined);
  expect(original).toEqual({
    background: "Sage",
    skills: ["arcana", "history"],
    tools: ["smiths-tools", "thieves-tools"],
    languages: 1,
    equipment: ["ink", "ink-pen"],
    gold: 10,
    features: ["Researcher"],
  });
  const item = { ...formRecord(SAGE), "~:name": "Sage (Custom)" };
  const first = customizeOption(entity, undefined, { contentType: BACKGROUND_TYPE, path: ["background", "sage"], item });
  expect(first.custom).toEqual({ [TAGGED_BACKGROUNDS]: { "~:sage-custom-": { ...item, "~:key": "~:sage-custom-", "~:option-pack": CUSTOM_PACK } } });
  expect(backgroundParts(first.entity, first.custom)).toEqual({ ...original, background: "Sage (Custom)" });
  expect(
    evaluateWith(first.entity, first.custom).selections.find((s) => s.actualPath.join("/") === "background/sage-custom-/tool-proficiency-artisans-tools")!
      .selected,
  ).toEqual(["smiths-tools"]);
  expect(missingContent(first.entity, characterContent({ homebrew: SAGE_PACKS }, first.custom))).toEqual([]);
  expect(pruneCustom(first.entity, first.custom)).toBe(first.custom);

  const edited = { ...item, "~:help": "Changed." };
  const same = customizeOption(first.entity, first.custom, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "sage-custom-"],
    item: edited,
    replacedKey: "sage-custom-",
  });
  expect(same.entity).toBe(first.entity);
  expect(same.custom).toEqual({ [TAGGED_BACKGROUNDS]: { "~:sage-custom-": { ...edited, "~:key": "~:sage-custom-", "~:option-pack": CUSTOM_PACK } } });

  const renamed = customizeOption(same.entity, same.custom, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "sage-custom-"],
    item: { ...edited, "~:name": "Loremaster!" },
    replacedKey: "sage-custom-",
  });
  expect(renamed.custom).toEqual({
    [TAGGED_BACKGROUNDS]: { "~:loremaster-": { ...edited, "~:name": "Loremaster!", "~:key": "~:loremaster-", "~:option-pack": CUSTOM_PACK } },
  });
  expect(backgroundParts(renamed.entity, renamed.custom)).toEqual({ ...original, background: "Loremaster!" });
  expect(pruneCustom(renamed.entity, renamed.custom)).toBe(renamed.custom);
  // The original stays a background to pick.
  expect(
    engine()
      .buildTemplate(characterContent({ homebrew: SAGE_PACKS }, renamed.custom).homebrew)
      .shape.find((s) => s.key === "background")!
      .options.map((o) => o.key),
  ).toEqual(expect.arrayContaining(["sage", "loremaster-", "acolyte"]));
});

test("a choice under the background that the copy does not offer is unresolved after the remap, and withoutUnresolvedUnder drops it", () => {
  const { "~:tool-options": _, ...profs } = SAGE["~:profs"];
  const item = { ...formRecord(SAGE), "~:name": "Sage (Custom)", "~:profs": profs };
  const next = customizeOption(withSage(), undefined, { contentType: BACKGROUND_TYPE, path: ["background", "sage"], item });
  const content = characterContent({ homebrew: SAGE_PACKS }, next.custom);
  expect(missingContent(next.entity, content).map((u) => u.path)).toEqual([[...ARTISAN.slice(0, 1), "sage-custom-", ARTISAN[2], "smiths-tools"]]);
  const kept = withoutUnresolvedUnder(next.entity, ["background", "sage-custom-"], content);
  // The entity is the one with Sage picked and no artisan's tool, with the pick moved to the copy: only the tool choice goes.
  const e = engine();
  const expected = remapOption(e.select(fighter20(), ["background"], "sage", { homebrew: SAGE_PACKS }), ["background", "sage"], "sage-custom-");
  expect(kept).toEqual(expected);
  expect(missingContent(kept, content)).toEqual([]);
  expect(backgroundParts(kept, next.custom).tools).toEqual(["thieves-tools"]);
  // An entity without unresolved options is returned as it is.
  expect(withoutUnresolvedUnder(kept, ["background", "sage-custom-"], content)).toBe(kept);
});

test("optionKeyOf gives a background the key of its name, with its dashes, and another item its stored key", () => {
  expect(optionKeyOf(BACKGROUND_TYPE, { "~:key": "~:old-sage", "~:name": "Sage (Custom)" })).toBe("sage-custom-");
  expect(optionKeyOf(BACKGROUND_TYPE, { "~:key": "~:old-sage" })).toBe("old-sage");
  expect(optionKeyOf(BACKGROUND_TYPE, {}, "~:at-key")).toBe("at-key");
  expect(optionKeyOf("orcpub.dnd.e5/feats", { "~:key": "~:skill-expert", "~:name": "Other Name" })).toBe("skill-expert");
});

test("srdBackgroundRecord gives the SRD background of the engine's content list, with the template's holy symbol choice, and a copy keeps the sheet", async () => {
  const record = await srdBackgroundRecord("acolyte");
  expect(record).toEqual({
    "~:name": "Acolyte",
    "~:help": "Your life has been devoted to serving a god or gods.",
    "~:profs": { "~:skill": { "~:insight": true, "~:religion": true }, "~:language-options": { "~:choose": 2, "~:options": { "~:any": true } } },
    "~:equipment": { "~:clothes-common": 1, "~:pouch": 1, "~:incense": 5, "~:vestements": 1 },
    "~:treasure": { "~:gp": 15 },
    // The list has Prayer Book/Wheel. The holy symbol choice is only in the engine's template ("Starting Equipment: Holy Symbol").
    "~:equipment-choices": [
      { "~:name": "Prayer Book/Wheel", "~:options": { "~:prayer-book": 1, "~:prayer-wheel": 1 } },
      { "~:name": "Holy Symbol", "~:options": { "~:amulet": 1, "~:emblem": 1, "~:reliquary": 1 } },
    ],
    // The feature's summary is its description, the field that the form edits.
    "~:traits": [
      {
        "~:name": "Shelter the Faithful",
        "~:page": 127,
        "~:description": "You and your companions can expect free healing at an establishment of your faith.",
      },
    ],
  });
  expect(await srdBackgroundRecord("no-such-background")).toBeUndefined();
  // The character's features have no feature named Acolyte, so builtInText has no text for it.
  expect(builtInText(engine().evaluate(fighter20()).built, "Acolyte")).toBe("");

  // fighter-20 picked the Amulet under the holy symbol choice. The copy has the choice with the same key, so the pick resolves.
  const before = engine().evaluate(fighter20()).built;
  const srd = backgroundParts(fighter20(), undefined);
  const next = customizeOption(fighter20(), undefined, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "acolyte"],
    item: { ...record, "~:name": "Acolyte (Custom)" },
  });
  const content = characterContent({ homebrew: SAGE_PACKS }, next.custom);
  expect(missingContent(next.entity, content)).toEqual([]);
  expect(withoutUnresolvedUnder(next.entity, ["background", "acolyte-custom-"], content)).toBe(next.entity);
  const after = engine().evaluate(next.entity, content).built;
  expect(after.equipment).toEqual(before.equipment);
  expect(after.equipment?.amulet).toBeDefined();
  expect(after.treasure).toEqual(before.treasure);
  expect(backgroundParts(next.entity, next.custom)).toEqual({ ...srd, background: "Acolyte (Custom)" });
});

test("withCopyStartingEquipment gives the copy's items and gold only when they change, and keeps the user's other items once", () => {
  const e = engine();
  const user = e.addInventoryItem(withSage(), "equipment", "lamp");
  const item = { ...formRecord(SAGE), "~:name": "Sage (Custom)" };
  const first = customizeOption(user, undefined, { contentType: BACKGROUND_TYPE, path: ["background", "sage"], item });
  const content = characterContent({ homebrew: SAGE_PACKS }, first.custom);
  const equipment = (entity: StrictEntity) => engine().evaluate(entity, content).built.equipment ?? {};
  // No change to the items and the gold, or only to the equipment choices: the entity stays as it is.
  expect(withCopyStartingEquipment(first.entity, "sage-custom-", item, { ...item, "~:help": "New." }, content)).toBe(first.entity);
  const choice = { ...item, "~:equipment-choices": [{ "~:name": "Musical Instruments", "~:options": { "~:lute": 1 } }] };
  expect(withCopyStartingEquipment(first.entity, "sage-custom-", item, choice, content)).toBe(first.entity);

  const changed = { ...item, "~:equipment": { "~:ink": 1, "~:book": 1 }, "~:treasure": { "~:gp": 25 } };
  const copy = customizeOption(first.entity, first.custom, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "sage-custom-"],
    item: changed,
    replacedKey: "sage-custom-",
  });
  const copyContent = characterContent({ homebrew: SAGE_PACKS }, copy.custom);
  const result = withCopyStartingEquipment(copy.entity, "sage-custom-", item, changed, copyContent);
  const built = engine().evaluate(result, copyContent).built;
  const background = Object.keys(built.equipment ?? {}).filter((k) => built.equipment?.[k]["orcpub.dnd.e5.character.equipment/background-starting-equipment?"]);
  expect(background.sort()).toEqual(["book", "ink"]);
  expect(built.treasure?.gp["orcpub.dnd.e5.character.equipment/quantity"]).toBe(25);
  // The item that the user added stays, and each item is in the entity once.
  expect(built.equipment?.lamp).toEqual(equipment(first.entity).lamp);
  const keys = (result as Record<string, Record<string, unknown>[]>)["~:orcpub.entity.strict/selections"]
    .filter((sel) => sel["~:orcpub.entity.strict/key"] === "~:equipment")
    .flatMap((sel) => (sel["~:orcpub.entity.strict/options"] as Record<string, string>[]).map((o) => o["~:orcpub.entity.strict/key"]));
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys).toContain("~:lamp");
});

// Customize a race (ORC-136). The engine keys a race, as a feat, by its stored key.

/**
 * What the sheet shows of a race: the race and subrace, the ability scores, the speed, darkvision, languages,
 * weapon proficiencies, resistances, and the race's features with their uses. base is the character before his race changed.
 */
function raceParts(entity: StrictEntity, custom: object | undefined, base: StrictEntity = fighter20()) {
  // The character's own features, from his class, feat and background.
  const own = new Set(features(engine().evaluate(base).built).map((f) => f.name));
  const { built } = engine().evaluate(entity, characterContent({ homebrew: RACE_PACKS }, custom));
  return {
    race: built.race,
    subrace: built.subrace,
    abilities: built.abilities,
    speed: built["base-land-speed"],
    darkvision: built.darkvision,
    languages: built.languages,
    weapons: built["weapon-profs"],
    resistances: built.resistances,
    features: features(built)
      .filter((f) => !own.has(f.name))
      .map((f) => ({ name: f.name, frequency: f.frequency ?? null })),
  };
}

test("a race copy has the key of its name without the dashes, and the engine keys the race by the stored key", () => {
  expect(copyKey(RACE_TYPE, "Sylvar (Custom)")).toBe("sylvar-custom");
  expect(copyKey(RACE_TYPE, "Dwarf")).toBe("dwarf");
  // The stored key, not the key of the name, is the option's key.
  const custom = { [TAGGED_RACES]: { "~:other-key": { ...SYLVAR, "~:key": "~:other-key", "~:name": "Sylvar (Custom)", "~:option-pack": CUSTOM_PACK } } };
  const keys = engine()
    .buildTemplate(characterContent({ homebrew: undefined }, custom).homebrew)
    .shape.find((s) => s.key === "race")!
    .options.map((o) => o.key);
  expect(keys).toContain("other-key");
  expect(keys).not.toContain("sylvar-custom");
  expect(optionOrigin(RACE_PACKS, undefined, RACE_TYPE, "sylvar")).toEqual({ from: "pack", pack: "Race Pack", item: SYLVAR });
  expect(optionOrigin(RACE_PACKS, undefined, RACE_TYPE, "dwarf")).toEqual({ from: "built-in" });
});

test("saveCopy selects a pack race copy, and the sheet shows its abilities, speed, languages and the feature with its uses", () => {
  const entity = withSylvar();
  const original = raceParts(entity, undefined);
  expect(original).toEqual({
    race: "Sylvar",
    subrace: null,
    abilities: {
      "orcpub.dnd.e5.character/str": 19,
      "orcpub.dnd.e5.character/dex": 17,
      "orcpub.dnd.e5.character/con": 19,
      "orcpub.dnd.e5.character/int": 12,
      "orcpub.dnd.e5.character/wis": 14,
      "orcpub.dnd.e5.character/cha": 9,
    },
    speed: 35,
    darkvision: 60,
    languages: ["common", "draconic", "elvish", "sylvan"],
    weapons: ["simple", "martial"],
    resistances: [],
    features: [{ name: "Leafstep", frequency: { units: "orcpub.dnd.e5.units/long-rest", amount: 1 } }],
  });
  const item = { ...formRecord(SYLVAR), "~:name": "Sylvar (Custom)" };
  const next = saveCopy(entity, undefined, { homebrew: RACE_PACKS }, { contentType: RACE_TYPE, path: ["race", "sylvar"], item });
  expect(next.key).toBe("sylvar-custom");
  expect(next.removed).toEqual([]);
  expect(next.custom).toEqual({ [TAGGED_RACES]: { "~:sylvar-custom": { ...item, "~:key": "~:sylvar-custom", "~:option-pack": CUSTOM_PACK } } });
  expect(next.content).toEqual(characterContent({ homebrew: RACE_PACKS }, next.custom));
  expect(next.entity).toEqual(remapOption(entity, ["race", "sylvar"], "sylvar-custom"));
  expect(raceParts(next.entity, next.custom)).toEqual({ ...original, race: "Sylvar (Custom)" });
  expect(missingContent(next.entity, next.content)).toEqual([]);
  expect(pruneCustom(next.entity, next.custom)).toBe(next.custom);
});

test("a pack subrace names its race by key, so it does not attach to the copy: saveCopy removes it and names it", () => {
  const entity = withSylvar(true);
  expect(raceParts(entity, undefined).subrace).toBe("Deep Sylvar");
  const item = { ...formRecord(SYLVAR), "~:name": "Sylvar (Custom)" };
  const next = saveCopy(entity, undefined, { homebrew: RACE_PACKS }, { contentType: RACE_TYPE, path: ["race", "sylvar"], item });
  expect(next.removed).toEqual([["race", "sylvar", "subrace", "deep-sylvar"]]);
  // Only the subrace goes, with the pick moved to the copy.
  expect(next.entity).toEqual(remapOption(withoutOption(entity, ["race", "sylvar", "subrace", "deep-sylvar"]), ["race", "sylvar"], "sylvar-custom"));
  expect(missingContent(next.entity, next.content)).toEqual([]);
  // The copy keeps the race's values; the subrace's +1 Intelligence goes.
  expect(raceParts(next.entity, next.custom)).toEqual({ ...raceParts(withSylvar(), undefined), race: "Sylvar (Custom)" });
});

test("saveCopy of an edit names a pick that the edited copy no longer offers, by its path before the save", () => {
  const first = saveCopy(
    withSage(),
    undefined,
    { homebrew: SAGE_PACKS },
    {
      contentType: BACKGROUND_TYPE,
      path: ["background", "sage"],
      item: { ...formRecord(SAGE), "~:name": "Sage (Custom)" },
    },
  );
  expect(first.removed).toEqual([]);
  // Edit custom removes the artisan's tool choice of the copy.
  const { "~:tool-options": _, ...profs } = SAGE["~:profs"];
  const edited = saveCopy(
    first.entity,
    first.custom,
    { homebrew: SAGE_PACKS },
    {
      contentType: BACKGROUND_TYPE,
      path: ["background", "sage-custom-"],
      item: { ...formRecord(SAGE), "~:name": "Sage (Custom)", "~:profs": profs },
      replacedKey: "sage-custom-",
    },
  );
  expect(edited.removed).toEqual([["background", "sage-custom-", "tool-proficiency-artisans-tools", "smiths-tools"]]);
  expect(edited.entity).toEqual(withoutOption(first.entity, ["background", "sage-custom-", "tool-proficiency-artisans-tools", "smiths-tools"]));
});

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
    "~:traits": [],
  });
  // fighter-20 is a standard Human of the subrace Illuskan.
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
