// Character files (doc 03): a strict entity saved from the old app, the old
// server's EDN for one character or the list, the app's dmv-character
// envelope, or a dmv-export bundle, whose characters can hold the old
// server's EDN as text, and custom magic items. Each character read goes
// through the engine's importCharacter, and each one written through its
// exportCharacter. An envelope's custom content (ORC-137) is checked as
// untrusted input before it is kept.
import { BACKGROUND_TYPE, CONTENT_TYPES, OPTION_PACK, tag, untag } from "./content.ts";
import { CUSTOM_PACK, characterContent, hasCustomItems, pruneCustom } from "./custom.ts";
import { type Content, engine, type Rules, type StrictEntity, type ValidationProblem } from "./engine.ts";
import { importOldUsesSpent } from "./play.ts";
import { missingContent, type UnresolvedKey } from "./reconcile.ts";
import { toSheet } from "./sheet.ts";
import { featureUses } from "./sheet-features.ts";

/**
 * The version of the dmv-character envelope and the dmv-export bundle that
 * the app writes. Version 2 (ORC-137) adds a character's custom content. The
 * app reads versions 1 and 2.
 */
export const FILE_VERSION = 2;

export interface CharacterFileEntry {
  entity: StrictEntity;
  rules: Rules;
  /** The old app's id, or null. */
  legacyId: string | null;
  name: string | null;
  /**
   * The character's custom content from its envelope, checked (checkCustom)
   * and without the items the entity does not select (pruneCustom). Absent
   * with none.
   */
  custom?: object;
  /** The option keys that do not resolve against the homebrew and the custom content (quirk R8). Not stored. */
  unresolved: UnresolvedKey[];
}

export interface CharacterFile {
  characters: CharacterFileEntry[];
  /** Why each character in a bundle or list that did not import failed, and each custom item of a character that was left out. */
  failures: string[];
}

/**
 * Reads a character file's text and imports every character in it. Throws
 * with a reason the user can read for anything that is not a character file.
 * A character in a bundle, or in an EDN list of two or more, that fails is
 * reported in failures, not thrown. Each character's keys are checked against the content, or against
 * the SRD alone without it, with the character's custom content. Custom
 * content that is not valid is left out and reported in failures; the
 * character still imports.
 */
export function readCharacterFile(text: string, content?: Content): CharacterFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return readServerCharacters(text, content);
  }
  if (!isObject(data)) throw new Error("This is not a character file");

  switch (data.format) {
    case undefined:
      return { characters: [importOne(data, content)], failures: [] };
    case "dmv-character": {
      const { character, failures } = importEnvelope(data, content);
      return { characters: [character], failures };
    }
    case "dmv-export": {
      checkVersion(data);
      // The homebrew is read by readBundleHomebrew, and the magic items by readBundleMagicItems.
      const { characters, failures } = bundleCharacters(Array.isArray(data.characters) ? data.characters : []);
      if (characters.length === 0 && failures.length === 0 && bundlePacks(data) === null && !(Array.isArray(data.magicItems) && data.magicItems.length > 0)) {
        throw new Error("This export has no characters");
      }
      const file = importEach(characters, content);
      file.failures.unshift(...failures);
      return file;
    }
    default:
      throw new Error(`Unsupported file format: ${String(data.format)}`);
  }
}

/**
 * The old server's EDN: one character from GET /dnd/5e/characters/<id>, or
 * the list from GET /dnd/5e/characters. Neither has a rules value, so each
 * character is 2014.
 */
function readServerCharacters(text: string, content: Content | undefined): CharacterFile {
  let values: object[];
  try {
    values = engine().readServerEdn(text);
  } catch {
    throw new Error("This file is not JSON or EDN");
  }
  if (values.length === 0) throw new Error("This file has no characters");
  if (values.length === 1) return { characters: [importOne(values[0], content)], failures: [] };
  return importEach(values, content);
}

/**
 * One dmv-character envelope, version 1 or 2, and why each of its custom
 * items was left out. A version 1 file has no custom content as doc 03
 * defines it, but the app wrote the stored record's custom into version 1
 * files before ORC-137, so custom is read from either version.
 */
function importEnvelope(data: Record<string, unknown>, content: Content | undefined): { character: CharacterFileEntry; failures: string[] } {
  checkVersion(data);
  // A missing rules is 2014: every file written so far is.
  if ((data.rules ?? "2014") !== "2014") {
    throw new Error(`This character uses the ${String(data.rules)} rules, which this app does not support yet`);
  }
  const { custom, problems } = checkCustom(data.custom);
  const { character, customLeftOut } = importWithCustom(data.entity, content, custom);
  if (customLeftOut) problems.push(CUSTOM_BUILD_FAILURE);
  if (typeof data.legacyId === "string") character.legacyId = data.legacyId;
  const name = character.name ?? "Unnamed character";
  return { character, failures: problems.map((problem) => `${name}: ${problem}`) };
}

/** Whether a bundle's character entry is a dmv-character envelope, as a version 2 bundle holds it. */
const isEnvelope = (value: unknown): value is Record<string, unknown> => isObject(value) && value.format === "dmv-character";

/**
 * The custom content of an imported envelope, checked as untrusted input,
 * and why each part of it that is left out was left out. Each content type
 * must be one that a pack has, and each item a map under a Transit keyword
 * key that passes its type's validator, as the item that the Customize
 * dialog saves does. An item of each type but backgrounds must have its
 * map key as its :key, by which the engine keys it. Each item kept gets
 * CUSTOM_PACK as its option source, so it never names a loaded pack. The
 * character builds against it as the last pack, CUSTOM_PACK
 * (characterContent): an item can shadow a pack item with its key for this
 * character, but no loaded pack changes. An item is kept as the file has
 * it, so a file that the app wrote imports the same. undefined when no item
 * is left.
 */
export function checkCustom(custom: unknown): { custom: object | undefined; problems: string[] } {
  if (custom === undefined || custom === null) return { custom: undefined, problems: [] };
  if (!isObject(custom)) return { custom: undefined, problems: ["The custom options were left out: they are not a map."] };
  const kept: Record<string, Record<string, object>> = {};
  const problems: string[] = [];
  for (const [type, items] of Object.entries(custom)) {
    const contentType = CONTENT_TYPES.find((t) => tag(t.type) === type);
    if (contentType === undefined) {
      problems.push(`The custom options of the type ${untag(type)} were left out: the app has no such content type.`);
      continue;
    }
    if (!isObject(items)) {
      problems.push(`The custom ${contentType.many} were left out: they are not a map.`);
      continue;
    }
    for (const [key, item] of Object.entries(items)) {
      const name = isObject(item) && typeof item["~:name"] === "string" && item["~:name"] !== "" ? item["~:name"] : untag(key);
      const left = (why: string) => problems.push(`The custom ${contentType.one} ${name} was left out: ${why}.`);
      if (!isObject(item) || !key.startsWith("~:")) {
        left("it is not an item");
        continue;
      }
      // The engine keys each item but a background by its :key (copyKey), so a :key that is not the map key would select another option.
      if (contentType.type !== BACKGROUND_TYPE && item["~:key"] !== key) {
        left("its key is not its map key");
        continue;
      }
      const withPack = { ...item, [OPTION_PACK]: CUSTOM_PACK };
      let found: ValidationProblem[];
      try {
        found = engine().validate[contentType.validator](withPack).problems;
      } catch {
        found = [{ path: [], reason: "invalid", pred: "" }];
      }
      if (found.length > 0) {
        left(problemsText(found));
        continue;
      }
      kept[type] = { ...kept[type], [key]: withPack };
    }
  }
  return { custom: hasCustomItems(kept) ? kept : undefined, problems };
}

/** A validator's problems in words, such as "name is missing, traits 0 name is invalid". */
const problemsText = (problems: ValidationProblem[]) => problems.map((p) => `${p.path.length > 0 ? p.path.join(" ") : "the item"} is ${p.reason}`).join(", ");

/**
 * A bundle's character values. A string entry is the raw text of an old
 * server response, as the exporter bookmarklet writes it, and gives each
 * character in it; one that is not EDN is a failure.
 */
function bundleCharacters(entries: unknown[]): { characters: unknown[]; failures: string[] } {
  const characters: unknown[] = [];
  const failures: string[] = [];
  entries.forEach((entry, i) => {
    if (typeof entry !== "string") {
      characters.push(entry);
      return;
    }
    try {
      characters.push(...engine().readServerEdn(entry));
    } catch {
      failures.push(`Character list ${i + 1} of ${entries.length}: This is not the old server's EDN`);
    }
  });
  return { characters, failures };
}

/**
 * Imports each character, a strict entity or a dmv-character envelope, and
 * reports each one that fails, and each custom item left out, in failures.
 */
function importEach(characters: unknown[], content: Content | undefined): CharacterFile {
  const file: CharacterFile = { characters: [], failures: [] };
  characters.forEach((character, i) => {
    try {
      if (isEnvelope(character)) {
        const { character: imported, failures } = importEnvelope(character, content);
        file.characters.push(imported);
        file.failures.push(...failures);
      } else file.characters.push(importOne(character, content));
    } catch (e) {
      file.failures.push(`Character ${i + 1} of ${characters.length}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return file;
}

/**
 * A stored character as a dmv-character file: the record, with its entity
 * through exportCharacter, and its custom content, as version FILE_VERSION.
 * A record stored before ORC-137 has version 1, and its file has version 2
 * too: one writer version. A record without custom content gives a file
 * without custom. Generic over the record so that src/engine needs no
 * storage type.
 */
export function characterFile<T extends { entity: StrictEntity }>(record: T) {
  return { ...record, format: "dmv-character" as const, version: FILE_VERSION, entity: engine().exportCharacter(record.entity) };
}

/** A pack's flags, which only this app has: the old app and .orcbrew files do not. */
export interface PackFlags {
  enabled: boolean;
  /** Items left out of the homebrew, as [content type, key], such as ["~:orcpub.dnd.e5/spells", "~:fireball"]. */
  disabledItems: [contentType: string, key: string][];
}

/** The homebrew of a dmv-export bundle: the multi-plugin map, and the flags of each pack in it. */
export interface BundleHomebrew {
  homebrew: Record<string, object>;
  /** Only for the packs that have flags; a pack without flags loads enabled. */
  flags: Record<string, PackFlags>;
}

/**
 * A dmv-export bundle of these stored characters, packs and magic items
 * (doc 03), as version FILE_VERSION: each character is its dmv-character
 * file (characterFile), with its custom content. homebrew is the
 * multi-plugin map, as the old app's :plugins; homebrewFlags is this app's
 * own. Both are left out with no packs. magicItems holds the item maps, in
 * the old server's form.
 */
export function exportBundle<T extends { entity: StrictEntity }>(records: T[], exportedFrom: string, packs?: BundleHomebrew, magicItems: object[] = []) {
  const hasPacks = packs !== undefined && Object.keys(packs.homebrew).length > 0;
  return {
    format: "dmv-export",
    version: FILE_VERSION,
    exportedFrom,
    characters: records.map(characterFile),
    magicItems,
    ...(hasPacks && { homebrew: packs.homebrew, homebrewFlags: packs.flags }),
  };
}

/** Whether the text is a dmv-export bundle, with or without homebrew. */
export function isBundleText(text: string): boolean {
  try {
    const data: unknown = JSON.parse(text);
    return isObject(data) && data.format === "dmv-export";
  } catch {
    return false;
  }
}

/**
 * The homebrew of a dmv-export bundle's text, or null for any other file or a
 * bundle with no packs. Throws when a pack is not a map. Flags that are not
 * well formed are dropped, so their pack keeps its stored flags. The packs'
 * content is checked when they are loaded.
 */
export function readBundleHomebrew(text: string): BundleHomebrew | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || data.format !== "dmv-export") return null;
  checkVersion(data);
  const homebrew = bundlePacks(data);
  if (homebrew === null) return null;
  // parseOrcbrew would skip a pack that is not a map. The export is damaged, so refuse all of it.
  const notPack = Object.keys(homebrew).find((pack) => !isObject(homebrew[pack]));
  if (notPack !== undefined) throw new Error(`The export's homebrew pack ${notPack} is not a pack`);
  const flags: Record<string, PackFlags> = {};
  if (isObject(data.homebrewFlags)) {
    for (const [pack, value] of Object.entries(data.homebrewFlags)) {
      if (pack in homebrew && isFlags(value)) flags[pack] = { enabled: value.enabled, disabledItems: value.disabledItems };
    }
  }
  return { homebrew, flags };
}

/** The custom magic items of a dmv-export bundle, each one valid, and why each other one was skipped. */
export interface BundleMagicItems {
  /** The item maps to store, in the old server's form, one for each key: a later item replaces an earlier one with its key. */
  items: object[];
  failures: string[];
}

/** A custom magic item's name, or "" without one. */
export const magicItemName = (item: object): string => {
  const name = (item as Record<string, unknown>)["~:orcpub.dnd.e5.magic-items/name"];
  return typeof name === "string" ? name : "";
};

/**
 * The custom magic items of a dmv-export bundle's text, or null for any
 * other file or a bundle with no items, valid or not. A string entry is the raw text of the
 * old server's GET /dnd/5e/items, as the exporter bookmarklet writes it, and
 * gives each item in it; an object entry is one item map, as this app's
 * export writes it. Each item is checked with validate.magicItem, and one
 * that fails is reported in failures, not thrown.
 */
export function readBundleMagicItems(text: string): BundleMagicItems | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(data) || data.format !== "dmv-export") return null;
  checkVersion(data);
  const entries = Array.isArray(data.magicItems) ? data.magicItems : [];
  const items = new Map<string, object>();
  const failures: string[] = [];
  entries.forEach((entry, i) => {
    let values: unknown[] = [entry];
    if (typeof entry === "string") {
      try {
        values = engine().readServerEdn(entry);
      } catch {
        failures.push(`Magic item list ${i + 1} of ${entries.length}: This is not the old server's EDN`);
        return;
      }
    }
    for (const value of values) {
      if (!isObject(value)) {
        failures.push("Unnamed magic item: This is not a magic item");
        continue;
      }
      const name = magicItemName(value) || "Unnamed magic item";
      const { ok, problems, item } = engine().validate.magicItem(value);
      if (ok) items.set(magicItemKey(item), item);
      else failures.push(`${name}: ${problemsText(problems)}`);
    }
  });
  return items.size === 0 && failures.length === 0 ? null : { items: [...items.values()], failures };
}

/**
 * A custom magic item's key, from its name, as the old app's name-to-kw made
 * it: "Warden's Plate" is "wardens-plate". A weapon or armor with subtypes
 * gives options keyed "<key>-<base>".
 */
export function magicItemKey(item: object): string {
  return magicItemName(item).toLowerCase().replace(/'/g, "").replace(/\W/g, "-").replace(/-+/g, "-");
}

function bundlePacks(data: Record<string, unknown>): Record<string, object> | null {
  const { homebrew } = data;
  if (!isObject(homebrew) || Object.keys(homebrew).length === 0) return null;
  return homebrew as Record<string, object>; // readBundleHomebrew checks each pack
}

function isFlags(value: unknown): value is PackFlags {
  const isItem = (item: unknown) => Array.isArray(item) && item.length === 2 && item.every((s) => typeof s === "string");
  return isObject(value) && typeof value.enabled === "boolean" && Array.isArray(value.disabledItems) && value.disabledItems.every(isItem);
}

/** The line of the import log when a character does not build with its custom content. */
export const CUSTOM_BUILD_FAILURE = "The custom options were left out: the app cannot build the character with them.";

/**
 * One strict entity, with its checked custom content (checkCustom), which is
 * kept only for the options that the entity selects. The spent uses of the
 * old app's record become the counts of the play state here, one time,
 * because the amounts and units come from the built character
 * (importOldUsesSpent). Custom items can pass
 * their validator and still stop the build: then the character imports
 * without its custom content, and customLeftOut is true. An entity that
 * does not build alone throws, as it does without custom content.
 */
function importWithCustom(entity: unknown, content: Content | undefined, checked?: object): { character: CharacterFileEntry; customLeftOut: boolean } {
  // importCharacter accepts any object, and gives an empty character for one
  // that is not verbose Transit-JSON, so check for a strict entity first.
  if (!isObject(entity) || !("~:orcpub.entity.strict/selections" in entity)) {
    throw new Error("This is not a character file");
  }
  const imported = engine().importCharacter(entity);
  /**
   * The name, the unresolved keys and the entity with the spent uses of an
   * old record (importOldUsesSpent), against the content. The entity
   * replaces imported.entity. This builds the sheet too, as a save does, so
   * it throws where a save would.
   */
  const checkAndMigrate = (withContent: Content | undefined) => {
    const { built } = engine().evaluate(imported.entity, withContent);
    const sheet = toSheet(built, imported.entity);
    return {
      name: built["character-name"] || null,
      unresolved: missingContent(imported.entity, withContent),
      entity: importOldUsesSpent(engine(), imported.entity, featureUses(sheet)),
    };
  };
  let custom = pruneCustom(imported.entity, checked);
  let result: { name: string | null; unresolved: UnresolvedKey[]; entity: StrictEntity };
  let customLeftOut = false;
  if (custom === undefined) result = checkAndMigrate(content);
  else {
    try {
      result = checkAndMigrate(characterContent(content ?? { homebrew: undefined }, custom));
    } catch {
      result = checkAndMigrate(content); // throws if the entity does not build alone either
      custom = undefined;
      customLeftOut = true;
    }
  }
  // Every importable character is 2014: old-app files are, and readCharacterFile refuses other envelopes.
  const { name, unresolved, entity: migrated } = result;
  return {
    character: { ...imported, rules: "2014", name, unresolved, entity: migrated, ...(custom !== undefined && { custom }) },
    customLeftOut,
  };
}

/** One strict entity that has no custom content. */
const importOne = (entity: unknown, content: Content | undefined): CharacterFileEntry => importWithCustom(entity, content).character;

/** Throws for a version the app cannot read: it reads 1 to FILE_VERSION. */
function checkVersion(data: Record<string, unknown>) {
  if (data.version !== 1 && data.version !== FILE_VERSION) throw new Error(`Unsupported ${String(data.format)} version: ${String(data.version)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
