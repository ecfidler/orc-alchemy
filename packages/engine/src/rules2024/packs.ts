// Loading a pack for the 2024 engine: the loader of the content format, with
// the hook names of the engine, so that a record that calls an unknown hook
// loses its effects and gets a problem.

import { type LoadResult, loadPack } from "../format/load.ts";
import { HOOKS } from "./hooks/index.ts";

/** Reads a pack file that `JSON.parse` gave, for the 2024 engine. */
export function loadContentPack(input: unknown): LoadResult {
  return loadPack(input, { hooks: new Set(HOOKS.keys()) });
}
