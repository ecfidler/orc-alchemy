// Character-local content (ORC-133): the helpers of custom.ts, and a custom
// feat with scaled uses on the open character's sheet.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { customHash, summaryFingerprint } from "../storage/characters.ts";
import { builtInText, CUSTOM_PACK, characterContent, customizeOption, customKey, formRecord, hasCustomItems, optionOrigin, pruneCustom } from "./custom.ts";
import { type Content, engine, loadEngine, type StrictEntity } from "./engine.ts";

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

const fighter20 = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-20.strict.json"), "utf8"));
const SKILL_EXPERT = {
  "~:key": "~:skill-expert",
  "~:name": "Skill Expert",
  "~:option-pack": "Pack",
  "~:description": "You know skills.",
  "~:props": { "~:skill-tool-choice": 1 },
};
const PACKS = { Pack: { [FEATS]: { "~:skill-expert": SKILL_EXPERT } } };
const SKILL = ["feats", "skill-expert", "skill-tool-1"];

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
  expect(optionOrigin(PACKS, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toEqual({ from: "pack", pack: "Pack", item: SKILL_EXPERT });
  expect(optionOrigin(PACKS, undefined, "orcpub.dnd.e5/feats", "grappler")).toEqual({ from: "built-in" });
  expect(optionOrigin(undefined, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toEqual({ from: "built-in" });
  // The last pack with the key wins; an item with the old app's off flag is not there.
  const two = { ...PACKS, Later: { [FEATS]: { "~:skill-expert": { "~:name": "Later" } } } };
  expect(optionOrigin(two, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toMatchObject({ pack: "Later" });
  const off = { ...PACKS, Later: { [FEATS]: { "~:skill-expert": { "~:name": "Later", "~:disabled?": true } } } };
  expect(optionOrigin(off, undefined, "orcpub.dnd.e5/feats", "skill-expert")).toMatchObject({ pack: "Pack" });
  expect(formRecord(SKILL_EXPERT)).toEqual({ "~:name": "Skill Expert", "~:description": "You know skills.", "~:props": { "~:skill-tool-choice": 1 } });
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
  expect(Object.keys((same.custom as Record<string, object>)[FEATS])).toEqual(["~:skill-expert-custom"]);
  expect((same.custom as Record<string, Record<string, Record<string, unknown>>>)[FEATS]["~:skill-expert-custom"]["~:description"]).toBe("Changed.");

  const renamed = customizeOption(same.entity, same.custom, {
    contentType: "orcpub.dnd.e5/feats",
    path,
    item: { ...formRecord(SKILL_EXPERT), "~:name": "Skill Savant" },
    replacedKey: "skill-expert-custom",
  });
  expect(Object.keys((renamed.custom as Record<string, object>)[FEATS])).toEqual(["~:skill-savant"]);
  // Other content types stay.
  expect((renamed.custom as Record<string, object>)[LANGUAGES]).toEqual(CUSTOM[LANGUAGES]);
  expect(feats(renamed.entity, renamed.custom)).toEqual(["skill-savant"]);
  expect(skills(renamed.entity, renamed.custom)).toContain("arcana");
  expect(() =>
    customizeOption(renamed.entity, renamed.custom, { contentType: "orcpub.dnd.e5/feats", path: ["feats", "skill-savant"], item: { "~:name": "!" } }),
  ).toThrow("The copy needs a name");
});

test("builtInText gives the text of the SRD feat's feature", () => {
  expect(builtInText(fighter20(), SRD, "Grappler")).toBe("Restrain a creature you are grappling");
  expect(builtInText(fighter20(), SRD, "No Such Feat")).toBe("");
});
