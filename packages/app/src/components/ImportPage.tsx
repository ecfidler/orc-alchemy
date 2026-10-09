import { useEffect, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { isBundleText, readBundleHomebrew, readCharacterFile } from "../engine/import.ts";
import type { UnresolvedKey } from "../engine/reconcile.ts";
import { addCharacter, checkStoredCharacter, remapStoredCharacter } from "../state/character.ts";
import { packOn, restorePacks, useHomebrew } from "../state/homebrew.ts";
import { ConflictResolution } from "./ConflictResolution.tsx";
import { ImportLog } from "./ImportLog.tsx";
import { UnresolvedContent } from "./UnresolvedContent.tsx";

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
 * asks for a choice on each key conflict before a file is stored, and shows
 * the last import's log. Lists the stored packs, which My Content manages,
 * and warns about stored records that could not be read.
 */
function HomebrewImport() {
  const packs = useHomebrew((state) => state.packs);
  const quarantined = useHomebrew((state) => state.quarantined);
  const lastImport = useHomebrew((state) => state.lastImport);
  const pending = useHomebrew((state) => state.pending);
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
      {pending && <ConflictResolution key={pending.id} pending={pending} />}
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
        <>
          <p>
            These packs are loaded. To enable or disable packs or items, export them, or delete them, use{" "}
            <Link to="/content" className="underline">
              My Content
            </Link>
            .
          </p>
          <ul aria-label="Homebrew packs" className="ml-4 list-disc">
            {packs.map((pack) => (
              <li key={pack.id} aria-label={pack.id}>
                {pack.id}
                {!packOn(pack) && " (disabled)"}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** The character steps of the page: 2, a bundle, or 3, one character. */
type Step = "bundle" | "character";
/** Where an error shows: under a step, or under Check again. */
type ErrorPlace = Step | "checked";

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
 * any that failed. An unresolved key can be remapped to a suggestion. It
 * can also be checked again after its pack is loaded in step 1. The import
 * never waits for either.
 */
function CharacterImport() {
  const navigate = useNavigate();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<{ step: ErrorPlace; text: string } | null>(null);
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

  /** Puts a character's new unresolved keys in the list. */
  const setUnresolved = (id: string, unresolved: UnresolvedKey[]) =>
    setImported((current) => current && { ...current, characters: current.characters.map((c) => (c.id === id ? { ...c, unresolved } : c)) });

  async function checkAgain() {
    if (imported === null) return;
    setError(null);
    const failed: string[] = [];
    for (const { id, name } of imported.characters) {
      try {
        const unresolved = await checkStoredCharacter(id);
        if (unresolved !== null) setUnresolved(id, unresolved);
      } catch (e) {
        failed.push(`${name ?? "Unnamed character"}: ${message(e)}`);
      }
    }
    // One failed check does not stop the others; each is named.
    if (failed.length > 0) setError({ step: "checked", text: `Could not check again. ${failed.join(" ")}` });
  }

  const errorFor = (step: ErrorPlace) => error?.step === step && <p role="alert">{error.text}</p>;

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
                <div className="ml-4">
                  <UnresolvedContent
                    characterName={character.name ?? "Unnamed character"}
                    unresolved={character.unresolved}
                    onRemap={async ({ path }, to) => setUnresolved(character.id, await remapStoredCharacter(character.id, path, to))}
                  />
                </div>
              </li>
            ))}
          </ul>
          {imported.characters.some((c) => c.unresolved.length > 0) && (
            <div className="space-y-1">
              <p>Missing a homebrew pack? Load it in step 1, then check again.</p>
              <button type="button" onClick={checkAgain} className="border border-black px-3 py-1">
                Check again
              </button>
              {errorFor("checked")}
            </div>
          )}
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
