// Customize a background (ORC-135): the SRD background as a form record, and
// the starting equipment after a save of a background copy (custom-background.ts).
import { beforeAll, expect, test } from "vitest";
import { BACKGROUND_TYPE } from "./content.ts";
import { builtInText, characterContent, customizeOption, formRecord, withoutUnresolvedUnder } from "./custom.ts";
import { srdBackgroundRecord, withCopyStartingEquipment } from "./custom-background.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { missingContent } from "./reconcile.ts";
import { SAGE, SAGE_PACKS, withSage } from "./test-backgrounds.ts";
import { backgroundParts } from "./test-customize.ts";
import { fighter20 } from "./test-feats.ts";

beforeAll(() => loadEngine());

test("srdBackgroundRecord gives the SRD background of the engine's content list, with the template's holy symbol choice, and a copy keeps the sheet", async () => {
  const record = await srdBackgroundRecord("acolyte");
  expect(record).toEqual({
    "~:name": "Acolyte",
    "~:help": "Your life has been devoted to serving a god or gods.",
    "~:profs": { "~:skill": { "~:insight": true, "~:religion": true }, "~:language-options": { "~:choose": 2, "~:options": { "~:any": true } } },
    "~:equipment": { "~:clothes-common": 1, "~:pouch": 1, "~:incense": 5, "~:vestements": 1 },
    "~:treasure": { "~:gp": 15 },
    // The list has Prayer Book/Wheel. The holy symbol choice is only in the engine's template ("Starting Equipment: Holy Symbol").
    "~:equipment-choices": [
      { "~:name": "Prayer Book/Wheel", "~:options": { "~:prayer-book": 1, "~:prayer-wheel": 1 } },
      { "~:name": "Holy Symbol", "~:options": { "~:amulet": 1, "~:emblem": 1, "~:reliquary": 1 } },
    ],
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

  // fighter-20 picked the Amulet under the holy symbol choice. The copy has the choice with the same key, so the pick resolves.
  const before = engine().evaluate(fighter20()).built;
  const srd = backgroundParts(fighter20(), undefined);
  const next = customizeOption(fighter20(), undefined, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "acolyte"],
    item: { ...record, "~:name": "Acolyte (Custom)" },
  });
  const content = characterContent({ homebrew: SAGE_PACKS }, next.custom);
  expect(missingContent(next.entity, content)).toEqual([]);
  expect(withoutUnresolvedUnder(next.entity, ["background", "acolyte-custom-"], content)).toBe(next.entity);
  const after = engine().evaluate(next.entity, content).built;
  expect(after.equipment).toEqual(before.equipment);
  expect(after.equipment?.amulet).toBeDefined();
  expect(after.treasure).toEqual(before.treasure);
  expect(backgroundParts(next.entity, next.custom)).toEqual({ ...srd, background: "Acolyte (Custom)" });
});

test("withCopyStartingEquipment gives the copy's items and gold only when they change, and keeps the user's other items once", () => {
  const e = engine();
  const user = e.addInventoryItem(withSage(), "equipment", "lamp");
  const item = { ...formRecord(SAGE), "~:name": "Sage (Custom)" };
  const first = customizeOption(user, undefined, { contentType: BACKGROUND_TYPE, path: ["background", "sage"], item });
  const content = characterContent({ homebrew: SAGE_PACKS }, first.custom);
  const equipment = (entity: StrictEntity) => engine().evaluate(entity, content).built.equipment ?? {};
  // No change to the items and the gold, or only to the equipment choices: the entity stays as it is.
  expect(withCopyStartingEquipment(first.entity, "sage-custom-", item, { ...item, "~:help": "New." }, content)).toBe(first.entity);
  const choice = { ...item, "~:equipment-choices": [{ "~:name": "Musical Instruments", "~:options": { "~:lute": 1 } }] };
  expect(withCopyStartingEquipment(first.entity, "sage-custom-", item, choice, content)).toBe(first.entity);

  const changed = { ...item, "~:equipment": { "~:ink": 1, "~:book": 1 }, "~:treasure": { "~:gp": 25 } };
  const copy = customizeOption(first.entity, first.custom, {
    contentType: BACKGROUND_TYPE,
    path: ["background", "sage-custom-"],
    item: changed,
    replacedKey: "sage-custom-",
  });
  const copyContent = characterContent({ homebrew: SAGE_PACKS }, copy.custom);
  const result = withCopyStartingEquipment(copy.entity, "sage-custom-", item, changed, copyContent);
  const built = engine().evaluate(result, copyContent).built;
  const background = Object.keys(built.equipment ?? {}).filter((k) => built.equipment?.[k]["orcpub.dnd.e5.character.equipment/background-starting-equipment?"]);
  expect(background.sort()).toEqual(["book", "ink"]);
  expect(built.treasure?.gp["orcpub.dnd.e5.character.equipment/quantity"]).toBe(25);
  // The item that the user added stays, and each item is in the entity once.
  expect(built.equipment?.lamp).toEqual(equipment(first.entity).lamp);
  const keys = (result as Record<string, Record<string, unknown>[]>)["~:orcpub.entity.strict/selections"]
    .filter((sel) => sel["~:orcpub.entity.strict/key"] === "~:equipment")
    .flatMap((sel) => (sel["~:orcpub.entity.strict/options"] as Record<string, string>[]).map((o) => o["~:orcpub.entity.strict/key"]));
  expect(new Set(keys).size).toBe(keys.length);
  expect(keys).toContain("~:lamp");
});
