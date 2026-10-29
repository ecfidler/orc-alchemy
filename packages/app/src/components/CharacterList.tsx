import { Button, useConfirm, type Confirm } from "@orc-alchemy/ui";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { removeCharacter } from "../state/character.ts";
import type { CharacterSummary } from "../storage/characters.ts";
import { raceAndClasses, useCreateCharacter, useSummaries } from "./character-hooks.ts";
import { ExportCharacter } from "./Export.tsx";

/** The New character and Random character buttons of the character list. */
export function NewCharacter() {
  const { create, error } = useCreateCharacter();
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        <Button onClick={() => create(false)}>
          New character
        </Button>
        <Button onClick={() => create(true)}>
          Random character
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

/** The character list, sorted by name. */
export function CharacterList() {
  const { summaries, error, retry } = useSummaries();
  // Keeps keyboard focus in the list when a deleted row goes.
  const listRef = useRef<HTMLDivElement>(null);
  const sorted = summaries && [...summaries].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const [confirm, confirmDialog] = useConfirm();

  return (
    <div ref={listRef} tabIndex={-1} className="outline-none">
      {confirmDialog}
      {error !== null ? (
        <>
          <p role="alert">{error}</p>
          <Button onClick={retry} variant="link">
            Try again
          </Button>
        </>
      ) : sorted === null ? (
        <p role="status">Loading characters…</p>
      ) : sorted.length === 0 ? (
        <p>No characters yet. Import a character file to add one.</p>
      ) : (
        <ul aria-label="Characters" className="divide-y divide-rule">
          {sorted.map((summary) => (
            <CharacterRow key={summary.id} summary={summary} confirm={confirm} onDeleted={() => listRef.current?.focus()} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CharacterRow({ summary, confirm, onDeleted }: { summary: CharacterSummary; confirm: Confirm; onDeleted: () => void }) {
  const name = summary.name ?? "Unnamed character";
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    if (!(await confirm(`Delete ${name}? This cannot be undone.`, "Delete"))) return;
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
        <p>{raceAndClasses(summary)}</p>
      </div>
      <ExportCharacter id={summary.id} label={<>Export <span className="sr-only">{name}</span></>} />
      <Button onClick={onDelete} variant="link">
        Delete <span className="sr-only">{name}</span>
      </Button>
      {error && <p role="alert">{error}</p>}
    </li>
  );
}
