// The spell lookup over the loaded content (ORC-280): the SRD spells, which
// load as their own chunk, and the enabled packs of the homebrew store.
import { useMemo } from "react";
import { type SpellLookup, spellLookup } from "../engine/spell-records.ts";
import { useSpellContent } from "../engine/spells.ts";
import { useHomebrew } from "./homebrew.ts";

/** The lookup from a spell key to its record; null until the SRD spells load. A first call starts the load. */
export function useSpellLookup(): SpellLookup | null {
  const srd = useSpellContent();
  const homebrew = useHomebrew((state) => state.homebrew);
  return useMemo(() => (srd === null ? null : spellLookup(srd, homebrew)), [srd, homebrew]);
}
