// The hook registry: the rules that a record names when data cannot hold
// them (docs/design/2024-content-format.md, section "Hooks"). Only the engine
// defines a hook. Any pack can call one by name with its own arguments.
//
// Each hook is in a file of its own here, with a test in hooks.test.ts. The
// ticket that adds a hook puts it in the list of the format doc.

import { armorClassHook } from "./armor-class.ts";
import { type HookRegistry, registry } from "./hook.ts";

export { defineHook, type Hook, type HookCall, type HookRegistry, registry } from "./hook.ts";

/** The hooks of the engine. */
export const HOOKS: HookRegistry = registry([armorClassHook]);
