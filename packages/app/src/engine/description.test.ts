import { beforeAll, expect, test } from "vitest";
import { DESCRIPTION_FIELDS, setDescription, storedValue } from "./description.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { exportBundle, readCharacterFile } from "./import.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

const VALUES = "~:orcpub.entity.strict/values";
const strictValues = (entity: StrictEntity) =>
  ((typeof entity === "string" ? JSON.parse(entity) : entity) as Record<string, Record<string, unknown>>)[VALUES];

/** A distinct text for each field: XP is "6500", and the flaws are blank. */
const typed = (key: string) => (key === "xps" ? "6500" : key === "flaws" ? "" : key.endsWith("url") ? `https://example.com/${key}.png` : `The ${key}`);

test("every description field round-trips through export and import, and shows on the sheet", () => {
  const e = engine();
  let entity: StrictEntity = e.emptyCharacter();
  for (const { key } of DESCRIPTION_FIELDS) entity = setDescription(e, entity, key, typed(key));

  const { characters, failures } = readCharacterFile(JSON.stringify(exportBundle([entity], "test")));
  expect(failures).toEqual([]);
  const imported = characters[0].entity;
  expect(strictValues(imported)).toEqual(strictValues(entity));
  expect(strictValues(imported)["~:orcpub.dnd.e5.character/flaws"]).toBe("");
  expect(strictValues(imported)["~:orcpub.dnd.e5.character/xps"]).toBe(6500);

  const sheet = toSheet(e.evaluate(imported).built, imported);
  expect(sheet).toMatchObject({
    name: "The character-name",
    playerName: "The player-name",
    xp: 6500,
    portrait: "https://example.com/image-url.png",
    factionName: "The faction-name",
    factionImage: "https://example.com/faction-image-url.png",
    details: {
      personalityTraits: ["The personality-trait-1", "The personality-trait-2"],
      ideals: "The ideals",
      bonds: "The bonds",
      flaws: null,
      description: "The description",
      age: "The age",
      sex: "The sex",
      height: "The height",
      weight: "The weight",
      hair: "The hair",
      eyes: "The eyes",
      skin: "The skin",
    },
  });
});

test("storedValue reads back what setDescription writes, and XP that is not a number is removed", () => {
  const e = engine();
  let entity: StrictEntity = e.emptyCharacter();
  expect(storedValue(entity, "player-name")).toBe("");
  for (const { key } of DESCRIPTION_FIELDS) {
    entity = setDescription(e, entity, key, typed(key));
    expect(storedValue(entity, key)).toBe(typed(key));
  }
  entity = setDescription(e, entity, "player-name", "");
  expect(strictValues(entity)["~:orcpub.dnd.e5.character/player-name"]).toBe("");
  entity = setDescription(e, entity, "xps", "12.9");
  expect(strictValues(entity)["~:orcpub.dnd.e5.character/xps"]).toBe(12);
  for (const text of ["abc", ""]) {
    entity = setDescription(e, setDescription(e, entity, "xps", "300"), "xps", text);
    expect(storedValue(entity, "xps")).toBe("");
    expect(strictValues(entity)).not.toHaveProperty(["~:orcpub.dnd.e5.character/xps"]);
  }
});
