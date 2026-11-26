// dmv-character version 2 (ORC-137): a character's custom content in its
// file and in the dmv-export bundle, and the checks of custom content that a
// file brings in.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { addCharacter } from "../state/character.ts";
import { orcbrewHomebrew, useHomebrew } from "../state/homebrew.ts";
import { type CharacterRecord, getCharacter } from "../storage/characters.ts";
import { BACKGROUND_TYPE, CONTENT_TYPES } from "./content.ts";
import { CUSTOM_PACK, characterContent, saveCopy } from "./custom.ts";
import { srdBackgroundRecord } from "./custom-background.ts";
import { srdRaceRecord } from "./custom-race.ts";
import { type Content, type ContentType, engine, loadEngine, type StrictEntity } from "./engine.ts";
import { CUSTOM_BUILD_FAILURE, characterFile, checkCustom, exportBundle, readCharacterFile } from "./import.ts";
import { exportOrcbrew } from "./orcbrew-export.ts";
import { toSheet } from "./sheet.ts";
import { fighter20 } from "./test-feats.ts";
import { RACE_TYPE } from "./test-races.ts";

beforeAll(() => loadEngine());

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const SRD: Content = { homebrew: undefined };
const FEATS = "~:orcpub.dnd.e5/feats";

/** Saves a copy as the Customize dialog does: the record through its validator, with CUSTOM_PACK, then saveCopy. */
function copy(entity: StrictEntity, custom: object | undefined, contentType: ContentType, path: string[], record: object) {
  const { validator } = CONTENT_TYPES.find((t) => t.type === contentType)!;
  const { ok, item } = engine().validate[validator]({ ...record, "~:option-pack": CUSTOM_PACK });
  expect(ok).toBe(true);
  return saveCopy(entity, custom, SRD, { contentType, path, item });
}

/** fighter-20 with a custom copy of his feat Grappler, his background Acolyte and his race Human. */
async function customized() {
  const feat = copy(fighter20(), undefined, "orcpub.dnd.e5/feats", ["feats", "grappler"], {
    "~:name": "Grappler (Custom)",
    "~:description": "You hold on tight.",
    "~:ability-increases": { "~#set": [] },
  });
  const background = copy(feat.entity, feat.custom, BACKGROUND_TYPE, ["background", "acolyte"], {
    ...(await srdBackgroundRecord("acolyte")),
    "~:name": "Acolyte (Custom)",
  });
  const race = copy(background.entity, background.custom, RACE_TYPE, ["race", "human"], { ...(await srdRaceRecord("human")), "~:name": "Human (Custom)" });
  return { entity: race.entity, custom: race.custom };
}

const sheetOf = (record: CharacterRecord) => toSheet(engine().evaluate(record.entity, characterContent(SRD, record.custom)).built, record.entity);

/** Imports the file's text as the import page does, and gives each stored record and the file's failures. */
async function importText(text: string) {
  const { characters, failures } = readCharacterFile(text);
  const records = await Promise.all(characters.map(async (c) => (await getCharacter(await addCharacter(c.entity, c.rules, c.legacyId, c.custom)))!));
  return { characters, records, failures };
}

test("a character with a custom feat, background and race exports as version 2 and imports to the same record and sheet", async () => {
  const { entity, custom } = await customized();
  expect(Object.keys(custom)).toEqual([FEATS, "~:orcpub.dnd.e5/backgrounds", "~:orcpub.dnd.e5/races"]);
  const record = (await getCharacter(await addCharacter(entity, "2014", "17", custom)))!;
  expect(record.custom).toEqual(custom);

  const file = characterFile(record);
  expect(file).toEqual({ ...record, version: 2, entity: engine().exportCharacter(record.entity) });
  const { characters, records, failures } = await importText(JSON.stringify(file));
  expect(failures).toEqual([]);
  expect(characters[0].unresolved).toEqual([]);
  const [back] = records;
  expect(back).toEqual({ ...record, id: back.id, updatedAt: back.updatedAt });
  expect(back.id).not.toBe(record.id);
  expect(sheetOf(back)).toEqual(sheetOf(record));
  expect(sheetOf(back)).toMatchObject({ race: "Human (Custom)", background: "Acolyte (Custom)" });
});

test("a version 1 file imports, with no custom content", async () => {
  const record = (await getCharacter(await addCharacter(fighter20(), "2014", null)))!;
  const v1 = { ...characterFile(record), version: 1 };
  const { records, failures } = await importText(JSON.stringify(v1));
  expect(failures).toEqual([]);
  expect(records[0]).toEqual({ ...record, id: records[0].id, updatedAt: records[0].updatedAt });
  expect(records[0]).not.toHaveProperty("custom");
});

test("a version 1 file that an app before ORC-137 wrote with custom content keeps it", async () => {
  const { entity, custom } = await customized();
  const record = (await getCharacter(await addCharacter(entity, "2014", null, custom)))!;
  const { records, failures } = await importText(JSON.stringify({ ...characterFile(record), version: 1 }));
  expect(failures).toEqual([]);
  expect(records[0]).toEqual({ ...record, id: records[0].id, updatedAt: records[0].updatedAt });
});

test("the bundle carries each character's custom content and imports it back; a character without custom content has none", async () => {
  const { entity, custom } = await customized();
  const records = [
    (await getCharacter(await addCharacter(entity, "2014", "17", custom)))!,
    (await getCharacter(await addCharacter(fighter20(), "2014", null)))!,
  ];
  const bundle = exportBundle(records, "https://alchemy.example");
  expect(bundle.characters).toEqual(records.map(characterFile));
  expect(bundle.characters[1]).not.toHaveProperty("custom");

  const back = await importText(JSON.stringify(bundle));
  expect(back.failures).toEqual([]);
  expect(back.records).toEqual(records.map((r, i) => ({ ...r, id: back.records[i].id, updatedAt: back.records[i].updatedAt })));
  expect(sheetOf(back.records[0])).toEqual(sheetOf(records[0]));
});

test("an old version 1 bundle of bare entities still imports", async () => {
  const bundle = {
    format: "dmv-export",
    version: 1,
    exportedFrom: "https://alchemy.example",
    characters: [engine().exportCharacter(fighter20())],
    magicItems: [],
  };
  const { records, failures } = await importText(JSON.stringify(bundle));
  expect(failures).toEqual([]);
  expect(records).toEqual([
    {
      format: "dmv-character",
      version: 2,
      rules: "2014",
      id: records[0].id,
      name: "Ser Aldric",
      updatedAt: records[0].updatedAt,
      legacyId: null,
      entity: engine().importCharacter(fighter20()).entity,
    },
  ]);
});

test("custom items the character does not select are dropped on import", async () => {
  const { entity, custom } = await customized();
  const extra = {
    ...custom,
    [FEATS]: { ...(custom as Record<string, object>)[FEATS], "~:unused": { "~:key": "~:unused", "~:name": "Unused", "~:option-pack": CUSTOM_PACK } },
  };
  const file = { ...characterFile({ format: "dmv-character", version: 2, rules: "2014", id: "x", name: null, legacyId: null, entity }), custom: extra };
  const { records, failures } = await importText(JSON.stringify(file));
  expect(failures).toEqual([]);
  expect(records[0].custom).toEqual(custom);
});

test("checkCustom keeps valid items under CUSTOM_PACK, and leaves out the rest with a reason", async () => {
  const { custom } = await customized();
  const feats = (custom as Record<string, Record<string, object>>)[FEATS];
  const grappler = feats["~:grappler-custom"];
  expect(checkCustom(undefined)).toEqual({ custom: undefined, problems: [] });
  expect(checkCustom(custom)).toEqual({ custom, problems: [] });
  expect(checkCustom([1])).toEqual({ custom: undefined, problems: ["The custom options were left out: they are not a map."] });
  expect(
    checkCustom({
      [FEATS]: { "~:grappler-custom": { ...grappler, "~:option-pack": "Feat Pack" }, "~:no-name": { "~:key": "~:no-name" }, "~:text": "nope" },
      "~:orcpub.dnd.e5/races": "nope",
      "~:disabled?": true,
    }),
  ).toEqual({
    // The option source is always the reserved pack, so a file cannot name a loaded pack.
    custom: { [FEATS]: { "~:grappler-custom": grappler } },
    problems: [
      "The custom feat no-name was left out: name is missing.",
      "The custom feat text was left out: it is not an item.",
      "The custom races were left out: they are not a map.",
      "The custom options of the type disabled? were left out: the app has no such content type.",
    ],
  });
});

test("custom content that is not valid is left out with a message, and the character imports with its option unresolved", async () => {
  const { entity, custom } = await customized();
  const feats = (custom as Record<string, Record<string, object>>)[FEATS];
  const broken = { ...custom, [FEATS]: { "~:grappler-custom": { ...feats["~:grappler-custom"], "~:name": "" } } };
  const file = { ...characterFile({ format: "dmv-character", version: 2, rules: "2014", id: "x", name: null, legacyId: null, entity }), custom: broken };
  const { characters, records, failures } = await importText(JSON.stringify(file));
  expect(failures).toEqual(["Ser Aldric: The custom feat grappler-custom was left out: name is missing."]);
  expect(characters[0].unresolved.map((u) => u.key)).toEqual(["grappler-custom"]);
  const { [FEATS]: _, ...rest } = custom as Record<string, object>;
  expect(records[0].custom).toEqual(rest);

  expect(readCharacterFile(JSON.stringify({ ...file, custom: "text" })).failures).toEqual([
    "Ser Aldric: The custom options were left out: they are not a map.",
  ]);
});

test("the .orcbrew export has the packs only, never a character's custom content", async () => {
  const { entity, custom } = await customized();
  await addCharacter(entity, "2014", null, custom);
  await useHomebrew.getState().load("warlock-test-content.orcbrew", readFileSync(join(fixturesDir, "orcbrew/warlock-test-content.orcbrew"), "utf8"));
  const homebrew = orcbrewHomebrew();
  expect(Object.keys(homebrew)).toEqual(["warlock-test-content"]);
  const result = exportOrcbrew(homebrew);
  if (!("text" in result)) throw new Error("The pack does not export");
  expect(result.text).toContain("warlock-test-content");
  for (const name of ["Grappler (Custom)", "Acolyte (Custom)", "Human (Custom)", CUSTOM_PACK]) expect(result.text).not.toContain(name);
});

test("checkCustom leaves out an item whose key is not its map key, but not a background, which the engine keys by its name", async () => {
  const { custom } = await customized();
  const typed = custom as Record<string, Record<string, Record<string, unknown>>>;
  const grappler = typed[FEATS]["~:grappler-custom"];
  const human = typed["~:orcpub.dnd.e5/races"]["~:human-custom"];
  const acolyte = typed["~:orcpub.dnd.e5/backgrounds"]["~:acolyte-custom-"];
  const { "~:key": _, ...noKey } = grappler;
  expect(
    checkCustom({
      [FEATS]: { "~:grappler-custom": noKey },
      "~:orcpub.dnd.e5/races": { "~:human-custom": { ...human, "~:key": "~:human" } },
      "~:orcpub.dnd.e5/backgrounds": { "~:acolyte-custom-": { ...acolyte, "~:key": "~:other" } },
    }),
  ).toEqual({
    custom: { "~:orcpub.dnd.e5/backgrounds": { "~:acolyte-custom-": { ...acolyte, "~:key": "~:other" } } },
    problems: [
      "The custom feat Grappler (Custom) was left out: its key is not its map key.",
      "The custom race Human (Custom) was left out: its key is not its map key.",
    ],
  });
});

/** fighter-20's file with a custom feat that passes the feat validator but stops the build. */
async function unbuildable() {
  const { entity, custom } = await customized();
  const typed = custom as Record<string, Record<string, Record<string, unknown>>>;
  const broken = { ...typed, [FEATS]: { "~:grappler-custom": { ...typed[FEATS]["~:grappler-custom"], "~:ability-increases": "str" } } };
  expect(checkCustom(broken)).toEqual({ custom: broken, problems: [] });
  const file = characterFile({
    format: "dmv-character" as const,
    version: 2 as const,
    rules: "2014" as const,
    id: "x",
    name: "Ser Aldric",
    updatedAt: "t",
    legacyId: null,
    entity,
  });
  return { file: { ...file, custom: broken }, entity };
}

/** The record of fighter-20's entity stored with no custom content, as an import of it stores it. */
const plainRecord = (record: CharacterRecord, entity: StrictEntity): CharacterRecord => ({
  format: "dmv-character",
  version: 2,
  rules: "2014",
  id: record.id,
  name: "Ser Aldric",
  updatedAt: record.updatedAt,
  legacyId: null,
  entity: engine().importCharacter(engine().exportCharacter(entity)).entity,
});

test("a custom item that passes its validator but stops the build leaves the custom content out, and the character imports", async () => {
  const { file, entity } = await unbuildable();
  const { records, failures } = await importText(JSON.stringify(file));
  expect(failures).toEqual([`Ser Aldric: ${CUSTOM_BUILD_FAILURE}`]);
  expect(records).toEqual([plainRecord(records[0], entity)]);
});

test("in a bundle, a character whose custom content stops the build imports without it, and the others import as they are", async () => {
  const { file, entity } = await unbuildable();
  const other = (await getCharacter(await addCharacter(fighter20(), "2014", null)))!;
  const bundle = { ...exportBundle([other], "https://alchemy.example"), characters: [file, characterFile(other)] };
  const { records, failures } = await importText(JSON.stringify(bundle));
  expect(failures).toEqual([`Ser Aldric: ${CUSTOM_BUILD_FAILURE}`]);
  expect(records).toEqual([plainRecord(records[0], entity), { ...other, id: records[1].id, updatedAt: records[1].updatedAt }]);
});
