// Applies an action of the Conditions and statuses box to the strict entity
// (ORC-322, ORC-323): it reads the play state, applies the action and writes
// it with the play state writers of play.ts, for one sheet change.
import { type ConditionAction, conditionStatus, exhaustionStatus, maxHalved, shownMaxHitPoints } from "./conditions.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import {
  concentration,
  conditions,
  currentHitPoints,
  EXHAUSTION_LIMIT,
  exhaustion,
  setConcentration,
  setConditions,
  setCurrentHitPoints,
  setExhaustion,
} from "./play.ts";

/**
 * The entity after an action of the box, and the status text.
 * `max` is the hit point maximum of the engine, before exhaustion. Add and
 * remove read the conditions of the record as it is now. An action that
 * changes nothing (a condition that is set already, or not set, no mark to
 * end, or the same exhaustion level) keeps the entity, and the status is "".
 *
 * When the exhaustion level goes to 4 or higher from below 4, the current
 * hit points go down to the halved maximum if they are higher. They are
 * written as a number, so they do not come back when the level goes down.
 * Level 6 changes no hit points and no death saves.
 */
export function applyConditions(e: Engine, entity: StrictEntity, max: number, action: ConditionAction): { entity: StrictEntity; status: string } {
  if (action.kind === "exhaustion") return applyExhaustion(e, entity, action.level, max);
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

function applyExhaustion(e: Engine, entity: StrictEntity, level: number, max: number) {
  const from = exhaustion(entity);
  const to = Number.isFinite(level) ? Math.max(0, Math.min(EXHAUSTION_LIMIT, Math.trunc(level))) : from;
  if (to === from) return { entity, status: "" };
  const next = setExhaustion(e, entity, to);
  if (maxHalved(from) || !maxHalved(to)) return { entity: next, status: exhaustionStatus(from, to) };
  const now = currentHitPoints(entity, max) ?? max;
  const top = shownMaxHitPoints(max, to);
  if (now <= top) return { entity: next, status: exhaustionStatus(from, to) };
  return { entity: setCurrentHitPoints(e, next, top), status: exhaustionStatus(from, to, { from: now, to: top }) };
}
