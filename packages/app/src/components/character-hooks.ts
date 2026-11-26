import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { NAME_STEP } from "../engine/builder.ts";
import { loadEngine } from "../engine/engine.ts";
import { newCharacter } from "../engine/new-character.ts";
import { addCharacter, refreshSummaries } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { type CharacterSummary, listSummaries, useSummariesVersion } from "../storage/characters.ts";

/**
 * Stores a new character and opens it in the builder, on the Name step with
 * the focus in the name field (ORC-342). A new character has no class
 * (newCharacter). A random one is the engine's new character that autofill
 * completes, with no name. Loads the engine on demand.
 */
export function useCreateCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function create(random: boolean) {
    setError(null);
    try {
      const e = await loadEngine();
      await restorePacks(); // so its summary builds with the stored packs
      const entity = random ? e.autofill(e.emptyCharacter(), useHomebrew.getState().content) : newCharacter(e);
      navigate(`/build/${await addCharacter(entity, "2014", null)}?step=${NAME_STEP}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return { create, error };
}

/**
 * The stored characters, from the summaries index, re-read whenever a
 * summary is written or deleted, the packs change, or on retry. Summaries
 * built with other homebrew are rebuilt in the background.
 */
export function useSummaries() {
  const version = useSummariesVersion();
  const fingerprint = useHomebrew((state) => state.fingerprint);
  const [attempt, setAttempt] = useState(0);
  const [summaries, setSummaries] = useState<CharacterSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A slow read must not replace a later one.
    let current = true;
    listSummaries().then(
      (list) => {
        if (!current) return;
        setSummaries(list);
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

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };
  return { summaries, error, retry };
}

/** The race and classes line of a character row, for example "Half-Elf · Fighter 3 / Wizard 2". */
export function raceAndClasses(summary: CharacterSummary) {
  return [summary.race, summary.classes.map((c) => `${c.name} ${c.level}`).join(" / ")].filter(Boolean).join(" · ");
}
