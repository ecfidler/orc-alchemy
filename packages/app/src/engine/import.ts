// Character files (doc 03): a strict entity saved from the old app, the app's
// dmv-character envelope, or a dmv-export bundle. Each character goes through
// the engine's importCharacter.
import { engine, type StrictEntity } from "./engine.ts";

export interface ImportedCharacter {
  entity: StrictEntity;
  /** The old app's id, or null. */
  legacyId: string | null;
  name: string | null;
}

/**
 * Reads a character file's text and imports every character in it. Throws
 * with a reason the user can read for anything that is not a character file.
 */
export function readCharacterFile(text: string): ImportedCharacter[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("This file is not JSON");
  }
  if (!isObject(data)) throw new Error("This is not a character file");

  switch (data.format) {
    case undefined:
      return [importOne(data)];
    case "dmv-character":
      checkVersion(data);
      // A missing rules is 2014: every file written so far is.
      if ((data.rules ?? "2014") !== "2014") {
        throw new Error(`This character uses the ${String(data.rules)} rules, which this app does not support yet`);
      }
      return [importOne(data.entity)];
    case "dmv-export": {
      checkVersion(data);
      // magicItems become homebrew, which arrives in M3.
      const characters = Array.isArray(data.characters) ? data.characters : [];
      if (characters.length === 0) throw new Error("This export has no characters");
      return characters.map((character, i) => {
        try {
          return importOne(character);
        } catch (e) {
          throw new Error(`Character ${i + 1} of ${characters.length}: ${e instanceof Error ? e.message : String(e)}`);
        }
      });
    }
    default:
      throw new Error(`Unsupported file format: ${String(data.format)}`);
  }
}

function importOne(entity: unknown): ImportedCharacter {
  // importCharacter accepts any object, so check for a strict entity first.
  if (!isObject(entity) || !("~:orcpub.entity.strict/selections" in entity)) {
    throw new Error("This is not a character file");
  }
  const imported = engine().importCharacter(entity);
  const name = engine().evaluate(imported.entity).built["character-name"];
  return { ...imported, name: name || null };
}

function checkVersion(data: Record<string, unknown>) {
  if (data.version !== 1) throw new Error(`Unsupported ${String(data.format)} version: ${String(data.version)}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
