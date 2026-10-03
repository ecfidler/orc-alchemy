// Character files (doc 03): a strict entity saved from the old app, the app's
// dmv-character envelope, or a dmv-export bundle. Each character read goes
// through the engine's importCharacter, and each one written through its
// exportCharacter.
import { engine, type Rules, type StrictEntity } from "./engine.ts";

export interface CharacterFileEntry {
  entity: StrictEntity;
  rules: Rules;
  /** The old app's id, or null. */
  legacyId: string | null;
  name: string | null;
}

export interface CharacterFile {
  characters: CharacterFileEntry[];
  /** Why each bundle character that did not import failed. */
  failures: string[];
}

/**
 * Reads a character file's text and imports every character in it. Throws
 * with a reason the user can read for anything that is not a character file.
 * A bundle character that fails is reported in failures, not thrown.
 */
export function readCharacterFile(text: string): CharacterFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not JSON");
  }
  if (!isObject(data)) throw new Error("This is not a character file");

  switch (data.format) {
    case undefined:
      return { characters: [importOne(data)], failures: [] };
    case "dmv-character":
      checkVersion(data);
      // A missing rules is 2014: every file written so far is.
      if ((data.rules ?? "2014") !== "2014") {
        throw new Error(`This character uses the ${String(data.rules)} rules, which this app does not support yet`);
      }
      const character = importOne(data.entity);
      if (typeof data.legacyId === "string") character.legacyId = data.legacyId;
      return { characters: [character], failures: [] };
    case "dmv-export": {
      checkVersion(data);
      // magicItems become homebrew, which arrives in M3.
      const characters = Array.isArray(data.characters) ? data.characters : [];
      if (characters.length === 0) throw new Error("This export has no characters");
      const file: CharacterFile = { characters: [], failures: [] };
      characters.forEach((character, i) => {
        try {
          file.characters.push(importOne(character));
        } catch (e) {
          file.failures.push(`Character ${i + 1} of ${characters.length}: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
      return file;
    }
    default:
      throw new Error(`Unsupported file format: ${String(data.format)}`);
  }
}

/** A stored character as a dmv-character file: the record, with its entity through exportCharacter. */
export function characterFile<T extends { entity: StrictEntity }>(record: T): T {
  return { ...record, entity: engine().exportCharacter(record.entity) };
}

/** A dmv-export bundle of these characters. Homebrew joins it in M3. */
export function exportBundle(entities: StrictEntity[], exportedFrom: string) {
  return {
    format: "dmv-export",
    version: 1,
    exportedFrom,
    characters: entities.map((entity) => engine().exportCharacter(entity)),
    magicItems: [],
  };
}

function importOne(entity: unknown): CharacterFileEntry {
  // importCharacter accepts any object, and gives an empty character for one
  // that is not verbose Transit-JSON, so check for a strict entity first.
  if (!isObject(entity) || !("~:orcpub.entity.strict/selections" in entity)) {
    throw new Error("This is not a character file");
  }
  const imported = engine().importCharacter(entity);
  const name = engine().evaluate(imported.entity).built["character-name"];
  // Every importable character is 2014: old-app files are, and readCharacterFile refuses other envelopes.
  return { ...imported, rules: "2014", name: name || null };
}

function checkVersion(data: Record<string, unknown>) {
  if (data.version !== 1) throw new Error(`Unsupported ${String(data.format)} version: ${String(data.version)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
