import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { setCurrentHitPoints, setExhaustion, setFeatureUsesSpent } from "../engine/play.ts";
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

/** Fighter 5 with full hit points and nothing spent: a rest changes nothing. */
function fighter() {
  const e = engine();
  const start: StrictEntity = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-5.strict.json"), "utf8"));
  const entity = setCurrentHitPoints(e, start, null);
  return toSheet(e.evaluate(entity).built, entity);
}

/** Wizard 5 at exhaustion 2, with Arcane Recovery spent. */
function wizard() {
  const e = engine();
  const start: StrictEntity = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/wizard-5.strict.json"), "utf8"));
  const entity = setFeatureUsesSpent(e, setExhaustion(e, setCurrentHitPoints(e, start, null), 2), "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  return toSheet(e.evaluate(entity).built, entity);
}

async function openRest(name: string) {
  await pickOption(screen.getByRole("button", { name: "Rest" }), name);
  return screen.findByRole("dialog", { name });
}

const openShortRest = () => openRest("Short rest");

/** The text of the section "This rest will change". */
const changes = (dialog: HTMLElement) => within(dialog).getByRole("region", { name: "This rest will change" }).textContent;

test("the menu lists Short rest and Long rest, and Dawn only with Dawn uses", async () => {
  render(<RestButton sheet={sheet()} onRest={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rest" }));
  // The wizard level gives Arcane Recovery, which comes back at dawn.
  expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Short rest", "Long rest", "Dawn"]);
  cleanup();
  render(<RestButton sheet={fighter()} onRest={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rest" }));
  expect((await screen.findAllByRole("menuitem")).map((item) => item.textContent)).toEqual(["Short rest", "Long rest"]);
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

test("the rest dialogs are narrow", async () => {
  render(<RestButton sheet={sheet()} onRest={vi.fn()} />);
  for (const name of ["Short rest", "Long rest", "Dawn"]) {
    const dialog = await openRest(name);
    expect(dialog.dataset.size).toBe("narrow");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
});

test("the Long rest dialog: both checkboxes are on at the start; with Dawn off, the Dawn list stays, disabled; Finish gives the picks", async () => {
  const onRest = vi.fn();
  render(<RestButton sheet={wizard()} onRest={onRest} />);
  const dialog = await openRest("Long rest");
  const ate = within(dialog).getByRole("checkbox", { name: "Ate and drank" });
  const dawn = within(dialog).getByRole("checkbox", { name: "Dawn came during the rest" });
  expect([ate.getAttribute("aria-checked"), dawn.getAttribute("aria-checked")]).toEqual(["true", "true"]);
  expect(changes(dialog)).toContain("Exhaustion2 → 1");
  const field = within(within(dialog).getByRole("region", { name: "At dawn" })).getByRole("textbox", { name: "Arcane Recovery" });
  expect((field as HTMLInputElement).value).toBe("1");
  fireEvent.click(ate);
  expect(changes(dialog)).toContain("ExhaustionNo change");
  fireEvent.click(dawn);
  expect(within(within(dialog).getByRole("region", { name: "At dawn" })).getByRole("textbox", { name: "Arcane Recovery" })).toHaveProperty("disabled", true);
  // The checkboxes are off, so the rest changes nothing.
  expect(changes(dialog)).toContain("Nothing will change.");
  fireEvent.click(within(dialog).getByRole("button", { name: "Finish" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  const key = "orcpub.dnd.e5.units/day\nArcane Recovery";
  expect(onRest.mock.calls).toEqual([[{ kind: "long", ate: false, dawn: false, back: new Map([[key, 1]]) }]]);
});

test("the Dawn dialog: a field for each spent Dawn use starts at the spent count; at 0 the dialog says that nothing will change", async () => {
  const onRest = vi.fn();
  render(<RestButton sheet={wizard()} onRest={onRest} />);
  const dialog = await openRest("Dawn");
  const field = within(dialog).getByRole("textbox", { name: "Arcane Recovery" }) as HTMLInputElement;
  expect(field.value).toBe("1");
  expect(changes(dialog)).not.toContain("Nothing will change.");
  fireEvent.change(field, { target: { value: "0" } });
  await waitFor(() => expect(changes(dialog)).toContain("Nothing will change."));
  fireEvent.click(within(dialog).getByRole("button", { name: "Finish" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onRest.mock.calls).toEqual([[{ kind: "dawn", back: new Map([["orcpub.dnd.e5.units/day\nArcane Recovery", 0]]) }]]);
});

test("each dialog of a rested fighter says that nothing will change, and Finish works", async () => {
  const onRest = vi.fn();
  render(<RestButton sheet={fighter()} onRest={onRest} />);
  for (const name of ["Short rest", "Long rest"]) {
    const dialog = await openRest(name);
    expect(changes(dialog)).toBe("This rest will changeNothing will change.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Finish" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  }
  expect(onRest.mock.calls.map(([action]) => action.kind)).toEqual(["short", "long"]);
});
