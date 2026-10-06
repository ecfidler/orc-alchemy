import { useEffect, useState, type ChangeEvent } from "react";
import { loadEngine } from "../engine/engine.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Loads .orcbrew homebrew files and lists the stored packs to enable, disable
 * or remove, and warns about stored records that could not be read. The last
 * import's log and conflicts show raw; the import panels are M5. Loads the
 * engine on demand.
 */
export function LoadHomebrew() {
  const packs = useHomebrew((state) => state.packs);
  const quarantined = useHomebrew((state) => state.quarantined);
  const lastImport = useHomebrew((state) => state.lastImport);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    restorePacks()
      .catch((e) => setError(`The stored homebrew could not be read from this browser: ${message(e)}`))
      .finally(() => setRestored(true));
  }, []);

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ""; // so choosing the same file again fires onChange
    setError(null);
    try {
      const text = await file.text();
      await loadEngine();
      await useHomebrew.getState().load(file.name, text);
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
      <label className="block">
        Load homebrew file <input type="file" accept=".orcbrew" onChange={onChange} className="block" />
      </label>
      {error && <p role="alert">{error}</p>}
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
