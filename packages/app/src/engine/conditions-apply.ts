// Applies an action of the Conditions and statuses box to the strict entity
// (ORC-322): it reads the play state, applies the action and writes it with
// the play state writers of play.ts, for one sheet change.
import { type ConditionAction, conditionStatus } from "./conditions.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import { concentration, conditions, setConcentration, setConditions } from "./play.ts";

/**
 * The entity after an action of the box, and the text of the status line.
 * Add and remove read the conditions of the record as it is now. An action
 * that changes nothing (a condition that is set already, or not set, or no
 * mark to end) keeps the entity, and the status is "".
 */
export function applyConditions(e: Engine, entity: StrictEntity, action: ConditionAction): { entity: StrictEntity; status: string } {
  if (action.kind === "end-concentration") {
    if (concentration(entity) === null) return { entity, status: "" };
    return { entity: setConcentration(e, entity, null), status: conditionStatus(action) };
  }
  const set = new Set(conditions(entity));
  if (set.has(action.condition) === (action.kind === "add")) return { entity, status: "" };
  if (action.kind === "add") set.add(action.condition);
  else set.delete(action.condition);
  return { entity: setConditions(e, entity, set), status: conditionStatus(action) };
}
