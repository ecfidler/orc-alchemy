import { useState } from "react";
import { conflictSources, copyOn, internalCopies, resolutionsFor, settledBy, conflictsToChoose, type KeyConflict, type Resolution } from "../engine/conflicts.ts";
import { useHomebrew, type PendingImport } from "../state/homebrew.ts";

/** The words for one choice on one conflict. */
function choiceLabel(conflict: KeyConflict, choice: Resolution, homebrew: Record<string, object>): string {
  if (conflict.type === "external") {
    switch (choice) {
      case "rename":
        return `Rename the imported one to ${conflict["suggested-new-key"]}`;
      case "skip":
        return `Skip it: keep the one from ${conflict["existing-source"]}`;
      case "replace":
        return `Replace the one from ${conflict["existing-source"]} with the imported one`;
    }
  }
  const { others, kept } = internalCopies(conflict, homebrew);
  if (choice === "rename") return `Rename ${others.map((o) => `the one in ${o.source} to ${o.newKey}`).join(", ")}`;
  return `Skip: keep only the one in ${kept}`;
}

/** The conflict as the old modal describes it, with each copy that is off marked: an off copy does not keep the key. */
function ConflictText({ conflict, homebrew }: { conflict: KeyConflict; homebrew: Record<string, object> }) {
  if (conflict.type === "external") {
    return (
      <p>
        Imported: {conflict["import-name"]} from {conflict["import-source"]}. Loaded: {conflict["existing-name"]} from {conflict["existing-source"]}.
      </p>
    );
  }
  const copy = (s: { source: string; name?: string }) =>
    `${s.name ? `${s.name} in ${s.source}` : s.source}${copyOn(conflict, s.source, homebrew) ? "" : " (off)"}`;
  return <p>In more than one pack of the file: {conflictSources(conflict).map(copy).join("; ")}.</p>;
}

/**
 * The conflict step of an .orcbrew import (the old conflict resolution
 * modal): a choice for each key conflict, Rename all and Skip all, and the
 * buttons to apply the choices and import, or to cancel the import. Nothing
 * of the file is stored before Apply.
 */
export function ConflictResolution({ pending }: { pending: PendingImport }) {
  const { conflicts, fileName } = pending.result;
  const [choices, setChoices] = useState<Record<string, Resolution>>({});
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const toChoose = conflictsToChoose(conflicts, pending.homebrew);
  const decided = toChoose.filter((c) => choices[c.id] !== undefined).length;

  const chooseAll = (choice: "rename" | "skip") => setChoices(Object.fromEntries(toChoose.map((c) => [c.id, choice])));

  async function apply() {
    setError(null);
    setApplying(true);
    try {
      await useHomebrew.getState().resolveConflicts(choices);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <section aria-label="Resolve key conflicts" className="space-y-2 border border-black p-2">
      <h3 className="font-bold">Key conflicts in {fileName}</h3>
      <p>
        {conflicts.length} {conflicts.length === 1 ? "key is" : "keys are"} used by more than one item. Choose what to do with each before
        the file is imported.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => chooseAll("rename")} className="border border-black px-3 py-1">
          Rename all
        </button>
        <button type="button" onClick={() => chooseAll("skip")} className="border border-black px-3 py-1">
          Skip all
        </button>
      </div>
      <ul className="space-y-2">
        {conflicts.map((conflict) => (
          <li key={conflict.id}>
            <fieldset className="border-l-4 border-black pl-2">
              <legend className="font-bold">
                {conflict["content-type-name"]}: {conflict.key}
              </legend>
              <ConflictText conflict={conflict} homebrew={pending.homebrew} />
              {settledBy(conflict, conflicts, pending.homebrew) ? (
                <p>The choice for {conflict.key} in more than one pack of the file settles this one: it renames or removes this copy.</p>
              ) : (
                resolutionsFor(conflict).map((choice) => (
                  <label key={choice} className="block">
                    <input
                      type="radio"
                      name={conflict.id}
                      checked={choices[conflict.id] === choice}
                      onChange={() => setChoices((current) => ({ ...current, [conflict.id]: choice }))}
                    />{" "}
                    {choiceLabel(conflict, choice, pending.homebrew)}
                  </label>
                ))
              )}
            </fieldset>
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={decided < toChoose.length || applying}
          onClick={apply}
          className="border border-black px-3 py-1 disabled:opacity-50"
        >
          {decided < toChoose.length ? `Choose for each conflict (${decided} of ${toChoose.length})` : "Apply and import"}
        </button>
        <button type="button" onClick={() => useHomebrew.getState().cancelImport()} className="underline">
          Cancel import
        </button>
      </div>
    </section>
  );
}
