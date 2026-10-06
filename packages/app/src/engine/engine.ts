// The engine boundary: only src/engine/ touches @pubdoor/dmv. The rest of the
// app loads the engine through here and treats the strict entity as opaque.
import { useMemo } from "react";
import type * as Dmv from "@pubdoor/dmv";
import type { Evaluation, Homebrew, ParsedOrcbrew, Rules, StrictEntity } from "@pubdoor/dmv";

export type { Homebrew, ParsedOrcbrew, Rules, StrictEntity };

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
 * Builds the entity against the homebrew, or the SRD alone without it; null
 * without an entity. The engine memoizes on the JSON text of both, so this
 * is cheap to repeat.
 */
export function useEvaluation(entity: StrictEntity | null, homebrew?: Homebrew): Evaluation | null {
  return useMemo(() => (entity === null ? null : engine().evaluate(entity, { homebrew })), [entity, homebrew]);
}
