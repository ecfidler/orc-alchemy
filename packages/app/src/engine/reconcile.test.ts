import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { missingContent, remapOption } from "./reconcile.ts";

beforeAll(() => loadEngine());

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const character = (name: string): StrictEntity =>
  engine().importCharacter(readFileSync(join(fixturesDir, `legacy/${name}.strict.json`), "utf8")).entity;
const orcbrew = (file: string) => readFileSync(join(fixturesDir, "orcbrew", file), "utf8").replace(/^﻿/, "");
const dupB = () => engine().parseOrcbrew(orcbrew("duplicate-external-b.orcbrew"), { name: "duplicate-external-b" }).data!;
/** duplicate-external-b with its race ironwrought renamed to ironwrought-v2: the engine suggests that for ironwrought. */
const dupBv2 = () =>
  engine().renameKey(dupB(), { pack: "duplicate-external-b", contentType: "orcpub.dnd.e5/races", from: "ironwrought", to: "ironwrought-v2" });
const keys = (entity: StrictEntity, homebrew?: Record<string, object>) => missingContent(entity, homebrew).map((u) => `${u.label}: ${u.key}`);

describe("missingContent", () => {
  test("r8-unresolved-keys without its pack lists its race, subrace, class and subclass", () => {
    expect(keys(character("r8-unresolved-keys"))).toEqual(["Race: ironwrought", "Subrace: envoy", "Class: artificer", "Subclass: alchemist"]);
  });

  test("character-test-2 lists its content keys and its other options, which have no suggestions", () => {
    const unresolved = missingContent(character("character-test-2"), undefined);
    expect(unresolved.map((u) => `${u.label}: ${u.key}`)).toEqual([
      "Background: noble",
      "Feat: ritual-caster",
      "Subclass: eldritch-knight",
      "Option: armor-of-resistance-half-plate",
      "Option: animal-handling",
      "Option: intimidation",
    ]);
    expect(unresolved.filter((u) => u.label === "Option").every((u) => u.suggestions.length === 0)).toBe(true);
  });

  test("a loaded pack with a similar key gives a suggestion", () => {
    const race = missingContent(character("r8-unresolved-keys"), dupBv2()).find((u) => u.key === "ironwrought");
    expect(race?.suggestions).toEqual([expect.objectContaining({ key: "ironwrought-v2", name: "Ironwrought", source: "Homebrew Pack B" })]);
  });

  test("r8-unresolved-keys with duplicate-external-b loaded lists nothing", () => {
    expect(keys(character("r8-unresolved-keys"), dupB())).toEqual([]);
  });
});

describe("remapOption", () => {
  test("remapping the race to the suggestion resolves it and the subrace under it, and the entity builds", () => {
    const homebrew = dupBv2();
    const entity = remapOption(character("r8-unresolved-keys"), ["race", "ironwrought"], "ironwrought-v2");
    expect(keys(entity, homebrew)).toEqual([]);
    expect(engine().evaluate(entity, { homebrew }).built.race).toBeTruthy();
  });

  test("remapping a subclass deep in a multi-select changes only that key", () => {
    const path = ["class", "fighter", "levels", "level-3", "martial-archetype", "eldritch-knight"];
    const entity = remapOption(character("character-test-2"), path, "champion");
    expect(keys(entity)).not.toContain("Subclass: eldritch-knight");
    expect(keys(entity)).toContain("Background: noble");
    expect(() => engine().evaluate(entity)).not.toThrow();
  });

  test("a path that is not in the character, or a key the multi-select already has, throws", () => {
    const entity = character("character-test-2");
    expect(() => remapOption(entity, ["race", "elf"], "x")).toThrow("The option race / elf is not in the character");
    expect(() => remapOption(entity, ["feats"], "x")).toThrow("is not in the character");
    expect(() => remapOption(entity, ["class", "fighter"], "fighter")).toThrow("The character already has fighter under class");
  });
});
