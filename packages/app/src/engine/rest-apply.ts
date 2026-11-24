// Applies a rest to the strict entity (ORC-318): it reads what the rest can
// change (rest.ts), keeps only the picks that the rules allow, and writes
// all the changes together with play.ts and spells.ts, for one sheet change.
import type { Engine, StrictEntity } from "./engine.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import { hitDiceSpent, rechargeGroup, setHitDiceSpent, setUsesSpent, usesSpent } from "./play.ts";
import { diceHealing, type RestAction, restStatus, type ShortRest, shortRest, shortRestGroup, validDice, validSlotPicks } from "./rest.ts";
import type { Sheet } from "./sheet.ts";
import { setSpentSlots } from "./spells.ts";

type RestSheet = Parameters<typeof shortRest>[0];

/**
 * The entity after a Short rest, and the text of the status line.
 *
 * - Each spent die becomes spent, and the dice heal by the Heal rule: the
 *   hit points stop at the maximum, and the death save counts clear.
 * - The Pact Magic slots come back.
 * - The spent uses of the groups `short-rest` and `rest` come back.
 * - With picks of Arcane Recovery, the picked slots come back and its use
 *   is spent.
 *
 * A pick that the rules do not allow is left out.
 */
function applyShortRest(e: Engine, entity: StrictEntity, sheet: RestSheet, rest: ShortRest, action: Extract<RestAction, { kind: "short" }>) {
  let next = entity;
  const dice = validDice(rest, action.dice);
  if (dice.length > 0) {
    // A stored die that the character no longer has keeps its entry.
    const spent = new Map(hitDiceSpent(entity));
    for (const { die, total, left } of rest.dice) {
      const n = dice.filter((d) => d.die === die).length;
      if (n > 0) spent.set(die, total - left + n);
    }
    next = applyHitPoints(e, next, rest.max, { kind: "heal", amount: diceHealing(dice, rest.conModifier) }).entity;
    next = setHitDiceSpent(e, next, spent);
  }
  const layout = sheet.spellcasting ?? { slots: [], pact: null };
  if (rest.pactSpent > 0) next = setSpentSlots(e, next, layout, "pact", 0);
  const picks = validSlotPicks(rest.arcaneRecovery, action.arcaneRecovery);
  for (const [level, n] of picks) {
    const spent = rest.arcaneRecovery?.slots.find((s) => s.level === level)?.spent ?? 0;
    next = setSpentSlots(e, next, layout, level, spent - n);
  }
  const uses = new Map([...usesSpent(entity)].filter(([group]) => !shortRestGroup(group)).map(([group, features]) => [group, new Map(features)]));
  const recovery = rest.arcaneRecovery;
  if (recovery && picks.size > 0) {
    const group = rechargeGroup(recovery.use.units);
    const features = uses.get(group) ?? new Map<string, number>();
    features.set(recovery.use.name, (features.get(recovery.use.name) ?? 0) + 1);
    uses.set(group, features);
  }
  return setUsesSpent(e, next, uses);
}

/**
 * The entity after a rest, and the text of the status line. The rules read
 * what the rest can change from the sheet that shows, as the dialog did,
 * and write all the changes together, so that the caller makes them one
 * sheet change.
 */
export function applyRest(e: Engine, entity: StrictEntity, sheet: Pick<Sheet, keyof RestSheet>, action: RestAction): { entity: StrictEntity; status: string } {
  switch (action.kind) {
    case "short":
      return { entity: applyShortRest(e, entity, sheet, shortRest(sheet), action), status: restStatus("short") };
  }
}
