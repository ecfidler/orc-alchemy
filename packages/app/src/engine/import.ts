// Character files (doc 03): a strict entity saved from the old app, the old
// server's EDN for one character or the list, the app's dmv-character
// envelope, or a dmv-export bundle. Each character read goes
// through the engine's importCharacter, and each one written through its
// exportCharacter.
import type { Homebrew } from "@pubdoor/dmv";
import { engine, type Rules, type StrictEntity } from "./engine.ts";
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
 * A character in a bundle or list that fails is reported in failures, not
 * thrown. Each character's keys are checked against the homebrew, or against
 * the SRD alone without it.
 */
export function readCharacterFile(text: string, homebrew?: Homebrew): CharacterFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return readServerCharacters(text, homebrew);
  }
  if (!isObject(data)) throw new Error("This is not a character file");

  switch (data.format) {
    case undefined:
      return { characters: [importOne(data, homebrew)], failures: [] };
    case "dmv-character":
      checkVersion(data);
      // A missing rules is 2014: every file written so far is.
      if ((data.rules ?? "2014") !== "2014") {
        throw new Error(`This character uses the ${String(data.rules)} rules, which this app does not support yet`);
      }
      const character = importOne(data.entity, homebrew);
      if (typeof data.legacyId === "string") character.legacyId = data.legacyId;
      return { characters: [character], failures: [] };
    case "dmv-export": {
      checkVersion(data);
      // magicItems become homebrew in the item builder (M5). The homebrew is read by readBundleHomebrew.
      const characters = Array.isArray(data.characters) ? data.characters : [];
      if (characters.length === 0 && bundlePacks(data) === null) throw new Error("This export has no characters");
      return importEach(characters, homebrew);
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
function readServerCharacters(text: string, homebrew: Homebrew | undefined): CharacterFile {
  let values: object[];
  try {
    values = engine().readServerEdn(text);
  } catch {
    throw new Error("This file is not JSON or EDN");
  }
  if (values.length === 0) throw new Error("This file has no characters");
  if (values.length === 1) return { characters: [importOne(values[0], homebrew)], failures: [] };
  return importEach(values, homebrew);
}

/** Imports each character, and reports each one that fails in failures. */
function importEach(characters: unknown[], homebrew: Homebrew | undefined): CharacterFile {
  const file: CharacterFile = { characters: [], failures: [] };
  characters.forEach((character, i) => {
    try {
      file.characters.push(importOne(character, homebrew));
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
 * A dmv-export bundle of these characters and packs (doc 03): bare entities,
 * so each character's id, rules and legacyId are not kept. homebrew is the
 * multi-plugin map, as the old app's :plugins; homebrewFlags is this app's
 * own. Both are left out with no packs.
 */
export function exportBundle(entities: StrictEntity[], exportedFrom: string, packs?: BundleHomebrew) {
  const hasPacks = packs !== undefined && Object.keys(packs.homebrew).length > 0;
  return {
    format: "dmv-export",
    version: 1,
    exportedFrom,
    characters: entities.map((entity) => engine().exportCharacter(entity)),
    magicItems: [],
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

function bundlePacks(data: Record<string, unknown>): Record<string, object> | null {
  const { homebrew } = data;
  if (!isObject(homebrew) || Object.keys(homebrew).length === 0) return null;
  return homebrew as Record<string, object>; // readBundleHomebrew checks each pack
}

function isFlags(value: unknown): value is PackFlags {
  const isItem = (item: unknown) => Array.isArray(item) && item.length === 2 && item.every((s) => typeof s === "string");
  return isObject(value) && typeof value.enabled === "boolean" && Array.isArray(value.disabledItems) && value.disabledItems.every(isItem);
}

function importOne(entity: unknown, homebrew: Homebrew | undefined): CharacterFileEntry {
  // importCharacter accepts any object, and gives an empty character for one
  // that is not verbose Transit-JSON, so check for a strict entity first.
  if (!isObject(entity) || !("~:orcpub.entity.strict/selections" in entity)) {
    throw new Error("This is not a character file");
  }
  const imported = engine().importCharacter(entity);
  const name = engine().evaluate(imported.entity, { homebrew }).built["character-name"];
  const unresolved = missingContent(imported.entity, homebrew);
  // Every importable character is 2014: old-app files are, and readCharacterFile refuses other envelopes.
  return { ...imported, rules: "2014", name: name || null, unresolved };
}

function checkVersion(data: Record<string, unknown>) {
  if (data.version !== 1) throw new Error(`Unsupported ${String(data.format)} version: ${String(data.version)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
