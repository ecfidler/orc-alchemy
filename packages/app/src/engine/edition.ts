// The engine of a character comes from the `rules` tag on its envelope
// (ORC-238, docs/design/2024-engine.md, "The seam to the app"). A missing tag
// is "2014". Each engine loads in its own chunk, so a 2014 character loads no
// 2024 code. The import of a file still refuses a tag that is not "2014"
// (import.ts), because users cannot make 2024 characters yet.

import type { Entity2024 } from "@orc-alchemy/engine";
import { type Content, engine, loadEngine, type StrictEntity } from "./engine.ts";
import type { Sheet } from "./sheet.ts";
import { toSheet } from "./sheet.ts";

export type Edition = "2014" | "2024";

/** The envelope of a stored character, with its `rules` tag. */
export interface RulesTag {
  rules?: string;
}

/** The edition of a character from the `rules` tag of its envelope. Throws for a tag that the app does not know. */
export function editionOf(envelope: RulesTag): Edition {
  const rules = envelope.rules ?? "2014";
  if (rules !== "2014" && rules !== "2024") throw new Error(`Unknown rules edition: ${rules}`);
  return rules;
}

/**
 * Loads the engine of the character's edition and builds its Sheet. `content`
 * is the 2014 homebrew; homebrew for 2024 characters arrives with ORC-235.
 */
export async function loadSheet(envelope: RulesTag, entity: StrictEntity | Entity2024, content?: Content): Promise<Sheet> {
  if (editionOf(envelope) === "2014") {
    await loadEngine();
    const entity2014 = entity as StrictEntity;
    return toSheet(engine().evaluate(entity2014, content).built, entity2014);
  }
  const [{ evaluate }, { toSheet2024 }] = await Promise.all([import("@orc-alchemy/engine"), import("./sheet-2024.ts")]);
  return toSheet2024(evaluate(entity as Entity2024, { rules: "2024" }).built);
}
