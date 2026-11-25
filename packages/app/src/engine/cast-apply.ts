// Applies a cast to the strict entity (ORC-320, docs/design/sheet-interactivity.md
// "A cast with a spell slot" and "Concentration"): it spends one slot of the
// group and sets the concentration mark, for one sheet change. The slot
// writes are the ones of the Spells panel (spells.ts).
import { type CastAction, castSlots, castStatus } from "./cast.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import { setConcentration } from "./play.ts";
import type { Sheet } from "./sheet.ts";
import { setSpentSlots, spentSlotGroups } from "./spells.ts";

/**
 * The entity after a cast, and the text of the status line.
 *
 * - A cast with a slot spends one slot of its group, read from the record as
 *   it is now. A group that cannot cast the spell, or that has no slot
 *   left, changes nothing, and the status is "".
 * - A spell that needs concentration sets the mark to its key. The caller
 *   asks first when the mark is for another spell (asksFirst).
 * - The Concentrate button only sets the mark.
 */
export function applyCast(e: Engine, entity: StrictEntity, sheet: Pick<Sheet, "spellcasting">, action: CastAction): { entity: StrictEntity; status: string } {
  if (action.kind === "concentrate") return { entity: setConcentration(e, entity, action.key), status: castStatus(action) };
  const layout = sheet.spellcasting ?? { slots: [], pact: null };
  const now = spentSlotGroups(entity, layout);
  const slot = castSlots(now, action.level).find((s) => s.group === action.group);
  if (!slot || slot.left === 0) return { entity, status: "" };
  const spent = action.group === "pact" ? (now.pact?.spent ?? 0) : (now.slots.find((s) => s.level === action.group)?.spent ?? 0);
  let next = setSpentSlots(e, entity, layout, action.group, spent + 1);
  if (action.concentration) next = setConcentration(e, next, action.key);
  return { entity: next, status: castStatus(action, { level: slot.level, left: slot.left - 1 }) };
}
