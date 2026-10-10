// Character files (doc 03): a strict entity saved from the old app, the old
// server's EDN for one character or the list, the app's dmv-character
// envelope, or a dmv-export bundle, whose characters can hold the old
// server's EDN as text, and custom magic items. Each character read goes
// through the engine's importCharacter, and each one written through its
// exportCharacter.
import { engine, type Content, type Rules, type StrictEntity } from "./engine.ts";
import { missingContent, type UnresolvedKey } from "./reconcile.ts";

export interface CharacterFileEntry {
  entity: StrictEntity;
  rules: Rules;
  /** The old app's id, or null. */
  legacyId: string | null;
  name: string | null;
  /** The option keys that do not resolve against the homebrew (quirk R8). Not stored. */
  unresolved: UnresolvedKey[];
}

export interface CharacterFile {
  characters: CharacterFileEntry[];
  /** Why each character in a bundle or list that did not import failed. */
  failures: string[];
}

/**
 * Reads a character file's text and imports every character in it. Throws
 * with a reason the user can read for anything that is not a character file.
 * A character in a bundle, or in an EDN list of two or more, that fails is
 * reported in failures, not thrown. Each character's keys are checked against the content, or against
 * the SRD alone without it.
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
    case "dmv-character":
      checkVersion(data);
      // A missing rules is 2014: every file written so far is.
      if ((data.rules ?? "2014") !== "2014") {
        throw new Error(`This character uses the ${String(data.rules)} rules, which this app does not support yet`);
      }
      const character = importOne(data.entity, content);
      if (typeof data.legacyId === "string") character.legacyId = data.legacyId;
      return { characters: [character], failures: [] };
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

/** Imports each character, and reports each one that fails in failures. */
function importEach(characters: unknown[], content: Content | undefined): CharacterFile {
  const file: CharacterFile = { characters: [], failures: [] };
  characters.forEach((character, i) => {
    try {
      file.characters.push(importOne(character, content));
    } catch (e) {
      file.failures.push(`Character ${i + 1} of ${characters.length}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  return file;
}

/**
 * A stored character as a dmv-character file: the record, with its entity
 * through exportCharacter. Generic over the record so that src/engine needs
 * no storage type.
 */
export function characterFile<T extends { entity: StrictEntity }>(record: T): T {
  return { ...record, entity: engine().exportCharacter(record.entity) };
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
 * A dmv-export bundle of these characters, packs and magic items (doc 03):
 * bare entities, so each character's id, rules and legacyId are not kept.
 * homebrew is the multi-plugin map, as the old app's :plugins; homebrewFlags
 * is this app's own. Both are left out with no packs. magicItems holds the
 * item maps, in the old server's form.
 */
export function exportBundle(entities: StrictEntity[], exportedFrom: string, packs?: BundleHomebrew, magicItems: object[] = []) {
  const hasPacks = packs !== undefined && Object.keys(packs.homebrew).length > 0;
  return {
    format: "dmv-export",
    version: 1,
    exportedFrom,
    characters: entities.map((entity) => engine().exportCharacter(entity)),
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
      else failures.push(`${name}: ${problems.map((p) => `${p.path.join(" ")} is ${p.reason}`).join(", ")}`);
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
  return magicItemName(item)
    .toLowerCase().replace(/'/g, "").replace(/\W/g, "-").replace(/-+/g, "-");
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

function importOne(entity: unknown, content: Content | undefined): CharacterFileEntry {
  // importCharacter accepts any object, and gives an empty character for one
  // that is not verbose Transit-JSON, so check for a strict entity first.
  if (!isObject(entity) || !("~:orcpub.entity.strict/selections" in entity)) {
    throw new Error("This is not a character file");
  }
  const imported = engine().importCharacter(entity);
  const name = engine().evaluate(imported.entity, content).built["character-name"];
  const unresolved = missingContent(imported.entity, content);
  // Every importable character is 2014: old-app files are, and readCharacterFile refuses other envelopes.
  return { ...imported, rules: "2014", name: name || null, unresolved };
}

function checkVersion(data: Record<string, unknown>) {
  if (data.version !== 1) throw new Error(`Unsupported ${String(data.format)} version: ${String(data.version)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
