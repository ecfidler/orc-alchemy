import { useState, type ReactNode } from "react";
import { loadEngine } from "../engine/engine.ts";
import { characterFile, exportBundle } from "../engine/import.ts";
import { flushAutosave } from "../state/character.ts";
import { getCharacter, listCharacters } from "../storage/characters.ts";

/** Downloads a stored character as a dmv-character file, after saving any pending changes. Loads the engine on demand. */
export function ExportCharacter({ id, label = "Export this character" }: { id: string; label?: ReactNode }) {
  return (
    <ExportButton
      label={label}
      onExport={async () => {
        await Promise.all([loadEngine(), flushAutosave()]);
        const record = await getCharacter(id);
        if (record === undefined) throw new Error("The character is no longer stored");
        download(`${fileName(record.name)}.json`, characterFile(record));
      }}
    />
  );
}

/** Downloads every stored character as a dmv-export bundle. Loads the engine on demand. */
export function ExportEverything() {
  return (
    <ExportButton
      label="Export everything"
      onExport={async () => {
        await Promise.all([loadEngine(), flushAutosave()]);
        const records = await listCharacters();
        if (records.length === 0) throw new Error("There are no characters to export");
        download("dmv-export.json", exportBundle(records.map((r) => r.entity), window.location.origin));
      }}
    />
  );
}

function ExportButton({ label, onExport }: { label: ReactNode; onExport: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  async function onClick() {
    setError(null);
    try {
      await onExport();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="space-y-1">
      <button type="button" onClick={onClick} className="underline">
        {label}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Some browsers read the blob after click() returns, so keep it a while.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

/** The browser replaces any characters a file system refuses. */
const fileName = (name: string | null) => name?.trim() || "character";
