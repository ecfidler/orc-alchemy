import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { isBundleText, readBundleHomebrew, readCharacterFile, type UnresolvedKey } from "../engine/import.ts";
import { addCharacter } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { ImportLog } from "./ImportLog.tsx";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A chosen file's name and text. */
interface ChosenFile {
  name: string;
  text: string;
}

/** The text of the chosen file, or null with none. Clears the input, so choosing the same file again fires onChange. */
async function chosenText(event: ChangeEvent<HTMLInputElement>): Promise<ChosenFile | null> {
  const input = event.target;
  const file = input.files?.[0];
  if (!file) return null;
  input.value = "";
  return { name: file.name, text: await file.text() };
}

/**
 * The Import page: homebrew first, then characters, as the old app's content
 * must load before the characters that use it. Each section loads the
 * engine on demand.
 */
export function ImportPage() {
  return (
    <>
      <h1 className="text-xl">Import</h1>
      <p>Import your homebrew first, then your characters, so the characters find the content they use.</p>
      <HomebrewImport />
      <CharacterImport />
    </>
  );
}

/**
 * Step 1: loads .orcbrew files, progressive by default or strict on request,
 * and shows the last import's log. Lists the stored packs to enable,
 * disable or remove, and warns about stored records that could not be read.
 */
function HomebrewImport() {
  const packs = useHomebrew((state) => state.packs);
  const quarantined = useHomebrew((state) => state.quarantined);
  const lastImport = useHomebrew((state) => state.lastImport);
  const [strict, setStrict] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    restorePacks()
      .catch((e) => setError(`The stored homebrew could not be read from this browser: ${message(e)}`))
      .finally(() => setRestored(true));
  }, []);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    try {
      const file = await chosenText(event);
      if (file === null) return;
      await loadEngine();
      await useHomebrew.getState().load(file.name, file.text, { strict });
    } catch (e) {
      setError(message(e));
    }
  }

  /** Shows the error if the action fails. */
  function report(action: Promise<void>) {
    setError(null);
    action.catch((e) => setError(message(e)));
  }

  return (
    <section aria-label="Homebrew" className="mt-4 space-y-2">
      <h2 className="text-lg">1. Homebrew</h2>
      <p>An .orcbrew file, such as all-content.orcbrew from My Content in Dungeon Master's Vault.</p>
      <label className="block">
        Load homebrew file <input type="file" accept=".orcbrew" onChange={onChange} className="block" />
      </label>
      <label className="block">
        <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} /> Strict: if an item is invalid, import
        nothing from the file
      </label>
      {error && <p role="alert">{error}</p>}
      {lastImport && <ImportLog result={lastImport} />}
      {!restored && <p role="status">Reading the stored homebrew…</p>}
      {quarantined.length > 0 && (
        <div role="alert" aria-label="Unreadable homebrew packs">
          <ul>
            {quarantined.map(({ id, reason }) => (
              <li key={id}>
                The stored pack {id} could not be read, so it is not used. It is kept in this browser as it is. {reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {packs.length > 0 && (
        <ul aria-label="Homebrew packs">
          {packs.map(({ id, enabled }) => (
            <li key={id} aria-label={id}>
              <label>
                <input type="checkbox" checked={enabled} onChange={(e) => report(useHomebrew.getState().setPackEnabled(id, e.target.checked))} /> {id}
              </label>{" "}
              <button type="button" onClick={() => report(useHomebrew.getState().remove(id))} aria-label={`Remove ${id}`} className="underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The character steps of the page: 2, a bundle, or 3, one character. */
type Step = "bundle" | "character";

interface Imported {
  characters: { id: string; name: string | null; unresolved: UnresolvedKey[] }[];
  failures: string[];
  /** How many homebrew packs the bundle had. */
  packs: number;
}

/**
 * Steps 2 and 3: a dmv-export bundle, or one character as a file saved from
 * the old app, a dmv-character file, or the text of the old app's public
 * character URL pasted in. Each step refuses the other step's files. A
 * bundle's packs are loaded first, so its characters resolve against them.
 * Each character is stored and checked against the loaded packs. One
 * character opens its sheet; a bundle, or one character with keys that do
 * not resolve, lists its characters to open, with their unresolved keys and
 * any that failed.
 */
function CharacterImport() {
  const navigate = useNavigate();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<{ step: Step; text: string } | null>(null);
  const [imported, setImported] = useState<Imported | null>(null);

  /** Imports the text that read gives, or nothing when it gives null; the file name is for the import log. */
  async function importText(step: Step, read: () => Promise<ChosenFile | null>) {
    setError(null);
    setImported(null);
    try {
      const chosen = await read();
      if (chosen === null) return;
      const { name, text } = chosen;
      if (step === "bundle" && !isBundleText(text)) {
        throw new Error("This is not a dmv-export bundle. To import one character, use step 3.");
      }
      if (step === "character" && isBundleText(text)) {
        throw new Error("This is a dmv-export bundle. Import it in step 2.");
      }
      await loadEngine();
      await restorePacks(); // so each summary builds with the stored packs
      const bundle = readBundleHomebrew(text);
      if (bundle !== null) await useHomebrew.getState().loadBundle(bundle, name);
      const file = readCharacterFile(text, useHomebrew.getState().homebrew);
      const characters = await Promise.all(
        file.characters.map(async (c) => ({
          id: await addCharacter(c.entity, c.rules, c.legacyId),
          name: c.name,
          unresolved: c.unresolved,
        })),
      );
      if (bundle === null && characters.length === 1 && file.failures.length === 0 && characters[0].unresolved.length === 0) {
        navigate(`/sheet/${characters[0].id}`);
      } else {
        setImported({ characters, failures: file.failures, packs: bundle === null ? 0 : Object.keys(bundle.homebrew).length });
      }
    } catch (e) {
      setError({ step, text: message(e) });
    }
  }

  const errorFor = (step: Step) => error?.step === step && <p role="alert">{error.text}</p>;

  return (
    <>
      <section aria-label="Character bundle" className="mt-4 space-y-2">
        <h2 className="text-lg">2. Character bundle</h2>
        <p>The dmv-export.json file from the exporter bookmarklet, or from Export everything in this app. It can hold homebrew too.</p>
        <label className="block">
          Import dmv-export bundle{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => importText("bundle", () => chosenText(e))}
            className="block"
          />
        </label>
        {errorFor("bundle")}
      </section>
      <section aria-label="One character" className="mt-4 space-y-2">
        <h2 className="text-lg">3. One character</h2>
        <p>A character file, or the text that the old app's public character link shows.</p>
        <label className="block">
          Import character file{" "}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => importText("character", () => chosenText(e))}
            className="block"
          />
        </label>
        <label className="block">
          Paste the character's text
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={4} className="block w-full border border-black p-1 font-mono text-xs" />
        </label>
        <button
          type="button"
          disabled={pasted.trim() === ""}
          onClick={() => importText("character", async () => ({ name: "pasted text", text: pasted }))}
          className="border border-black px-3 py-1 disabled:opacity-50"
        >
          Import pasted character
        </button>
        {errorFor("character")}
      </section>
      {imported && (
        <section aria-label="Imported characters" className="mt-4">
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
    </>
  );
}
