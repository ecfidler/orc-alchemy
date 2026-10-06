import { useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { readBundleHomebrew, readCharacterFile, type UnresolvedKey } from "../engine/import.ts";
import { addCharacter } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";

interface Imported {
  characters: { id: string; name: string | null; unresolved: UnresolvedKey[] }[];
  failures: string[];
  /** How many homebrew packs the bundle had. */
  packs: number;
}

/**
 * Imports a character file: one saved from the old app, a dmv-character file,
 * or a dmv-export bundle. A bundle's packs are loaded first, so its characters
 * resolve against them. Each character is stored and checked against the
 * loaded packs. One character opens its sheet; a bundle, or one character
 * with keys that do not resolve, lists its characters to open, with their
 * unresolved keys and any that failed. Loads the engine on demand.
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
      await restorePacks(); // so each summary builds with the stored packs
      const bundle = readBundleHomebrew(text);
      if (bundle !== null) await useHomebrew.getState().loadBundle(bundle);
      const read = readCharacterFile(text, useHomebrew.getState().homebrew);
      const characters = await Promise.all(
        read.characters.map(async (c) => ({
          id: await addCharacter(c.entity, c.rules, c.legacyId),
          name: c.name,
          unresolved: c.unresolved,
        })),
      );
      if (bundle === null && characters.length === 1 && read.failures.length === 0 && characters[0].unresolved.length === 0) {
        navigate(`/sheet/${characters[0].id}`);
      } else {
        setImported({ characters, failures: read.failures, packs: bundle === null ? 0 : Object.keys(bundle.homebrew).length });
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
          {imported.packs > 0 && (
            <p>
              Loaded {imported.packs} homebrew {imported.packs === 1 ? "pack" : "packs"}
            </p>
          )}
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
