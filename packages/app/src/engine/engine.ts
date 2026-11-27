// The engine boundary: only src/engine/ touches @pubdoor/dmv. The rest of the
// app loads the engine through here and treats the strict entity as opaque.

import type * as Dmv from "@pubdoor/dmv";
import type {
  Built2014,
  BuiltTemplate,
  ContentType,
  Evaluation,
  Homebrew,
  MagicItems,
  MagicItemsOptions,
  ParsedOrcbrew,
  Rules,
  StrictEntity,
  ValidationProblem,
} from "@pubdoor/dmv";
import { useMemo } from "react";

export type { Built2014, ContentType, Homebrew, MagicItems, ParsedOrcbrew, Rules, StrictEntity, ValidationProblem };

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
  loading ??= import("@pubdoor/dmv").then((mod) => (loaded = { ...mod, evaluate: keptEvaluate(mod.evaluate) }));
  return loading;
}

/** The evaluations kept for each content. A pick asks for about four characters, so eight are enough. */
const EVALUATIONS_KEPT = 8;

/**
 * The engine's evaluate, with the last few results kept for each options object, by the JSON text of the entity
 * (ORC-369). The engine keeps only its last result. A pick on the Proficiencies step builds the character, the
 * character without its picks, and that character without each class, race and background, so each build pushed out
 * the one before it, and the next render built it again: about 30 ms for each. The JSON text of an entity takes less
 * than 1 ms. The result is shared, so a caller must not change it. An entity that does not build throws on each call,
 * as the engine does.
 */
function keptEvaluate(evaluate: Engine["evaluate"]): Engine["evaluate"] {
  const byOptions = new WeakMap<object, Map<string, Evaluation>>();
  const noOptions = new Map<string, Evaluation>();
  return (entity, options) => {
    let kept = options === undefined ? noOptions : byOptions.get(options);
    if (kept === undefined) {
      kept = new Map();
      byOptions.set(options!, kept);
    }
    const key = typeof entity === "string" ? entity : JSON.stringify(entity);
    const hit = kept.get(key);
    // To the end of the map, so the oldest result goes first.
    kept.delete(key);
    const result = hit ?? evaluate(entity, options);
    kept.set(key, result);
    if (kept.size > EVALUATIONS_KEPT) kept.delete(kept.keys().next().value as string);
    return result;
  };
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

/** The templates kept by buildTemplate. A character's content changes seldom, so a few are enough. */
const TEMPLATES_KEPT = 8;
const templates = new Map<string, BuiltTemplate>();

/**
 * The engine's buildTemplate, kept for the last few contents by their JSON
 * text (ORC-361). The engine builds the template again on each call, and a
 * build takes 100 to 300 ms. The JSON text of a large pack takes a few ms.
 * The result is shared, so a caller must not change it. A content that does
 * not build throws on each call, as the engine does.
 */
export function buildTemplate(homebrew?: Homebrew, options?: MagicItemsOptions): BuiltTemplate {
  // All of options is in the key, so a new option also gets its own template.
  const key = JSON.stringify([homebrew ?? null, options ?? {}]);
  const kept = templates.get(key);
  if (kept !== undefined) {
    // To the end of the map, so the oldest template goes first.
    templates.delete(key);
    templates.set(key, kept);
    return kept;
  }
  const built = engine().buildTemplate(homebrew, options);
  templates.set(key, built);
  if (templates.size > TEMPLATES_KEPT) templates.delete(templates.keys().next().value as string);
  return built;
}
