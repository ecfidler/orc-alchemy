// The slot groups that the sheet and the Spells panel show (ORC-282, ORC-283,
// ORC-286; docs/design/spells-panel.md "Spent spell slots"). The Spellcasting
// table of the sheet, the Spell slots block and the level headings of the
// panel take the groups, their names and their state from here.
import { ordinal } from "./sheet-text.ts";
import type { SlotGroup, SpentSlotGroups } from "./spells.ts";

/** A group of slots as the sheet and the panel show it: the other slots of a level, or the pact slots. */
export interface ShownSlots {
  /** The group that a change sets (see `setSpentSlots`). */
  group: SlotGroup;
  /** The spell level of the slots. */
  level: number;
  /** The name that a screen reader gives the group: "1st-level slots", or "Pact slots, 5th level". */
  label: string;
  count: number;
  spent: number;
}

/** The other slots of a level, as a shown group; null when the level has none. */
export function levelSlots({ slots }: Pick<SpentSlotGroups, "slots">, level: number): ShownSlots | null {
  const slot = slots.find((s) => s.level === level);
  return slot && slot.count > 0 ? { group: level, level, label: `${ordinal(level)}-level slots`, count: slot.count, spent: slot.spent } : null;
}

/** The pact slots, as a shown group; null without Pact Magic. */
export function pactSlotGroup({ pact }: Pick<SpentSlotGroups, "pact">): ShownSlots | null {
  return pact && pact.count > 0
    ? { group: "pact", level: pact.slotLevel, label: `Pact slots, ${ordinal(pact.slotLevel)} level`, count: pact.count, spent: pact.spent }
    : null;
}

/** The slot groups of a level: its other slots, then the pact slots when it is the pact slot level. */
export function slotGroupsOf(groups: SpentSlotGroups, level: number): ShownSlots[] {
  const pact = pactSlotGroup(groups);
  return [levelSlots(groups, level), pact?.level === level ? pact : null].filter((group) => group !== null);
}

/** The entries of the Spell slots block: the other slots of each level, 1st level first, then the pact slots. */
export function slotEntries(groups: SpentSlotGroups): ShownSlots[] {
  const pact = pactSlotGroup(groups);
  return [...groups.slots.map((slot) => levelSlots(groups, slot.level)).filter((slots) => slots !== null), ...(pact ? [pact] : [])];
}

/** The state of a slot group for a screen reader: "2 of 4 spent". */
export const spentText = (spent: number, count: number) => `${spent} of ${count} spent`;

/**
 * True when the Spell slots block of the panel shows one column for each
 * entry: it has two or more entries, and slots of the 5th level or higher,
 * the pact slots included. Else it shows one row for each entry.
 */
export function slotColumns(groups: SpentSlotGroups): boolean {
  const entries = slotEntries(groups);
  return entries.length >= 2 && entries.some((entry) => entry.level >= 5);
}
