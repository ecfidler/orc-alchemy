// The hook registry: the rules that a record names when data cannot hold
// them (docs/design/2024-content-format.md, section "Hooks"). Only the engine
// defines a hook. Any pack can call one by name with its own arguments.
//
// The registry is empty until a rules ticket adds a hook. ORC-225 adds the
// Armor Class hook. Each hook gets a test of its own, and the ticket that
// adds it puts it in the list of the format doc.

import type { z } from "zod";
import type { OptionParts } from "../../core/template.ts";
import type { Built2024 } from "../built.ts";

/** Where a hook is called from. */
export interface HookCall {
  /** The reference of the record that calls the hook. */
  record: string;
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

/** The hooks of the engine. */
export const HOOKS: HookRegistry = registry([]);
