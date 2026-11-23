// The shape of a hook, and the registry type.

import type { z } from "zod";
import type { OptionParts, Selection } from "../../core/template.ts";
import type { Built2024, FeatCategory } from "../built.ts";
import type { Content } from "../content.ts";

/** Where a hook is called from, and what the converter gives it. */
export interface HookCall {
  /** The reference of the record that calls the hook. */
  record: string;
  /** The loaded content, for a hook that lists records. */
  content: Content;
  /** The spell list that a background gives to the feat that calls the hook, for Magic Initiate. */
  featSpellList?: string;
  /** A choice of one feat of the categories, as the converter makes it. */
  featSelection: (name: string, categories?: readonly FeatCategory[]) => Selection<Built2024>;
}

export interface Hook<A = unknown> {
  name: string;
  /** The schema of the arguments. */
  args: z.ZodType<A>;
  /** What the hook gives to the option of the record that calls it. */
  apply: (args: A, call: HookCall) => OptionParts<Built2024>;
}

export type HookRegistry = ReadonlyMap<string, Hook>;

/** A hook with typed arguments, for the registry. */
export function defineHook<A>(hook: Hook<A>): Hook {
  return hook as Hook;
}

export function registry(hooks: readonly Hook[]): HookRegistry {
  return new Map(hooks.map((hook) => [hook.name, hook]));
}
