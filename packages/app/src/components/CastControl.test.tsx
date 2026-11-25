import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { CastAction } from "../engine/cast.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { featureUses, type Sheet, type SpellRef, toSheet } from "../engine/sheet.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { SpellsPanel } from "./SpellsPanel.tsx";

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

afterEach(cleanup);

/** The sheet of a character file of the e2e tests. */
const sheetOf = (file: string): Sheet => {
  const entity = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e", file), "utf8"));
  return toSheet(engine().evaluate(entity).built, entity);
};
/** The Life cleric 9 of the e2e tests: slots of the 1st to the 5th level, none spent. */
const cleric = () => sheetOf("life-cleric-9.strict.json");

/** Renders the open panel at a spell, as the sheet page does; `onCast` undefined is a panel with no Cast control. */
async function renderPanel(at: SpellRef, onCast?: (action: CastAction) => void, concentration: string | null = null, sheet = cleric()) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SpellsPanel
            open
            onOpenChange={() => {}}
            spellcasting={sheet.spellcasting!}
            classes={sheet.classes}
            at={at}
            builderHref="/build/abc?step=Spells"
            onSpendSlots={() => {}}
            onPrepare={() => {}}
            concentration={concentration}
            onCast={onCast}
            uses={featureUses(sheet)}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  return within(await within(dialog).findByRole("region", { name: at.key === "bless" ? "Bless" : /./ }));
}

const BLESS = { key: "bless", source: "Cleric" };

test("without a cast handler the spell view has no control, and its name block is as before", async () => {
  const view = await renderPanel(BLESS);
  expect(view.queryByRole("button", { name: /Cast/ })).toBeNull();
  expect(document.querySelector("[data-name-block]")).toBeNull();
});

test("Cast is beside the name with the sparkles icon and its hint; it casts at the spell level, and the control has no status line", async () => {
  const onCast = vi.fn();
  const view = await renderPanel(BLESS, onCast);
  const group = view.getByRole("group", { name: "Cast Bless" });
  expect(group.closest("[data-name-block]")).toBeTruthy();
  const cast = within(group).getByRole("button", { name: "Cast" });
  expect(cast.querySelector("svg")?.dataset.icon).toBe("sparkles");
  const hint = document.getElementById(cast.getAttribute("aria-describedby")!);
  expect(hint?.textContent).toBe("1st-level slot · 4 left");
  fireEvent.click(cast);
  expect(onCast).toHaveBeenCalledWith({ kind: "slot", key: "bless", name: "Bless", level: 1, group: 1, concentration: true });
  // The sheet page says what the cast did in its status toast (ORC-326); the name block keeps only the hint line.
  expect(view.queryByRole("status")).toBeNull();
  expect(hint?.closest("[data-cast-control]")?.querySelectorAll("p").length).toBe(1);
});

test("the arrow part opens the menu 'Cast at a higher level' with the levels, the amounts and the slots left", async () => {
  const onCast = vi.fn();
  const view = await renderPanel(BLESS, onCast);
  fireEvent.click(view.getByRole("button", { name: "Cast at a higher level" }));
  const menu = await screen.findByRole("menu", { name: "Cast at a higher level" });
  const items = within(menu).getAllByRole("menuitem");
  expect(items.map((item) => [...item.children].map((cell) => cell.textContent))).toEqual([
    ["2nd level", "+1 creature", "3 left"],
    ["3rd level", "+2 creatures", "3 left"],
    ["4th level", "+3 creatures", "3 left"],
    ["5th level", "+4 creatures", "1 left"],
  ]);
  fireEvent.click(items[1]);
  expect(onCast).toHaveBeenCalledWith({ kind: "slot", key: "bless", name: "Bless", level: 1, group: 3, concentration: true });
});

test("a second concentration spell asks first; Cancel casts nothing, and the action casts", async () => {
  const onCast = vi.fn();
  const view = await renderPanel(BLESS, onCast, "shield-of-faith");
  fireEvent.click(view.getByRole("button", { name: "Cast" }));
  let ask = await screen.findByRole("dialog", { name: "Cast Bless?" });
  expect(ask.textContent).toContain("You concentrate on Shield of Faith. Bless also needs concentration, so Shield of Faith ends.");
  fireEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cast Bless?" })).toBeNull());
  expect(onCast).not.toHaveBeenCalled();
  fireEvent.click(view.getByRole("button", { name: "Cast" }));
  ask = await screen.findByRole("dialog", { name: "Cast Bless?" });
  fireEvent.click(within(ask).getByRole("button", { name: "Cast and end Shield of Faith" }));
  expect(onCast).toHaveBeenCalledTimes(1);
});

test("a cantrip that needs concentration has the Concentrate button; a cantrip without it has no control", async () => {
  const onCast = vi.fn();
  const view = await renderPanel({ key: "guidance", source: "Cleric" }, onCast);
  fireEvent.click(view.getByRole("button", { name: "Concentrate" }));
  expect(onCast).toHaveBeenCalledWith({ kind: "concentrate", key: "guidance", name: "Guidance" });
  cleanup();
  const flame = await renderPanel({ key: "sacred-flame", source: "Cleric" }, onCast);
  expect(flame.queryByRole("button", { name: /Cast|Concentrate/ })).toBeNull();
});

test("a cast that disables each button of the control gives the focus to the hint line, which says why (ORC-326)", async () => {
  const sheet = cleric();
  // The Concentrate button sets the mark, and then it is disabled.
  function Page() {
    const [mark, setMark] = useState<string | null>(null);
    return (
      <SpellsPanel
        open
        onOpenChange={() => {}}
        spellcasting={sheet.spellcasting!}
        classes={sheet.classes}
        at={{ key: "guidance", source: "Cleric" }}
        builderHref="/build/abc?step=Spells"
        onSpendSlots={() => {}}
        onPrepare={() => {}}
        concentration={mark}
        onCast={(action) => setMark(action.key)}
        uses={featureUses(sheet)}
      />
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <Page /> }], { initialEntries: ["/"] })} />);
  const dialog = await screen.findByRole("dialog", { name: "Spells" });
  const concentrate = await within(dialog).findByRole("button", { name: "Concentrate" });
  act(() => concentrate.focus());
  fireEvent.click(concentrate);
  await waitFor(() => expect((concentrate as HTMLButtonElement).disabled).toBe(true));
  const hint = document.getElementById(concentrate.getAttribute("aria-describedby")!)!;
  expect(hint.textContent).toBe("You concentrate on this spell.");
  expect(document.activeElement).toBe(hint);
});

test("a Mystic Arcanum spell has a plain Cast button that spends the use, with its hint (ORC-321)", async () => {
  const onCast = vi.fn();
  const view = await renderPanel({ key: "mass-suggestion", source: "Warlock" }, onCast, null, sheetOf("warlock-20.strict.json"));
  const group = view.getByRole("group", { name: "Cast Mass Suggestion" });
  expect(
    within(group)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Cast"]);
  const cast = within(group).getByRole("button", { name: "Cast" });
  expect(document.getElementById(cast.getAttribute("aria-describedby")!)?.textContent).toBe("Spends Mystic Arcanum (4 of 4 left).");
  fireEvent.click(cast);
  expect(onCast).toHaveBeenCalledWith({
    kind: "uses",
    key: "mass-suggestion",
    name: "Mass Suggestion",
    level: 6,
    feature: { units: "orcpub.dnd.e5.units/long-rest", name: "Mystic Arcanum" },
    label: "Mystic Arcanum",
    pact: false,
    concentration: false,
  });
  expect(view.queryByRole("status")).toBeNull();
});

test("a cast note with uses that the app cannot link has no Cast button, only the line (ORC-321)", async () => {
  const sheet = sheetOf("warlock-20.strict.json");
  const spellcasting = sheet.spellcasting!;
  const byLevel = spellcasting.byLevel.map((level) => ({
    ...level,
    spells: level.spells.map((spell) => (spell.key === "bane" ? { ...spell, castNote: "uses Fey Step" } : spell)),
  }));
  const view = await renderPanel({ key: "bane", source: "Warlock" }, () => "", null, { ...sheet, spellcasting: { ...spellcasting, byLevel } });
  expect(view.queryByRole("button", { name: /Cast/ })).toBeNull();
  expect(view.getByText("This spell has its own uses (Fey Step). Spend the use on the sheet.")).toBeTruthy();
});
