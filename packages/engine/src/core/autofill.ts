// Fills the open selections of an entity at random, as the builder's random
// character button does (the 2014 `autofill` of `@pubdoor/dmv`,
// docs/plan/02-engine-library.md).

import { actualPath, availableSelections, build, canChoose, countRemaining } from "./build.ts";
import { optionsAt, type StrictEntity } from "./entity.ts";
import { select, setOptionValue } from "./mutations.ts";
import type { Option, Template } from "./template.ts";

export interface AutofillOptions {
  /** A 32-bit integer. The same seed and the same entity give the same result. */
  seed: number;
  /** The most entities to build before autofill stops. The default is 10,000. */
  maxSteps?: number;
}

/** A small seeded generator of numbers from 0 up to 1 (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A copy of `items` in a random order (Fisher-Yates). */
export function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Completes each open selection of the entity: each offered selection that
 * still needs a choice. It works depth first, one choice at a time, in the
 * order of the offered selections, and picks among the options that the
 * character can choose.
 *
 * When a choice leaves an open selection with no option to choose, autofill
 * goes back and tries another option. It never removes or changes a choice
 * that the entity already has. When no complete fill exists, or `maxSteps`
 * runs out, it returns the fill that got furthest.
 */
export function autofill<S, E extends StrictEntity<NoInfer<S>>>(template: Template<S>, entity: E, options: AutofillOptions): E {
  const random = seededRandom(options.seed);
  const maxSteps = options.maxSteps ?? 10_000;
  let steps = 0;
  let furthest = { entity, open: Number.POSITIVE_INFINITY };

  const fill = (current: E): E | null => {
    steps += 1;
    const built = build(current, template);
    const selections = availableSelections(current, built, template);
    const open = selections.filter((s) => countRemaining(current, s) > 0);
    if (open.length < furthest.open) furthest = { entity: current, open: open.length };
    if (open.length === 0) return current;

    const selection = open[0];
    const path = actualPath(selection);
    const chosen = optionsAt(current, path);
    const chosenKeys = new Set(chosen.map((o) => o.key));
    // With requireValue, a chosen option without a value still needs one, and giving it one changes no choice.
    const needsValue = selection.requireValue ? selection.options.filter((o) => chosen.some((c) => c.key === o.key && c.value === undefined)) : [];
    // A sequential selection takes its options in order, so only the next one is a candidate.
    const unchosen = selection.options.filter((o) => !chosenKeys.has(o.key));
    const candidates: Option<S>[] = (selection.sequential ? unchosen.slice(0, 1) : unchosen).filter((o) => canChoose(o, built));

    for (const option of [...needsValue, ...shuffled(candidates, random)]) {
      if (steps >= maxSteps) return null;
      const value = selection.requireValue ? option.autofillValue?.(random) : undefined;
      if (selection.requireValue && value === undefined) continue;
      const next = chosenKeys.has(option.key) ? setOptionValue(current, [...path, option.key], value) : select(template, current, path, option.key, value);
      const done = fill(next);
      if (done) return done;
    }
    return null;
  };

  return fill(entity) ?? furthest.entity;
}
