import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { addCharacter } from "../state/character.ts";
import { getCharacter } from "../storage/characters.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { characterFile, exportBundle, readCharacterFile } from "./import.ts";

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

/** A dmv-character envelope (doc 03), its entity from exportCharacter: verbose Transit-JSON, which importCharacter needs. */
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

/** Reads a written file back, as the import picker does. */
const reimport = (file: unknown) => readCharacterFile(JSON.stringify(file));

test.each(strictFiles)("%s, stored, exports to a dmv-character file that imports back to the same entity", async (file) => {
  const [imported] = readCharacterFile(readText(file)).characters;
  const record = (await getCharacter(await addCharacter(imported.entity, imported.rules, imported.legacyId)))!;

  const exported = characterFile(record);
  expect(exported).toMatchObject({ format: "dmv-character", version: 1, rules: "2014", id: record.id, name: record.name });
  const { characters, failures } = reimport(exported);
  expect(failures).toEqual([]);
  expect(characters).toEqual([{ entity: record.entity, rules: "2014", legacyId: record.legacyId, name: imported.name }]);
});

test("every stored character exports to one dmv-export bundle that imports back", () => {
  const entities = strictFiles.map((file) => readCharacterFile(readText(file)).characters[0].entity);
  const bundle = exportBundle(entities, "https://alchemy.example");

  expect(bundle).toMatchObject({ format: "dmv-export", version: 1, exportedFrom: "https://alchemy.example", magicItems: [] });
  const { characters, failures } = reimport(bundle);
  expect(failures).toEqual([]);
  expect(characters.map((c) => c.entity)).toEqual(entities);
});

// Selection order drives modifier order (doc 02, wrinkle 3), so the files must keep it.
const SELECTIONS = "~:orcpub.entity.strict/selections";
type Selection = Record<string, unknown>;
const selectionsOf = (entity: StrictEntity) => (entity as Record<string, Selection[]>)[SELECTIONS];

test.each([
  ["fighter-1, top-level selections reversed", "characters/fighter-1.strict.json", (s: Selection[]) => [...s].reverse()],
  [
    "fighter-3-wizard-2, classes reversed",
    "characters/fighter-3-wizard-2.strict.json",
    (s: Selection[]) =>
      s.map((selection) =>
        selection["~:orcpub.entity.strict/key"] === "~:class"
          ? { ...selection, "~:orcpub.entity.strict/options": [...(selection["~:orcpub.entity.strict/options"] as unknown[])].reverse() }
          : selection,
      ),
  ],
])("a reordered entity still builds differently after export and import: %s", (_, file, reorder) => {
  const entity = readCharacterFile(readText(file)).characters[0].entity;
  const reordered = { ...(entity as object), [SELECTIONS]: reorder(selectionsOf(entity)) };
  const roundTrip = (e: StrictEntity) => reimport(characterFile({ format: "dmv-character", version: 1, entity: e })).characters[0].entity;

  const built = engine().evaluate(roundTrip(entity)).built;
  const reorderedBuilt = engine().evaluate(roundTrip(reordered)).built;
  expect(reorderedBuilt).not.toEqual(built);
  expect(built).toEqual(engine().evaluate(entity).built);
  expect(reorderedBuilt).toEqual(engine().evaluate(reordered).built);
});

test("an envelope without rules is stored as 2014, and its legacyId is kept", async () => {
  const { rules: _, ...noRules } = envelope("legacy/character-test-2.strict.json", { legacyId: "17592186056344" });
  const [character] = reimport(noRules).characters;
  expect(character.legacyId).toBe("17592186056344");

  const stored = await getCharacter(await addCharacter(character.entity, character.rules, character.legacyId));
  expect(stored).toMatchObject({ rules: "2014", legacyId: "17592186056344" });
});
