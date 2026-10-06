import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { readCharacterFile, type UnresolvedKey } from "../engine/import.ts";
import { addCharacter } from "../state/character.ts";

interface Imported {
  characters: { id: string; name: string | null; unresolved: UnresolvedKey[] }[];
  failures: string[];
}

/**
 * Imports a character file: one saved from the old app, a dmv-character file,
 * or a dmv-export bundle. Each character is stored. One character opens its
 * sheet; a bundle, or one character with keys that do not resolve, lists its
 * characters to open, with their unresolved keys and any that failed. Loads
 * the engine on demand.
 */
export function ImportCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // so choosing the same file again fires onChange
    setError(null);
    setImported(null);
    try {
      const text = await file.text();
      await loadEngine();
      // No homebrew yet: ORC-54 passes the loaded packs.
      const read = readCharacterFile(text);
      const characters = await Promise.all(
        read.characters.map(async (c) => ({
          id: await addCharacter(c.entity, c.rules, c.legacyId),
          name: c.name,
          unresolved: c.unresolved,
        })),
      );
      if (characters.length === 1 && read.failures.length === 0 && characters[0].unresolved.length === 0) {
        navigate(`/sheet/${characters[0].id}`);
      } else {
        setImported({ characters, failures: read.failures });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <label className="block">
        Import character file{" "}
        <input type="file" accept=".json,application/json" onChange={onChange} className="block" />
      </label>
      {error && <p role="alert">{error}</p>}
      {imported && (
        <section aria-label="Imported characters">
          <h2 className="text-lg">
            Imported {imported.characters.length} {imported.characters.length === 1 ? "character" : "characters"}
          </h2>
          <ul>
            {imported.characters.map((character) => (
              <li key={character.id}>
                <button type="button" onClick={() => navigate(`/sheet/${character.id}`)} className="underline">
                  {character.name ?? "Unnamed character"}
                </button>
                {character.unresolved.length > 0 && (
                  <>
                    <p className="ml-4">Unresolved content, left out of the sheet:</p>
                    <ul aria-label={`Unresolved content for ${character.name ?? "Unnamed character"}`} className="ml-8 list-disc">
                      {character.unresolved.map(({ label, key, path }, i) => (
                        <li key={i}>
                          {label}: {key} ({path.join(" / ")})
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
          {imported.failures.length > 0 && (
            <ul role="alert">
              {imported.failures.map((failure, i) => (
                <li key={i}>{failure}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
