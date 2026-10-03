import { useEffect, useState } from "react";
import { Link } from "react-router";
import { removeCharacter } from "../state/character.ts";
import { listSummaries, useSummariesVersion, type CharacterSummary } from "../storage/characters.ts";
import { ExportCharacter } from "./Export.tsx";

/** The stored characters, from the summaries index, re-read whenever a summary is written or deleted. */
export function CharacterList() {
  const version = useSummariesVersion();
  const [summaries, setSummaries] = useState<CharacterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A slow read must not replace a later one.
    let current = true;
    listSummaries().then(
      (list) => {
        if (!current) return;
        setSummaries(list.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
        setError(null);
      },
      () => current && setError("The characters could not be read from this browser"),
    );
    return () => {
      current = false;
    };
  }, [version]);

  if (error !== null) return <p role="alert">{error}</p>;
  if (summaries === null) return <p role="status">Loading characters…</p>;
  if (summaries.length === 0) return <p>No characters yet. Import a character file to add one.</p>;
  return (
    <ul aria-label="Characters" className="divide-y divide-black">
      {summaries.map((summary) => (
        <CharacterRow key={summary.id} summary={summary} />
      ))}
    </ul>
  );
}

function CharacterRow({ summary }: { summary: CharacterSummary }) {
  const name = summary.name ?? "Unnamed character";
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setError(null);
    try {
      await removeCharacter(summary.id);
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
      <ExportCharacter id={summary.id} label="Export" />
      <button type="button" onClick={onDelete} className="underline">
        Delete
      </button>
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
