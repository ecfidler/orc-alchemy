// Character-local content (ORC-133): the helpers of custom.ts, and a custom
// feat with scaled uses on the open character's sheet.
import "fake-indexeddb/auto";
import type { Inventory } from "@pubdoor/dmv";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { customHash, summaryFingerprint } from "../storage/characters.ts";
import {
  builtInText,
  CUSTOM_PACK,
  characterContent,
  copyKey,
  customizeOption,
  customKey,
  formRecord,
  hasCustomItems,
  optionOrigin,
  pruneCustom,
  srdBackgroundRecord,
  withoutUnresolvedUnder,
} from "./custom.ts";
import { type Content, engine, loadEngine, type StrictEntity } from "./engine.ts";
import { missingContent } from "./reconcile.ts";
import { ARTISAN, BACKGROUND_PACK, SAGE, SAGE_PACKS, withSage } from "./test-backgrounds.ts";
import { FEAT_PACK, fighter20, SKILL, SKILL_EXPERT } from "./test-feats.ts";

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
});

const FEATS = "~:orcpub.dnd.e5/feats";
const BACKGROUNDS = "~:orcpub.dnd.e5/backgrounds";
const RACES = "~:orcpub.dnd.e5/races";
const LANGUAGES = "~:orcpub.dnd.e5/languages";
const SELECTIONS = "~:orcpub.entity.strict/selections";
const KEY = "~:orcpub.entity.strict/key";

const feat = (key: string, name: string, more: object = {}) => ({ "~:key": `~:${key}`, "~:name": name, "~:option-pack": CUSTOM_PACK, ...more });
const CUSTOM = {
  [FEATS]: { "~:skill-expert-custom": feat("skill-expert-custom", "Skill Expert Custom", { "~:description": "You are an expert." }) },
  [BACKGROUNDS]: { "~:sage-custom": feat("sage-custom", "Sage Custom") },
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

test("customKey is the key of the name without a dash at either end", () => {
  expect(customKey("Skill Expert (Custom)")).toBe("skill-expert-custom");
  expect(customKey("Grappler's Edge!")).toBe("grapplers-edge");
  expect(customKey("()")).toBe("");
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

const BG_TYPE = "orcpub.dnd.e5/backgrounds";
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

test("copyKey gives a background copy the engine's key of its name, with its dashes, and a feat copy customKey", () => {
  expect(copyKey(BG_TYPE, "Sage (Custom)")).toBe("sage-custom-");
  expect(copyKey("orcpub.dnd.e5/feats", "Sage (Custom)")).toBe("sage-custom");
  expect(copyKey(BG_TYPE, "Sage")).toBe("sage");
  expect(copyKey(BG_TYPE, "()")).toBe("");
  // The engine gives the option the key of the name and ignores the stored key.
  for (const stored of ["sage-custom", "sage-custom-"]) {
    const custom = { [BACKGROUNDS]: { [`~:${stored}`]: { ...SAGE, "~:key": `~:${stored}`, "~:name": "Sage (Custom)", "~:option-pack": CUSTOM_PACK } } };
    const shape = engine().buildTemplate(characterContent({ homebrew: undefined }, custom).homebrew).shape;
    expect(shape.find((s) => s.key === "background")!.options.map((o) => o.key)).toContain("sage-custom-");
    expect(shape.find((s) => s.key === "background")!.options.map((o) => o.key)).not.toContain("sage-custom");
  }
});

test("optionOrigin finds a background by the key of its name, as the engine does", () => {
  // A pack background whose stored key is not the key of its name (ORC-130).
  const odd = { ...SAGE, "~:key": "~:old-sage" };
  const packs = { [BACKGROUND_PACK]: { [BACKGROUNDS]: { "~:old-sage": odd } } };
  expect(optionOrigin(packs, undefined, BG_TYPE, "sage")).toEqual({ from: "pack", pack: BACKGROUND_PACK, item: odd });
  expect(optionOrigin(packs, undefined, BG_TYPE, "old-sage")).toEqual({ from: "built-in" });
  const copy = { ...SAGE, "~:key": "~:sage-custom-", "~:name": "Sage (Custom)" };
  expect(optionOrigin(packs, { [BACKGROUNDS]: { "~:sage-custom-": copy } }, BG_TYPE, "sage-custom-")).toEqual({ from: "custom", item: copy });
  expect(optionOrigin(packs, undefined, BG_TYPE, "acolyte")).toEqual({ from: "built-in" });
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
  const first = customizeOption(entity, undefined, { contentType: BG_TYPE, path: ["background", "sage"], item });
  expect(first.custom).toEqual({ [BACKGROUNDS]: { "~:sage-custom-": { ...item, "~:key": "~:sage-custom-", "~:option-pack": CUSTOM_PACK } } });
  expect(backgroundParts(first.entity, first.custom)).toEqual({ ...original, background: "Sage (Custom)" });
  expect(
    evaluateWith(first.entity, first.custom).selections.find((s) => s.actualPath.join("/") === "background/sage-custom-/tool-proficiency-artisans-tools")!
      .selected,
  ).toEqual(["smiths-tools"]);
  expect(missingContent(first.entity, characterContent({ homebrew: SAGE_PACKS }, first.custom))).toEqual([]);
  expect(pruneCustom(first.entity, first.custom)).toBe(first.custom);

  const edited = { ...item, "~:help": "Changed." };
  const same = customizeOption(first.entity, first.custom, {
    contentType: BG_TYPE,
    path: ["background", "sage-custom-"],
    item: edited,
    replacedKey: "sage-custom-",
  });
  expect(same.entity).toBe(first.entity);
  expect(same.custom).toEqual({ [BACKGROUNDS]: { "~:sage-custom-": { ...edited, "~:key": "~:sage-custom-", "~:option-pack": CUSTOM_PACK } } });

  const renamed = customizeOption(same.entity, same.custom, {
    contentType: BG_TYPE,
    path: ["background", "sage-custom-"],
    item: { ...edited, "~:name": "Loremaster!" },
    replacedKey: "sage-custom-",
  });
  expect(renamed.custom).toEqual({
    [BACKGROUNDS]: { "~:loremaster-": { ...edited, "~:name": "Loremaster!", "~:key": "~:loremaster-", "~:option-pack": CUSTOM_PACK } },
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
  const next = customizeOption(withSage(), undefined, { contentType: BG_TYPE, path: ["background", "sage"], item });
  const content = characterContent({ homebrew: SAGE_PACKS }, next.custom);
  expect(missingContent(next.entity, content).map((u) => u.path)).toEqual([[...ARTISAN.slice(0, 1), "sage-custom-", ARTISAN[2], "smiths-tools"]]);
  const kept = withoutUnresolvedUnder(next.entity, ["background", "sage-custom-"], content);
  expect(missingContent(kept, content)).toEqual([]);
  expect(backgroundParts(kept, next.custom).tools).toEqual(["thieves-tools"]);
  // Nothing else changes, and an entity without unresolved options is returned as it is.
  expect(withoutUnresolvedUnder(kept, ["background", "sage-custom-"], content)).toBe(kept);
  expect(evaluateWith(kept, next.custom).built.background).toBe("Sage (Custom)");
});

test("srdBackgroundRecord gives the SRD background of the engine's content list as a form record, which builds as the SRD one does", async () => {
  const record = await srdBackgroundRecord("acolyte");
  expect(record).toEqual({
    "~:name": "Acolyte",
    "~:help": "Your life has been devoted to serving a god or gods.",
    "~:profs": { "~:skill": { "~:insight": true, "~:religion": true }, "~:language-options": { "~:choose": 2, "~:options": { "~:any": true } } },
    "~:equipment": { "~:clothes-common": 1, "~:pouch": 1, "~:incense": 5, "~:vestements": 1 },
    "~:treasure": { "~:gp": 15 },
    "~:equipment-choices": [{ "~:name": "Prayer Book/Wheel", "~:options": { "~:prayer-book": 1, "~:prayer-wheel": 1 } }],
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

  const srd = backgroundParts(fighter20(), undefined);
  const next = customizeOption(fighter20(), undefined, {
    contentType: BG_TYPE,
    path: ["background", "acolyte"],
    item: { ...record, "~:name": "Acolyte (Custom)" },
  });
  const content = characterContent({ homebrew: SAGE_PACKS }, next.custom);
  // The SRD Acolyte's holy symbol choice is not in the content list, so the copy does not offer it.
  expect(missingContent(next.entity, content).map((u) => u.path)).toEqual([["background", "acolyte-custom-", "starting-equipment-holy-symbol", "amulet"]]);
  const kept = withoutUnresolvedUnder(next.entity, ["background", "acolyte-custom-"], content);
  expect(backgroundParts(kept, next.custom)).toEqual({ ...srd, background: "Acolyte (Custom)" });
});
