import { expect, test } from "vitest";
import { levelSlots, pactSlotGroup, slotColumns, slotEntries, slotGroupsOf, spentText } from "./spell-slots.ts";

const pact5 = (count = 2, spent = 0) => ({ slotLevel: 5, count, spent });

test("the slot groups of a level: its other slots, then the pact slots", () => {
  const groups = {
    slots: [
      { level: 1, count: 4, spent: 1 },
      { level: 5, count: 1, spent: 0 },
    ],
    pact: pact5(2, 2),
  };
  expect(slotGroupsOf(groups, 1)).toEqual([{ group: 1, level: 1, label: "1st-level slots", count: 4, spent: 1 }]);
  expect(slotGroupsOf(groups, 5)).toEqual([
    { group: 5, level: 5, label: "5th-level slots", count: 1, spent: 0 },
    { group: "pact", level: 5, label: "Pact slots, 5th level", count: 2, spent: 2 },
  ]);
  expect(slotGroupsOf(groups, 2)).toEqual([]);
  expect(spentText(1, 2)).toBe("1 of 2 spent");
});

test("a group with no slots is not a group: other slots of 0, or pact slots of 0", () => {
  expect(levelSlots({ slots: [{ level: 1, count: 0, spent: 0 }] }, 1)).toBeNull();
  expect(pactSlotGroup({ pact: pact5(0) })).toBeNull();
  expect(pactSlotGroup({ pact: null })).toBeNull();
});

test("the entries of the block: the other slots of each level, 1st level first, then the pact slots", () => {
  const groups = {
    slots: [
      { level: 1, count: 4, spent: 0 },
      { level: 2, count: 0, spent: 0 },
      { level: 3, count: 2, spent: 1 },
    ],
    pact: { slotLevel: 2, count: 2, spent: 0 },
  };
  expect(slotEntries(groups).map((entry) => entry.label)).toEqual(["1st-level slots", "3rd-level slots", "Pact slots, 2nd level"]);
});

test("columns need two or more entries and slots of the 5th level or higher, the pact slots included", () => {
  expect(slotColumns({ slots: [{ level: 1, count: 4, spent: 0 }], pact: pact5() })).toBe(true);
  expect(
    slotColumns({
      slots: [
        { level: 4, count: 3, spent: 0 },
        { level: 5, count: 1, spent: 0 },
      ],
      pact: null,
    }),
  ).toBe(true);
  // A warlock with no other caster class: one entry, so rows.
  expect(slotColumns({ slots: [], pact: pact5() })).toBe(false);
  expect(slotColumns({ slots: [{ level: 1, count: 4, spent: 0 }], pact: { slotLevel: 4, count: 2, spent: 0 } })).toBe(false);
  expect(slotColumns({ slots: [{ level: 3, count: 2, spent: 0 }], pact: null })).toBe(false);
});
