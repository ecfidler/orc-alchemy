// The engine boundary: only src/engine/ touches @pubdoor/dmv. The rest of the
// app loads the engine through here and treats the strict entity as opaque.
import { useMemo } from "react";
import type * as Dmv from "@pubdoor/dmv";
import type { Evaluation, Rules, StrictEntity } from "@pubdoor/dmv";

export type { Rules, StrictEntity };

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

/** Builds the entity, or null without one. The engine memoizes on the entity's JSON text, so this is cheap to repeat. */
export function useEvaluation(entity: StrictEntity | null): Evaluation | null {
  return useMemo(() => (entity === null ? null : engine().evaluate(entity)), [entity]);
}
