// Applies an action of the Hit points box to the strict entity (ORC-314):
// it reads the play state, applies the rule of hit-points.ts and writes the
// new values with the play state writers of play.ts. Damage with a
// concentration mark also gives the concentration note (ORC-322). Exhaustion
// level 4 halves the maximum (ORC-323).
import { type ConcentrationNote, concentrationDc, shownMaxHitPoints } from "./conditions.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import { applyHitPointAction, type HitPointAction } from "./hit-points.ts";
import { concentration, currentHitPoints, deathSaves, exhaustion, setCurrentHitPoints, setDeathSaves, setTempHitPoints, tempHitPoints } from "./play.ts";

/**
 * The entity after an action of the two popups, and the text of the status
 * line. `max` is the hit point maximum of the engine. The rules use the
 * maximum that shows: from exhaustion level 4, the half of `max`. When the
 * action does not change the current hit points, the stored value stays as
 * it is, also a stored value above the maximum.
 *
 * Damage of 1 or more with a concentration mark gives `note`: the spell key
 * of the mark and the DC of the Constitution save, from the full damage,
 * also the damage that the temporary hit points take. The app does not roll
 * the save and does not end the concentration.
 */
export function applyHitPoints(
  e: Engine,
  entity: StrictEntity,
  max: number,
  action: HitPointAction,
): { entity: StrictEntity; status: string; note?: ConcentrationNote } {
  const shown = shownMaxHitPoints(max, exhaustion(entity));
  const change = applyHitPointAction(
    { current: currentHitPoints(entity, shown) ?? shown, max: shown, full: max, temp: tempHitPoints(entity), deathSaves: deathSaves(entity) },
    action,
  );
  const next = change.current === undefined ? entity : setCurrentHitPoints(e, entity, change.current);
  const written = setDeathSaves(e, setTempHitPoints(e, next, change.temp), change.deathSaves);
  const spell = concentration(entity);
  const hit = action.kind === "damage" && Number.isFinite(action.amount) ? Math.trunc(action.amount) : 0;
  return { entity: written, status: change.status, ...(spell !== null && hit > 0 && { note: { spell, dc: concentrationDc(hit) } }) };
}
