// The loaded homebrew: the multi-plugin map, the old app's :plugins, keyed
// by pack name. In memory only for now; ORC-53 stores it.
import { create } from "zustand";
import { engine, type ParsedOrcbrew } from "../engine/engine.ts";

interface HomebrewState {
  /** The loaded packs, or undefined with none, so the character builds against the SRD alone. */
  homebrew: Record<string, object> | undefined;
  /** The last file's import, kept raw: the UI shows its log, which lists skipped items, and its conflicts. */
  lastImport: Omit<ParsedOrcbrew, "data"> | null;
  /**
   * Merges an .orcbrew file's text into the homebrew, skipping invalid items.
   * A single-plugin file loads as a pack named for the file. A failed import
   * leaves the homebrew as it was. Needs the engine loaded.
   */
  load: (fileName: string, text: string) => void;
  /** Removes a pack. */
  remove: (pack: string) => void;
}

export const useHomebrew = create<HomebrewState>()((set, get) => ({
  homebrew: undefined,
  lastImport: null,
  load: (fileName, text) => {
    const { data, ...lastImport } = engine().parseOrcbrew(text, { name: fileName.replace(/\.orcbrew$/i, ""), existing: get().homebrew });
    set(data === null ? { lastImport } : { homebrew: data, lastImport });
  },
  remove: (pack) => {
    const { [pack]: _removed, ...rest } = get().homebrew ?? {};
    set({ homebrew: Object.keys(rest).length === 0 ? undefined : rest });
  },
}));
