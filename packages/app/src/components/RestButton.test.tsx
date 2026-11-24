import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { setCurrentHitPoints } from "../engine/play.ts";
import { toSheet } from "../engine/sheet.ts";
import { setSpentSlots, slotLayout } from "../engine/spells.ts";
import { RestButton } from "./RestButton.tsx";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** Cleric 6 / paladin 3 / rogue 1 / wizard 1 at 50 of 91 hit points, with two 1st-level slots spent. */
function sheet() {
  const e = engine();
  const start: StrictEntity = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/cleric-6-paladin-3-rogue-1-wizard-1.strict.json"), "utf8"));
  const entity = setSpentSlots(e, setCurrentHitPoints(e, start, 50), slotLayout(e.evaluate(start).built), 1, 2);
  return toSheet(e.evaluate(entity).built, entity);
}

async function openShortRest() {
  await pickOption(screen.getByRole("button", { name: "Rest" }), "Short rest");
  return screen.findByRole("dialog", { name: "Short rest" });
}

test("the menu lists Short rest only, until ORC-319 adds Long rest and Dawn", async () => {
  render(<RestButton sheet={sheet()} onRest={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rest" }));
  expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Short rest"]);
});

test("Finish gives the picks of the dialog once; Cancel gives nothing", async () => {
  const onRest = vi.fn();
  render(<RestButton sheet={sheet()} onRest={onRest} random={() => 0.5} />);
  let dialog = await openShortRest();
  const d10 = within(within(dialog).getByRole("group", { name: "d10" }));
  fireEvent.click(d10.getByRole("button", { name: "Roll for me" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "One more 1st-level slot" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onRest).not.toHaveBeenCalled();

  // The next open starts with no picks.
  dialog = await openShortRest();
  expect(within(dialog).getByRole("group", { name: "Spent d10" }).querySelectorAll(".ui-token:not(.invisible)")).toHaveLength(0);
  fireEvent.click(within(within(dialog).getByRole("group", { name: "d8" })).getByRole("button", { name: "Roll for me" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Take back the d8, +6" }));
  fireEvent.click(within(within(dialog).getByRole("group", { name: "d6" })).getByRole("button", { name: "Roll for me" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "One more 1st-level slot" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Finish" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onRest.mock.calls).toEqual([[{ kind: "short", dice: [{ die: 6, roll: 4 }], arcaneRecovery: new Map([[1, 1]]) }]]);
});
