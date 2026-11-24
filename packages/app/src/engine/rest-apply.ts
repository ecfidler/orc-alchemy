// Applies a rest to the strict entity (ORC-318, ORC-319): it reads what the
// rest can change (rest.ts), keeps only the picks that the rules allow, and
// writes all the changes together with play.ts and spells.ts, for one sheet
// change.
import type { Engine, StrictEntity } from "./engine.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import {
  exhaustion,
  type FeatureUsesKey,
  hitDiceSpent,
  rechargeGroup,
  setConcentration,
  setCurrentHitPoints,
  setDeathSaves,
  setExhaustion,
  setHitDiceSpent,
  setTempHitPoints,
  setUsesSpent,
  type UsesSpent,
  usesSpent,
} from "./play.ts";
import {
  type DawnBack,
  dawnUses,
  diceHealing,
  type LongRest,
  longRest,
  longRestGroup,
  type RestAction,
  type RestUse,
  restStatus,
  type ShortRest,
  shortRest,
  shortRestGroup,
  validBack,
  validDice,
  validSlotPicks,
} from "./rest.ts";
import type { Sheet } from "./sheet.ts";
import { setSpentSlots } from "./spells.ts";

type RestSheet = Parameters<typeof shortRest>[0] & Parameters<typeof longRest>[0];

/** The spent uses of the record, as a copy that the caller can change, without the groups that `cleared` passes. */
const usesWithout = (entity: StrictEntity, cleared: (group: string) => boolean) =>
  new Map([...usesSpent(entity)].filter(([group]) => !cleared(group)).map(([group, features]) => [group, new Map(features)]));

/** Sets the spent count of a use in the spent uses of the record: it gets or makes the map of the use's recharge group. */
function setUse(uses: Map<string, Map<string, number>>, use: FeatureUsesKey, spent: (now: number) => number) {
  const group = rechargeGroup(use.units);
  const features = uses.get(group) ?? new Map<string, number>();
  features.set(use.name, spent(features.get(use.name) ?? 0));
  uses.set(group, features);
}

/** The slot layout of the sheet, and the entity with the Pact Magic slots back when some are spent. */
function restorePact(e: Engine, entity: StrictEntity, sheet: RestSheet, pactSpent: number) {
  const layout = sheet.spellcasting ?? { slots: [], pact: null };
  return { layout, next: pactSpent > 0 ? setSpentSlots(e, entity, layout, "pact", 0) : entity };
}

/** Takes the Dawn uses that come back off the spent counts. A use with no number keeps its stored count. */
function giveBackDawn(uses: Map<string, Map<string, number>>, dawn: readonly RestUse[], back: DawnBack): UsesSpent {
  const kept = validBack(dawn, back);
  for (const { key, use, spent } of dawn) {
    const n = kept.get(key) ?? 0;
    if (n > 0) setUse(uses, use, () => spent - n);
  }
  return uses;
}

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
  const pact = restorePact(e, next, sheet, rest.pactSpent);
  next = pact.next;
  const picks = validSlotPicks(rest.arcaneRecovery, action.arcaneRecovery);
  for (const [level, n] of picks) {
    const spent = rest.arcaneRecovery?.slots.find((s) => s.level === level)?.spent ?? 0;
    next = setSpentSlots(e, next, pact.layout, level, spent - n);
  }
  const uses = usesWithout(entity, shortRestGroup);
  const recovery = rest.arcaneRecovery;
  if (recovery && picks.size > 0) setUse(uses, recovery.use, (n) => n + 1);
  return setUsesSpent(e, next, uses);
}

/**
 * The entity after a Long rest.
 *
 * - The hit points go to full (no value), the temporary hit points to 0,
 *   and the death save counts and the concentration mark clear.
 * - All spell slots come back, the Pact Magic slots also.
 * - The spent uses of the groups `short-rest`, `rest` and `long-rest` come
 *   back. Round, minute and hour uses stay.
 * - The spent hit dice of hitDiceBack come back, the largest die first.
 * - With "Ate and drank", the exhaustion level goes down by 1.
 * - With "Dawn came during the rest", the numbers of the Dawn list come back.
 *
 * Inspiration and the conditions do not change.
 */
function applyLongRest(e: Engine, entity: StrictEntity, sheet: RestSheet, rest: LongRest, action: Extract<RestAction, { kind: "long" }>) {
  let next: StrictEntity = setCurrentHitPoints(e, entity, null);
  next = setTempHitPoints(e, next, 0);
  next = setDeathSaves(e, next, { successes: 0, failures: 0 });
  next = setConcentration(e, next, null);
  const pact = restorePact(e, next, sheet, rest.pactSpent);
  next = pact.next;
  for (const { level } of rest.slots) next = setSpentSlots(e, next, pact.layout, level, 0);
  if (rest.dice.length > 0) {
    // A stored die that the character no longer has keeps its entry.
    const spent = new Map(hitDiceSpent(entity));
    for (const { die, back } of rest.dice) {
      const hitDie = sheet.hitDice.find((d) => d.die === die);
      if (hitDie) spent.set(die, hitDie.total - hitDie.left - back);
    }
    next = setHitDiceSpent(e, next, spent);
  }
  const level = exhaustion(entity);
  if (action.ate && level > 0) next = setExhaustion(e, next, level - 1);
  const uses = usesWithout(entity, longRestGroup);
  return setUsesSpent(e, next, action.dawn ? giveBackDawn(uses, rest.dawn, action.back) : uses);
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
    case "long":
      return { entity: applyLongRest(e, entity, sheet, longRest(sheet), action), status: restStatus("long") };
    case "dawn":
      return {
        entity: setUsesSpent(
          e,
          entity,
          giveBackDawn(
            usesWithout(entity, () => false),
            dawnUses(sheet),
            action.back,
          ),
        ),
        status: restStatus("dawn"),
      };
  }
}
