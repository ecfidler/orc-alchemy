import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "./engine.ts";
import { readCharacterFile } from "./import.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const strictFiles = ["characters", "legacy"].flatMap((dir) =>
  readdirSync(join(fixturesDir, dir))
    .filter((file) => file.endsWith(".strict.json"))
    .map((file) => `${dir}/${file}`),
);
const readText = (file: string) => readFileSync(join(fixturesDir, file), "utf8");

beforeAll(() => loadEngine());

test("finds every character and legacy fixture", () => {
  expect(strictFiles).toHaveLength(23);
});

test.each(strictFiles)("%s imports and builds", (file) => {
  const { characters: [character], failures } = readCharacterFile(readText(file));
  expect(failures).toEqual([]);
  expect(character.entity).toEqual(engine().importCharacter(readText(file)).entity);
  expect(() => engine().evaluate(character.entity)).not.toThrow();
});

test("a raw entity keeps its name and the old app's id", () => {
  expect(readCharacterFile(readText("characters/fighter-1.strict.json")).characters).toMatchObject([
    { name: "Brannor Ironfist", legacyId: null },
  ]);
  expect(readCharacterFile(readText("legacy/character-test-2.strict.json")).characters).toMatchObject([
    { name: null, legacyId: "17592186056344" },
  ]);
});

/** A dmv-character envelope as doc 03 describes it. */
function envelope(file: string, fields: object = {}) {
  const { entity } = engine().importCharacter(readText(file));
  return { format: "dmv-character", version: 1, rules: "2014", id: "x", name: "n", entity: engine().exportCharacter(entity), ...fields };
}

test("a dmv-character envelope imports to the same entity as the raw file", () => {
  const file = "characters/wizard-5.strict.json";
  const [character] = readCharacterFile(JSON.stringify(envelope(file))).characters;
  expect(character.entity).toEqual(readCharacterFile(readText(file)).characters[0].entity);
  expect(character.name).toBe("Fimble Nackle");
});

test("an envelope without rules is 2014", () => {
  const { rules: _, ...noRules } = envelope("characters/fighter-1.strict.json");
  expect(readCharacterFile(JSON.stringify(noRules)).characters).toHaveLength(1);
});

test("an envelope for other rules is refused", () => {
  expect(() => readCharacterFile(JSON.stringify(envelope("characters/fighter-1.strict.json", { rules: "2024" })))).toThrow(
    "This character uses the 2024 rules, which this app does not support yet",
  );
});

test("a dmv-export bundle imports every character, raw Transit or exported", () => {
  const bundle = {
    format: "dmv-export",
    version: 1,
    exportedFrom: "https://old.example",
    characters: [
      JSON.parse(readText("characters/fighter-1.strict.json")),
      envelope("characters/wizard-5.strict.json").entity,
    ],
    magicItems: [],
  };
  const file = readCharacterFile(JSON.stringify(bundle));
  expect(file.characters.map((c) => c.name)).toEqual(["Brannor Ironfist", "Fimble Nackle"]);
  expect(file.failures).toEqual([]);
});

test("a bundle keeps the characters that import and names the one that fails", () => {
  const bundle = { format: "dmv-export", version: 1, characters: [JSON.parse(readText("characters/fighter-1.strict.json")), {}] };
  const file = readCharacterFile(JSON.stringify(bundle));
  expect(file.characters.map((c) => c.name)).toEqual(["Brannor Ironfist"]);
  expect(file.failures).toEqual(["Character 2 of 2: This is not a character file"]);
});

test.each([
  ["not JSON", "nope", "This file is not JSON"],
  ["a JSON array", "[]", "This is not a character file"],
  ["an object that is not an entity", '{"foo":1}', "This is not a character file"],
  ["an unknown format", '{"format":"orcbrew"}', "Unsupported file format: orcbrew"],
  ["a later envelope version", '{"format":"dmv-character","version":2}', "Unsupported dmv-character version: 2"],
  ["an empty bundle", '{"format":"dmv-export","version":1,"characters":[]}', "This export has no characters"],
])("refuses %s", (_, text, message) => {
  expect(() => readCharacterFile(text)).toThrow(message);
});
