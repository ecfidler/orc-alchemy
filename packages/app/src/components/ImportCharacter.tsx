import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { readCharacterFile, type CharacterFile, type CharacterFileEntry } from "../engine/import.ts";
import { useCharacter } from "../state/character.ts";

/**
 * Opens a character file: one saved from the old app, a dmv-character file, or
 * a dmv-export bundle. One character opens its sheet; a bundle lists its
 * characters to open, and any that failed. Loads the engine on demand.
 */
export function ImportCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<CharacterFile | null>(null);

  function open(character: CharacterFileEntry) {
    useCharacter.getState().load(character.entity);
    navigate("/sheet");
  }

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
      const read = readCharacterFile(text);
      if (read.characters.length === 1 && read.failures.length === 0) open(read.characters[0]);
      else setImported(read);
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
            {imported.characters.map((character, i) => (
              <li key={i}>
                <button type="button" onClick={() => open(character)} className="underline">
                  {character.name ?? "Unnamed character"}
                </button>
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
