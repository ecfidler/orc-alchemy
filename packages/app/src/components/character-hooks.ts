import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { loadEngine } from "../engine/engine.ts";
import { addCharacter, refreshSummaries } from "../state/character.ts";
import { restorePacks, useHomebrew } from "../state/homebrew.ts";
import { listSummaries, useSummariesVersion, type CharacterSummary } from "../storage/characters.ts";

/**
 * Stores a new character and opens it in the builder. A new character is the
 * engine's new character, a level 1 barbarian. A random one is one that
 * autofill completes, with no name. Loads the engine on demand.
 */
export function useCreateCharacter() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  async function create(random: boolean) {
    setError(null);
    try {
      const { emptyCharacter, autofill } = await loadEngine();
      await restorePacks(); // so its summary builds with the stored packs
      const entity = random ? autofill(emptyCharacter(), useHomebrew.getState().content) : emptyCharacter();
      navigate(`/build/${await addCharacter(entity, "2014", null)}`);
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
