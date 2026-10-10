import { useState, type ReactNode } from "react";
import { loadEngine } from "../engine/engine.ts";
import { characterFile, exportBundle } from "../engine/import.ts";
import { exportOrcbrew } from "../engine/orcbrew-export.ts";
import { flushAutosave } from "../state/character.ts";
import { bundleHomebrew, orcbrewHomebrew, restorePacks, useHomebrew } from "../state/homebrew.ts";
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
 * Downloads every stored character, pack and magic item as a dmv-export
 * bundle, and the packs as all-content.orcbrew for the old app. The packs go in as stored,
 * disabled ones too: the bundle keeps their flags, and the .orcbrew file
 * marks them with the old app's :disabled? flag. A pack that fails validateForExport stops the .orcbrew file, not
 * the bundle. Quarantined records are left out, with a notice. Loads the
 * engine on demand.
 */
export function ExportEverything() {
  return (
    <div>
      <ExportButton
        label="Export everything"
        onExport={async () => {
          await Promise.all([loadEngine(), flushAutosave(), restorePacks()]);
          const records = await listCharacters();
          const packs = bundleHomebrew();
          const hasPacks = Object.keys(packs.homebrew).length > 0;
          const magicItems = useHomebrew.getState().magicItems.map((r) => r.item);
          if (records.length === 0 && !hasPacks && magicItems.length === 0) throw new Error("There are no characters or homebrew to export");
          download("dmv-export.json", exportBundle(records.map((r) => r.entity), window.location.origin, packs, magicItems));
          const notices: string[] = [];
          const { quarantined } = useHomebrew.getState();
          if (quarantined.length > 0) {
            notices.push(`These stored packs could not be read and are not in the export: ${quarantined.map((q) => q.id).join(", ")}.`);
          }
          if (hasPacks) {
            const orcbrew = exportOrcbrew(orcbrewHomebrew(), { pretty: true });
            if ("invalid" in orcbrew) {
              const names = orcbrew.invalid.map((p) => p.pack).join(", ");
              notices.push(`all-content.orcbrew was not written: the old app would refuse ${names}. To see why, or to export anyway, use My Content.`);
            } else downloadText(orcbrew.fileName, orcbrew.text, "application/edn");
          }
          return notices.join(" ") || undefined;
        }}
      />
      <p>With homebrew, it also writes all-content.orcbrew for the old app. That file has no magic items, because the old app has no magic-item homebrew.</p>
    </div>
  );
}

/** onExport returns a notice to show when the export is only partly done. */
function ExportButton({ label, onExport }: { label: ReactNode; onExport: () => Promise<string | void> }) {
  /** Why the export failed, or the notice of a partial export. */
  const [message, setMessage] = useState<string | null>(null);
  async function onClick() {
    setMessage(null);
    try {
      setMessage((await onExport()) ?? null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <div className="space-y-1">
      <button type="button" onClick={onClick} className="underline">
        {label}
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}

function download(name: string, data: unknown) {
  downloadText(name, JSON.stringify(data, null, 2), "application/json");
}

/** Downloads text as a file. */
export function downloadText(name: string, text: string, type: string) {
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
