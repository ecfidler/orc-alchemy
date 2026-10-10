import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { addCharacter, refreshSummaries, removeCharacter } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { listSummaries, useSummariesVersion, type CharacterSummary } from "../storage/characters.ts";
import { ExportCharacter } from "./Export.tsx";

/**
 * Stores a new character and opens it in the builder. New character stores
 * the engine's new character, a level 1 barbarian. Random character stores
 * one that autofill completes, with no name. Loads the engine on demand.
 */
export function NewCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function create(random: boolean) {
    setError(null);
    try {
      const { emptyCharacter, autofill } = await loadEngine();
      await restorePacks(); // so its summary builds with the stored packs
      const entity = random ? autofill(emptyCharacter(), useHomebrew.getState().content) : emptyCharacter();
      navigate(`/build/${await addCharacter(entity, "2014", null)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => create(false)} className="border border-black px-3 py-1">
          New character
        </button>
        <button type="button" onClick={() => create(true)} className="border border-black px-3 py-1">
          Random character
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/**
 * The stored characters, from the summaries index, re-read whenever a
 * summary is written or deleted, the packs change, or on Try again. Summaries
 * built with other homebrew are rebuilt in the background.
 */
export function CharacterList() {
  const version = useSummariesVersion();
  const fingerprint = useHomebrew((state) => state.fingerprint);
  const [attempt, setAttempt] = useState(0);
  const [summaries, setSummaries] = useState<CharacterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keeps keyboard focus in the list when a deleted row goes.
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // A slow read must not replace a later one.
    let current = true;
    listSummaries().then(
      (list) => {
        if (!current) return;
        setSummaries(list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
        setError(null);
        // Its write changes useSummariesVersion, so the list is read again and finds nothing stale.
        refreshSummaries(list, () => current).catch(console.error);
      },
      () => current && setError("The characters could not be read from this browser"),
    );
    return () => {
      current = false;
    };
  }, [version, attempt, fingerprint]);

  return (
    <div ref={listRef} tabIndex={-1} className="outline-none">
      {error !== null ? (
        <>
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
            className="underline"
          >
            Try again
          </button>
        </>
      ) : summaries === null ? (
        <p role="status">Loading characters…</p>
      ) : summaries.length === 0 ? (
        <p>No characters yet. Import a character file to add one.</p>
      ) : (
        <ul aria-label="Characters" className="divide-y divide-black">
          {summaries.map((summary) => (
            <CharacterRow key={summary.id} summary={summary} onDeleted={() => listRef.current?.focus()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterRow({ summary, onDeleted }: { summary: CharacterSummary; onDeleted: () => void }) {
  const name = summary.name ?? "Unnamed character";
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setError(null);
    try {
      await removeCharacter(summary.id);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <li aria-label={name} className="flex flex-wrap items-center gap-3 py-2">
      {summary.portrait && <img src={summary.portrait} alt="" className="h-12 w-12 object-cover" />}
      <div className="flex-1">
        <Link to={`/sheet/${summary.id}`} className="font-bold underline">
          {name}
        </Link>
        <p>{[summary.race, summary.classes.map((c) => `${c.name} ${c.level}`).join(" / ")].filter(Boolean).join(" · ")}</p>
      </div>
      <ExportCharacter id={summary.id} label={<>Export <span className="sr-only">{name}</span></>} />
      <button type="button" onClick={onDelete} className="underline">
        Delete <span className="sr-only">{name}</span>
      </button>
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
