// Applies an action of the Hit dice popup to the strict entity (ORC-317): it
// reads the spent hit dice, applies the rule of hit-dice.ts, heals by the
// Heal rule (hit-points-apply.ts) and writes the spent dice with play.ts.
import type { Engine, StrictEntity } from "./engine.ts";
import { applyHitDiceAction, type HitDiceAction, hitDiceLeft } from "./hit-dice.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import { hitDiceSpent, setHitDiceSpent } from "./play.ts";
import type { Sheet } from "./sheet.ts";

/**
 * The entity after an action of the Hit dice popup, and the text of the
 * status line. The rules read the spent dice of the record as it is now,
 * with the dice, the hit point maximum and the Constitution modifier that
 * the sheet shows. Spend heals by the Heal rule: it clears the death save
 * counts, stops at the maximum and writes no value at full hit points.
 * Regain does not change the hit points. An action that cannot be done
 * changes nothing and gives "".
 */
export function applyHitDice(
  e: Engine,
  entity: StrictEntity,
  sheet: Pick<Sheet, "hitDice" | "maxHitPoints" | "abilities">,
  action: HitDiceAction,
): { entity: StrictEntity; status: string } {
  const totals = new Map(sheet.hitDice.map(({ die, total }) => [die, total]));
  const conModifier = sheet.abilities.find((a) => a.ability === "con")?.modifier ?? 0;
  const change = applyHitDiceAction(hitDiceLeft(totals, hitDiceSpent(entity, totals)), conModifier, action);
  if (change === null) return { entity, status: "" };
  const healed = change.heal === null ? entity : applyHitPoints(e, entity, sheet.maxHitPoints, { kind: "heal", amount: change.heal }).entity;
  // Only the die of the action changes. A stored die that the character no longer has keeps its entry.
  const spent = new Map(hitDiceSpent(entity));
  spent.set(change.die, change.spent);
  return { entity: setHitDiceSpent(e, healed, spent), status: change.status };
}
