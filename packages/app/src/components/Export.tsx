import { useState, type ReactNode } from "react";
import { engine, loadEngine } from "../engine/engine.ts";
import { characterFile, exportBundle } from "../engine/import.ts";
import { flushAutosave } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
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

/**
 * Downloads every stored character and pack as a dmv-export bundle, and the
 * packs as all-content.orcbrew for the old app. The packs go in as stored,
 * disabled ones too; the bundle keeps their flags, and the .orcbrew file
 * cannot. A pack that fails validateForExport stops the .orcbrew file, not
 * the bundle. Loads the engine on demand.
 */
export function ExportEverything() {
  return (
    <ExportButton
      label="Export everything"
      onExport={async () => {
        await Promise.all([loadEngine(), flushAutosave(), restorePacks()]);
        const records = await listCharacters();
        const { packs } = useHomebrew.getState();
        if (records.length === 0 && packs.length === 0) throw new Error("There are no characters or homebrew to export");
        const homebrew = Object.fromEntries(packs.map((p) => [p.id, p.plugin]));
        const flags = Object.fromEntries(packs.map(({ id, enabled, disabledItems }) => [id, { enabled, disabledItems }]));
        download("dmv-export.json", exportBundle(records.map((r) => r.entity), window.location.origin, { homebrew, flags }));
        if (packs.length === 0) return;
        // The full export UI, with "export anyway", is ORC-73.
        const check = engine().validateForExport(homebrew);
        if (!check.valid) {
          const invalid = Object.keys(check.packs).filter((pack) => !check.packs[pack].valid);
          return `all-content.orcbrew was not written: the old app would refuse ${invalid.join(", ")}.`;
        }
        downloadText("all-content.orcbrew", engine().orcbrewToEdn(homebrew, { pretty: true }), "application/edn");
      }}
    />
  );
}

/** onExport returns a notice to show when the export is only partly done. */
function ExportButton({ label, onExport }: { label: ReactNode; onExport: () => Promise<string | void> }) {
  const [error, setError] = useState<string | null>(null);
  async function onClick() {
    setError(null);
    try {
      const notice = await onExport();
      if (notice) setError(notice);
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
  downloadText(name, JSON.stringify(data, null, 2), "application/json");
}

function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // Some browsers read the blob after click() returns, so keep it a while.
  setTimeout(() => URL.revokeObjectURL(url), 40_000);
}

/** The browser replaces any characters a file system refuses. */
const fileName = (name: string | null) => name?.trim() || "character";
