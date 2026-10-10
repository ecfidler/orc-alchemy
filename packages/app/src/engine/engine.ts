// The engine boundary: only src/engine/ touches @pubdoor/dmv. The rest of the
// app loads the engine through here and treats the strict entity as opaque.
import { useMemo } from "react";
import type * as Dmv from "@pubdoor/dmv";
import type { Evaluation, Homebrew, MagicItems, ParsedOrcbrew, Rules, StrictEntity } from "@pubdoor/dmv";

export type { Homebrew, MagicItems, ParsedOrcbrew, Rules, StrictEntity };

/**
 * The content a character builds against, as the engine's options take it:
 * the loaded packs and the enabled custom magic items. Without either, the
 * character builds against the SRD alone.
 */
export interface Content {
  /** Required, so a bare multi-plugin map is not taken for a Content by mistake. */
  homebrew: Homebrew | undefined;
  magicItems?: MagicItems;
}

export type Engine = typeof Dmv;

let loading: Promise<Engine> | undefined;
let loaded: Engine | undefined;

/** Loads the engine chunk once; later calls return the same promise. */
export function loadEngine(): Promise<Engine> {
  loading ??= import("@pubdoor/dmv").then((mod) => (loaded = mod));
  return loading;
}

/** The loaded engine. Throws before loadEngine resolves; EngineGate guarantees it below the gate. */
export function engine(): Engine {
  if (!loaded) throw new Error("The engine is not loaded yet");
  return loaded;
}

/**
 * Builds the entity against the content, or the SRD alone without it; null
 * without an entity. The engine memoizes on the JSON text of each, so this
 * is cheap to repeat.
 */
export function useEvaluation(entity: StrictEntity | null, content?: Content): Evaluation | null {
  return useMemo(() => (entity === null ? null : engine().evaluate(entity, content)), [entity, content]);
}
