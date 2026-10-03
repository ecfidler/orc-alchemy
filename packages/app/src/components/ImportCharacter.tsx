import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { readCharacterFile, type ImportedCharacter } from "../engine/import.ts";
import { useCharacter } from "../state/character.ts";

/**
 * Opens a character file: one saved from the old app, a dmv-character file, or
 * a dmv-export bundle. One character opens its sheet; a bundle lists its
 * characters to open. Loads the engine on demand.
 */
export function ImportCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedCharacter[]>([]);

  function open(character: ImportedCharacter) {
    useCharacter.getState().load(character.entity);
    navigate("/sheet");
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // so choosing the same file again fires onChange
    setError(null);
    setImported([]);
    try {
      const text = await file.text();
      await loadEngine();
      const characters = readCharacterFile(text);
      if (characters.length === 1) open(characters[0]);
      else setImported(characters);
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
      {imported.length > 0 && (
        <section aria-label="Imported characters">
          <h2 className="text-lg">Imported {imported.length} characters</h2>
          <ul>
            {imported.map((character, i) => (
              <li key={i}>
                <button type="button" onClick={() => open(character)} className="underline">
                  {character.name ?? "Unnamed character"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
