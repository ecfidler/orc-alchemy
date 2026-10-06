import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, expect, test } from "vitest";
import { loadEngine } from "../engine/engine.ts";
import { useHomebrew } from "./homebrew.ts";

const orcbrewDir = join(import.meta.dirname, "../../../../fixtures/orcbrew");
const readPack = (name: string) => readFileSync(join(orcbrewDir, `${name}.orcbrew`), "utf8");

beforeAll(() => loadEngine());

afterEach(() => useHomebrew.setState({ homebrew: undefined, lastImport: null }));

test.each([
  "duplicate-external-a",
  "duplicate-external-b",
  "warlock-test-content",
  "community-mezzoloth-race",
  "community-dandwiki-star-elf",
  "community-gmbinder-homebrew",
])("%s.orcbrew loads as a pack named for the file", (name) => {
  useHomebrew.getState().load(`${name}.orcbrew`, readPack(name));
  const { homebrew, lastImport } = useHomebrew.getState();
  expect(lastImport?.success).toBe(true);
  expect(lastImport?.log.message).toContain("Import successful");
  expect(Object.keys(homebrew!)).toEqual([name]);
});

test("the pack name drops the extension in any case", () => {
  useHomebrew.getState().load("warlock-test-content.ORCBREW", readPack("warlock-test-content"));
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["warlock-test-content"]);
});

test("a second file merges in and reports its key conflicts; removing a pack keeps the others", () => {
  useHomebrew.getState().load("duplicate-external-a.orcbrew", readPack("duplicate-external-a"));
  useHomebrew.getState().load("duplicate-external-b.orcbrew", readPack("duplicate-external-b"));
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-a", "duplicate-external-b"]);
  expect(useHomebrew.getState().lastImport?.conflicts.map((c) => c.key)).toContain("artificer");

  useHomebrew.getState().remove("duplicate-external-a");
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-b"]);
  useHomebrew.getState().remove("duplicate-external-b");
  expect(useHomebrew.getState().homebrew).toBeUndefined();
});

test("a file that does not parse keeps the loaded homebrew and its log says why", () => {
  useHomebrew.getState().load("warlock-test-content.orcbrew", readPack("warlock-test-content"));
  const loaded = useHomebrew.getState().homebrew;

  useHomebrew.getState().load("broken.orcbrew", "{:orcpub.dnd.e5/spells {:fireball");
  expect(useHomebrew.getState().homebrew).toBe(loaded);
  expect(useHomebrew.getState().lastImport?.success).toBe(false);
  expect(useHomebrew.getState().lastImport?.log.message).toContain("Could not read file");
});
