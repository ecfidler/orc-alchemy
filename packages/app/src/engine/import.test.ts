import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { addCharacter } from "../state/character.ts";
import { getCharacter } from "../storage/characters.ts";
import { engine, loadEngine, type Content, type Homebrew, type StrictEntity } from "./engine.ts";
import {
  characterFile,
  exportBundle,
  magicItemKey,
  readBundleHomebrew,
  readBundleMagicItems,
  readCharacterFile,
  type CharacterFileEntry,
} from "./import.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const strictFiles = ["characters", "legacy"].flatMap((dir) =>
  readdirSync(join(fixturesDir, dir))
    .filter((file) => file.endsWith(".strict.json"))
    .map((file) => `${dir}/${file}`),
);
const readText = (file: string) => readFileSync(join(fixturesDir, file), "utf8");

beforeAll(() => loadEngine());

test("finds every character and legacy fixture", () => {
  expect(strictFiles).toHaveLength(24);
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

// A meta file's unresolved lists the keys that do not resolve with its packs loaded (fixtures/README.md).
// The order can differ, so compare the keys sorted by path.
const readMeta = (file: string) => JSON.parse(readText(file.replace(".strict.json", ".meta.json")));
const sortedKeys = (keys: { key: string; path: string[] }[]) =>
  keys.map(({ key, path }) => ({ key, path })).sort((a, b) => a.path.join("/").localeCompare(b.path.join("/")));
const metaKeys = (file: string) => {
  const unresolved = readMeta(file).unresolved;
  return unresolved ? sortedKeys([...unresolved.items, ...unresolved.unresolvedOptions]) : [];
};
const keysOf = (character: CharacterFileEntry) => sortedKeys(character.unresolved);
const importFixture = (file: string, content?: Content) => readCharacterFile(readText(file), content).characters[0];
const customItemsEdn = () => readText("magic-items/custom-items.edn");

test.each(strictFiles)("%s reports the unresolved keys its meta file records, with its packs and magic items loaded", (file) => {
  let homebrew: Homebrew | undefined;
  for (const pack of readMeta(file).orcbrew as string[]) {
    homebrew = engine().parseOrcbrew(readText(`orcbrew/${pack}`), { name: pack.replace(".orcbrew", ""), existing: homebrew }).data!;
  }
  const itemsFile: string | undefined = readMeta(file).magicItems;
  const magicItems = itemsFile ? engine().readServerEdn(readText(`magic-items/${itemsFile}`)) : undefined;
  expect(keysOf(importFixture(file, { homebrew, magicItems }))).toEqual(metaKeys(file));
});

test("without its magic items, fighter-5-custom-magic-items reports each custom item it carries", () => {
  const keys = importFixture("characters/fighter-5-custom-magic-items.strict.json").unresolved.map((u) => u.key);
  expect(keys.sort()).toEqual(["circlet-of-the-hawk", "emberbrand-greatsword", "emberbrand-longsword", "pearl-of-stillwater", "wardens-plate"]);
});

const bundleOf = (magicItems: unknown[]) => JSON.stringify({ format: "dmv-export", version: 1, characters: [], magicItems });

test("a bundle's magic items from the old server's EDN text are each read and checked", () => {
  const read = readBundleMagicItems(bundleOf([customItemsEdn()]));
  expect(read?.failures).toEqual([]);
  expect(read?.items.map(magicItemKey)).toEqual(["emberbrand", "wardens-plate", "circlet-of-the-hawk", "pearl-of-stillwater"]);
  expect(read?.items).toEqual(engine().readServerEdn(customItemsEdn()));
});

test("a bundle's item maps are read; an invalid one is skipped and named, and a later item replaces one with its key", () => {
  const [emberbrand, plate] = engine().readServerEdn(customItemsEdn()) as Record<string, unknown>[];
  const renamed = { ...plate, "~:orcpub.dnd.e5.magic-items/description": "Changed." };
  const invalid = { ...plate, "~:orcpub.dnd.e5.magic-items/name": "Broken Shield", "~:orcpub.dnd.e5.magic-items/type": 7 };
  const read = readBundleMagicItems(bundleOf([emberbrand, plate, invalid, renamed, "[{:db/id", 3]));
  expect(read?.items).toEqual([emberbrand, renamed]);
  expect(read?.failures).toEqual([
    expect.stringMatching(/^Broken Shield: .*type is invalid/),
    "Magic item list 5 of 6: This is not the old server's EDN",
    "Unnamed magic item: This is not a magic item",
  ]);
});

test.each([
  ["not JSON", "nope"],
  ["a bundle without magic items", '{"format":"dmv-export","version":1,"characters":[]}'],
  ["a bundle with an empty EDN item list", bundleOf(["()"])],
])("%s has no bundle magic items", (_, text) => {
  expect(readBundleMagicItems(text)).toBeNull();
});

test("a bundle with only magic items is not refused, and one with an empty magicItems array is", () => {
  expect(readCharacterFile(bundleOf([customItemsEdn()]))).toEqual({ characters: [], failures: [] });
  expect(() => readCharacterFile(bundleOf([]))).toThrow("This export has no characters");
});

test("a bundle's magic items export as item maps and read back the same, and its character resolves them", () => {
  const items = engine().readServerEdn(customItemsEdn());
  const [character] = readCharacterFile(readText("characters/fighter-5-custom-magic-items.strict.json"), { homebrew: undefined, magicItems: items }).characters;
  const text = JSON.stringify(exportBundle([character.entity], "https://alchemy.example", undefined, items));
  const read = readBundleMagicItems(text)!;
  expect(read).toEqual({ items, failures: [] });
  const [back] = readCharacterFile(text, { homebrew: undefined, magicItems: read.items }).characters;
  expect(back.unresolved).toEqual([]);
  expect(back.entity).toEqual(character.entity);
});

test("without homebrew, only the fixtures with non-SRD content report unresolved keys", () => {
  const unresolved = strictFiles.filter((file) => importFixture(file).unresolved.length > 0);
  expect(unresolved).toEqual([
    "characters/fighter-5-custom-magic-items.strict.json",
    "characters/ironwrought-artificer-3.strict.json",
    "characters/warlock-10-drow.strict.json",
    "legacy/character-test-2.strict.json",
    "legacy/character-test-3.strict.json",
    "legacy/r8-unresolved-keys.strict.json",
  ]);
});

test("without its pack, ironwrought-artificer-3 reports the keys r8-unresolved-keys records", () => {
  expect(keysOf(importFixture("characters/ironwrought-artificer-3.strict.json"))).toEqual(
    metaKeys("legacy/r8-unresolved-keys.strict.json"),
  );
});

test("without its pack, warlock-10-drow also reports the pack's subrace, background and feat", () => {
  const keys = keysOf(importFixture("characters/warlock-10-drow.strict.json"));
  expect(keys).toEqual(expect.arrayContaining(metaKeys("characters/warlock-10-drow.strict.json")));
  expect(keys.map((k) => k.key)).toEqual(expect.arrayContaining(["dark-elf-drow-", "spy", "keen-mind"]));
});

test("each unresolved key has its content type's label, or Option", () => {
  const { unresolved } = importFixture("legacy/character-test-2.strict.json");
  expect(unresolved.map(({ label, key }) => `${label}: ${key}`).sort()).toEqual([
    "Background: noble",
    "Feat: ritual-caster",
    "Option: animal-handling",
    "Option: armor-of-resistance-half-plate",
    "Option: intimidation",
    "Subclass: eldritch-knight",
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

// A real GET /dnd/5e/characters/<id> response, copied from the fork's engine-js/test/fixtures at tag pubdoor-v0.3.0 (ORC-11).
const serverEdn = readFileSync(join(import.meta.dirname, "fighter-1.server.edn"), "utf8");

test("the old server's EDN for one character imports through importCharacter", () => {
  const { characters, failures } = readCharacterFile(serverEdn);
  expect(failures).toEqual([]);
  expect(characters).toEqual([
    { entity: engine().importCharacter(engine().readServerEdn(serverEdn)[0]).entity, rules: "2014", legacyId: expect.any(String), name: "Brannor Ironfist", unresolved: [] },
  ]);
});

test("the old server's EDN character list imports each character", () => {
  const { characters, failures } = readCharacterFile(`[${serverEdn} {:db/id 1}]`);
  expect(characters.map((c) => c.name)).toEqual(["Brannor Ironfist"]);
  expect(failures).toEqual(["Character 2 of 2: This is not a character file"]);
});

test("a bundle entry of the old server's EDN list text imports each character in it", () => {
  const bundle = { format: "dmv-export", version: 1, characters: [`[${serverEdn} ${serverEdn}]`], magicItems: ["()"] };
  const file = readCharacterFile(JSON.stringify(bundle));
  expect(file.characters.map((c) => c.name)).toEqual(["Brannor Ironfist", "Brannor Ironfist"]);
  expect(file.failures).toEqual([]);
});

test("a bundle entry of text that is not EDN is reported, and the other entries import", () => {
  const bundle = { format: "dmv-export", version: 1, characters: ["[{:db/id", serverEdn] };
  const file = readCharacterFile(JSON.stringify(bundle));
  expect(file.characters.map((c) => c.name)).toEqual(["Brannor Ironfist"]);
  expect(file.failures).toEqual(["Character list 1 of 2: This is not the old server's EDN"]);
});

test.each([
  ["neither JSON nor EDN", "nope", "This file is not JSON or EDN"],
  ["an empty EDN list", "()", "This file has no characters"],
  ["a JSON array", "[]", "This is not a character file"],
  ["an object that is not an entity", '{"foo":1}', "This is not a character file"],
  ["an unknown format", '{"format":"orcbrew"}', "Unsupported file format: orcbrew"],
  ["a later envelope version", '{"format":"dmv-character","version":2}', "Unsupported dmv-character version: 2"],
  ["an empty bundle", '{"format":"dmv-export","version":1,"characters":[]}', "This export has no characters"],
  ["a bundle with an empty EDN list", '{"format":"dmv-export","version":1,"characters":["[]"]}', "This export has no characters"],
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
  expect(characters).toEqual([
    { entity: record.entity, rules: "2014", legacyId: record.legacyId, name: imported.name, unresolved: imported.unresolved },
  ]);
});

test("every stored character exports to one dmv-export bundle that imports back", () => {
  const entities = strictFiles.map((file) => readCharacterFile(readText(file)).characters[0].entity);
  const bundle = exportBundle(entities, "https://alchemy.example");

  expect(bundle).toMatchObject({ format: "dmv-export", version: 1, exportedFrom: "https://alchemy.example", magicItems: [] });
  expect(bundle).not.toHaveProperty("homebrew");
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

const warlockPack = () => engine().parseOrcbrew(readText("orcbrew/warlock-test-content.orcbrew"), { name: "warlock-test-content" }).data!;

test("a bundle with packs keeps them and their flags, as the multi-plugin map", () => {
  const homebrew = warlockPack();
  const flags = { "warlock-test-content": { enabled: false, disabledItems: [["~:orcpub.dnd.e5/feats", "~:keen-mind"]] as [string, string][] } };
  const bundle = exportBundle([], "https://alchemy.example", { homebrew, flags });
  expect(bundle).toMatchObject({ homebrew, homebrewFlags: flags, characters: [] });
  expect(readBundleHomebrew(JSON.stringify(bundle))).toEqual({ homebrew, flags });
});

test("a bundle with packs and no characters is not refused", () => {
  const text = JSON.stringify(exportBundle([], "https://alchemy.example", { homebrew: warlockPack(), flags: {} }));
  expect(readCharacterFile(text)).toEqual({ characters: [], failures: [] });
});

test("bundle flags that are not well formed, or name no bundle pack, are dropped", () => {
  const homebrew = warlockPack();
  const bundle = {
    format: "dmv-export",
    version: 1,
    characters: [],
    homebrew,
    homebrewFlags: { "warlock-test-content": { enabled: "yes", disabledItems: [] }, other: { enabled: true, disabledItems: [] } },
  };
  expect(readBundleHomebrew(JSON.stringify(bundle))).toEqual({ homebrew, flags: {} });
});

test("a bundle pack that is not a map is refused", () => {
  const text = JSON.stringify({ format: "dmv-export", version: 1, characters: [], homebrew: { bad: "text" } });
  expect(() => readBundleHomebrew(text)).toThrow("The export's homebrew pack bad is not a pack");
});

test.each([
  ["not JSON", "nope"],
  ["a raw entity", readText("characters/fighter-1.strict.json")],
  ["a bundle without homebrew", '{"format":"dmv-export","version":1,"characters":[]}'],
  ["a bundle with empty homebrew", '{"format":"dmv-export","version":1,"characters":[],"homebrew":{}}'],
])("%s has no bundle homebrew", (_, text) => {
  expect(readBundleHomebrew(text)).toBeNull();
});
