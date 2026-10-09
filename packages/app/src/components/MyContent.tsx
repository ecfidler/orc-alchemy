// My Content (ORC-72, ORC-73), as the old app's My Content page
// (views.cljs my-content): the stored packs, each with its content lists, and
// the .orcbrew export of one pack or of all of them.
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { CONTENT_TYPES, packItems } from "../engine/content.ts";
import { loadEngine } from "../engine/engine.ts";
import { exportOrcbrew, type PackProblems } from "../engine/orcbrew-export.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import type { PackRecord } from "../storage/packs.ts";
import { downloadText } from "./Export.tsx";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The page: Export all and the pretty-print choice, the records that could
 * not be read, and each stored pack. A pack or item turned off is left out
 * of every character's build; Delete removes it from this browser.
 */
export function MyContent() {
  const packs = useHomebrew((state) => state.packs);
  const quarantined = useHomebrew((state) => state.quarantined);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pretty, setPretty] = useState(false);

  useEffect(() => {
    restorePacks()
      .catch((e) => setError(`The stored homebrew could not be read from this browser: ${message(e)}`))
      .finally(() => setRestored(true));
  }, []);

  /** Shows the error if the action fails. */
  function report(action: Promise<void>) {
    setError(null);
    action.catch((e) => setError(message(e)));
  }

  return (
    <>
      <h1 className="text-xl">My Content</h1>
      <p>
        Your homebrew packs. To add one, use the{" "}
        <Link to="/import" className="underline">
          Import page
        </Link>
        .
      </p>
      <p>
        Magic items are not in .orcbrew files, because the old app has no magic-item homebrew. Magic items as homebrew come in a later
        version.
      </p>
      {error && <p role="alert">{error}</p>}
      {!restored && <p role="status">Reading the stored homebrew…</p>}
      {quarantined.length > 0 && (
        <section aria-label="Unreadable homebrew packs" className="mt-4 space-y-1">
          <h2 className="text-lg">Packs that could not be read</h2>
          <ul>
            {quarantined.map(({ id, reason }) => (
              <li key={id}>
                The stored pack {id} could not be read, so it is not used. It is kept in this browser as it is. {reason}{" "}
                <button type="button" onClick={() => confirmed(`Delete the unreadable pack ${id}?`) && report(useHomebrew.getState().removeQuarantined(id))} className="underline">
                  Delete {id}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {packs.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label>
              <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} /> Pretty-print exported files
            </label>
            <OrcbrewExport label="Export all" pretty={pretty} />
          </div>
          <ul className="mt-4 space-y-4">
            {packs.map((pack) => (
              <li key={pack.id}>
                <Pack pack={pack} pretty={pretty} report={report} />
              </li>
            ))}
          </ul>
        </>
      )}
      {restored && packs.length === 0 && quarantined.length === 0 && <p className="mt-4">There is no homebrew in this browser.</p>}
    </>
  );
}

const confirmed = (question: string) => window.confirm(question);

/** One pack: its enabled checkbox, Export and Delete, and its content lists. */
function Pack({ pack, pretty, report }: { pack: PackRecord; pretty: boolean; report: (action: Promise<void>) => void }) {
  const { id, enabled, plugin, disabledItems } = pack;
  return (
    <section aria-label={id} className="border border-black p-2">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-bold">{id}</h2>
        <label>
          <input type="checkbox" checked={enabled} onChange={(e) => report(useHomebrew.getState().setPackEnabled(id, e.target.checked))} />{" "}
          Enabled
        </label>
        <OrcbrewExport label="Export" pack={id} pretty={pretty} />
        <button type="button" onClick={() => confirmed(`Delete the pack ${id} from this browser?`) && report(useHomebrew.getState().remove(id))} className="underline">
          Delete
        </button>
      </div>
      {CONTENT_TYPES.map(({ type, one, many }) => {
        const items = packItems(id, plugin, type);
        const tagged = `~:${type}`;
        return (
          <details key={type} className="ml-4">
            <summary>
              {items.length} {items.length === 1 ? one : many}
            </summary>
            <ul aria-label={`${id} ${many}`} className="ml-4">
              {items.map(({ key, name }) => {
                const on = !disabledItems.some(([t, k]) => t === tagged && k === `~:${key}`);
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2">
                    <label>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => report(useHomebrew.getState().setItemEnabled(id, tagged, `~:${key}`, e.target.checked))}
                      />{" "}
                      {name}
                    </label>
                    <button
                      type="button"
                      aria-label={`Delete ${name}`}
                      onClick={() => confirmed(`Delete ${name} from ${id}?`) && report(useHomebrew.getState().removeItem(id, tagged, `~:${key}`))}
                      className="underline"
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}

/**
 * Exports one pack as <pack>.orcbrew, or all packs as all-content.orcbrew,
 * as stored: disabled packs and items too, since .orcbrew has no flags. When
 * the old app would refuse the file, lists why and offers Export anyway.
 */
function OrcbrewExport({ label, pack, pretty }: { label: string; pack?: string; pretty: boolean }) {
  const [invalid, setInvalid] = useState<PackProblems[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(anyway: boolean) {
    setError(null);
    setInvalid(null);
    try {
      await loadEngine();
      const homebrew = Object.fromEntries(useHomebrew.getState().packs.map((p) => [p.id, p.plugin]));
      const result = exportOrcbrew(homebrew, { pack, pretty, anyway });
      if ("invalid" in result) setInvalid(result.invalid);
      else downloadText(result.fileName, result.text, "application/edn");
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <div>
      <button type="button" onClick={() => run(false)} className="border border-black px-3 py-1">
        {label}
      </button>
      {error && <p role="alert">{error}</p>}
      {invalid && (
        <div role="alert" aria-label={`Export problems${pack ? ` in ${pack}` : ""}`} className="mt-1">
          <p>The old app would refuse this file:</p>
          <ul className="ml-4 list-disc">
            {invalid.flatMap(({ pack: name, problems }) => problems.map((problem, i) => <li key={`${name}-${i}`}>{`${name}: ${problem}`}</li>))}
          </ul>
          <button type="button" onClick={() => run(true)} className="border border-black px-3 py-1">
            Export anyway
          </button>{" "}
          <span>It fills placeholders for the missing fields and repairs the items, as the old app did.</span>
        </div>
      )}
    </div>
  );
}
