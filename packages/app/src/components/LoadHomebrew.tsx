import { useState, type ChangeEvent } from "react";
import { loadEngine } from "../engine/engine.ts";
import { useHomebrew } from "../state/homebrew.ts";

/**
 * Loads .orcbrew homebrew files and lists the loaded packs to remove. The
 * last import's log and conflicts show raw; the import panels are M5. Loads
 * the engine on demand.
 */
export function LoadHomebrew() {
  const homebrew = useHomebrew((state) => state.homebrew);
  const lastImport = useHomebrew((state) => state.lastImport);
  const [error, setError] = useState<string | null>(null);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // so choosing the same file again fires onChange
    setError(null);
    try {
      const text = await file.text();
      await loadEngine();
      useHomebrew.getState().load(file.name, text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const packs = Object.keys(homebrew ?? {});
  return (
    <section aria-label="Homebrew" className="mt-4 space-y-2">
      <label className="block">
        Load homebrew file <input type="file" accept=".orcbrew" onChange={onChange} className="block" />
      </label>
      {error && <p role="alert">{error}</p>}
      {packs.length > 0 && (
        <ul aria-label="Homebrew packs">
          {packs.map((pack) => (
            <li key={pack} aria-label={pack}>
              {pack}{" "}
              <button type="button" onClick={() => useHomebrew.getState().remove(pack)} aria-label={`Remove ${pack}`} className="underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {lastImport && (
        <section aria-label="Last homebrew import">
          <p className="whitespace-pre-line">{lastImport.log.message}</p>
          <pre className="max-h-64 overflow-auto border border-black p-2 text-xs">
            {JSON.stringify({ log: lastImport.log, conflicts: lastImport.conflicts }, null, 2)}
          </pre>
        </section>
      )}
    </section>
  );
}
