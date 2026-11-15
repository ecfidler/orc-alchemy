// Character-local content (ORC-133): the helpers of custom.ts, and a custom
// feat with scaled uses on the open character's sheet.
import "fake-indexeddb/auto";
import { act, cleanup, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { customHash, summaryFingerprint } from "../storage/characters.ts";
import { CUSTOM_PACK, characterContent, hasCustomItems, pruneCustom } from "./custom.ts";
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
