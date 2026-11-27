// Applies a cast to the strict entity (ORC-320, docs/design/sheet-interactivity.md
// "A cast with a spell slot", "A spell with its own uses" and "Concentration"):
// it spends one slot of the group or one use of a feature, or both, and sets
// the concentration mark, for one sheet change. The slot writes are the ones
// of the Spells panel (spells.ts), and the use writes the ones of the use
// bubble (play.ts), so the sheet shows the same counts.
import { type CastAction, castSlots, castStatus } from "./cast.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import { featureUsesSpent, rechargeGroup, setConcentration, setFeatureUsesSpent } from "./play.ts";
import { type Sheet } from "./sheet.ts";
import { featureUses } from "./sheet-features.ts";
import { type SlotGroup, setSpentSlots, spentSlotGroups } from "./spells.ts";

/**
 * The entity after a cast, and the status text.
 *
 * - A cast with a slot spends one slot of its group, read from the record as
 *   it is now. A group that cannot cast the spell, or that has no slot
 *   left, changes nothing, and the status is "".
 * - A cast with a use spends one use of its feature, read from the record as
 *   it is now, and for an invocation spell also one pact slot. A feature
 *   that the sheet does not have, or with no use left, or no pact slot left,
 *   changes nothing, and the status is "".
 * - A spell that needs concentration sets the mark to its key. The caller
 *   asks first when the mark is for another spell (asksFirst).
 * - The Concentrate button only sets the mark.
 */
export function applyCast(
  e: Engine,
  entity: StrictEntity,
  sheet: Pick<Sheet, "spellcasting" | "features">,
  action: CastAction,
): { entity: StrictEntity; status: string } {
  if (action.kind === "concentrate") return { entity: setConcentration(e, entity, action.key), status: castStatus(action) };
  const unchanged = { entity, status: "" };
  const layout = sheet.spellcasting ?? { slots: [], pact: null };
  const now = spentSlotGroups(entity, layout);
  /** Spends one slot of `group`, or gives null when the group cannot cast the spell or has no slot left. */
  const spendSlot = (from: StrictEntity, group: SlotGroup) => {
    const slot = castSlots(now, action.level).find((s) => s.group === group);
    if (!slot || slot.left === 0) return null;
    const spent = group === "pact" ? (now.pact?.spent ?? 0) : (now.slots.find((s) => s.level === group)?.spent ?? 0);
    return { entity: setSpentSlots(e, from, layout, group, spent + 1), slot: { level: slot.level, left: slot.left - 1 } };
  };

  let next: StrictEntity;
  let status: string;
  if (action.kind === "slot") {
    const cast = spendSlot(entity, action.group);
    if (!cast) return unchanged;
    next = cast.entity;
    status = castStatus(action, cast.slot);
  } else {
    const { units, name } = action.feature;
    const feature = featureUses(sheet).find((u) => u.name === name && rechargeGroup(u.units) === rechargeGroup(units));
    if (!feature) return unchanged;
    const spent = featureUsesSpent(entity, feature.units, feature.name, feature.amount);
    if (spent >= feature.amount) return unchanged;
    const withUse = setFeatureUsesSpent(e, entity, feature.units, feature.name, spent + 1);
    const cast = action.pact ? spendSlot(withUse, "pact") : { entity: withUse, slot: undefined };
    if (!cast) return unchanged;
    next = cast.entity;
    status = castStatus(action, cast.slot, feature.amount - spent - 1);
  }
  if (action.concentration) next = setConcentration(e, next, action.key);
  return { entity: next, status };
}
