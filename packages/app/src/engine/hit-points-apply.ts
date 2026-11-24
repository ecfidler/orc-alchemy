// Applies an action of the Hit points box to the strict entity (ORC-314):
// it reads the play state, applies the rule of hit-points.ts and writes the
// new values with the play state writers of play.ts.
import type { Engine, StrictEntity } from "./engine.ts";
import { applyHitPointAction, type HitPointAction } from "./hit-points.ts";
import { currentHitPoints, deathSaves, setCurrentHitPoints, setDeathSaves, setTempHitPoints, tempHitPoints } from "./play.ts";

/**
 * The entity after an action of the two popups, and the text of the status
 * line. `max` is the hit point maximum that shows. When the action does not
 * change the current hit points, the stored value stays as it is, also a
 * stored value above the maximum.
 */
export function applyHitPoints(e: Engine, entity: StrictEntity, max: number, action: HitPointAction): { entity: StrictEntity; status: string } {
  const change = applyHitPointAction(
    { current: currentHitPoints(entity, max) ?? max, max, temp: tempHitPoints(entity), deathSaves: deathSaves(entity) },
    action,
  );
  const next = change.current === undefined ? entity : setCurrentHitPoints(e, entity, change.current);
  return { entity: setDeathSaves(e, setTempHitPoints(e, next, change.temp), change.deathSaves), status: change.status };
}
