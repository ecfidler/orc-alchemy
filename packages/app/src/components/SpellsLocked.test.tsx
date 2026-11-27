import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

// This test is in its own file because a vi.mock applies to the whole file. No SRD spell option has a prerequisite, so
// the mock gives a spell a reason: the popup then shows it as a spell that the character cannot take (ORC-357).
const REASON = "Requires Wizard level 5";
vi.mock("./SelectionControl.tsx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./SelectionControl.tsx")>();
  return {
    ...actual,
    useUnavailable: (selection: Parameters<typeof actual.useUnavailable>[0]) => {
      const reasons = actual.useUnavailable(selection);
      return selection.key === "wizard-cantrips-known" ? new Map([...reasons, ["fire-bolt", REASON]]) : reasons;
    },
  };
});

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});
afterEach(cleanup);

const q = (ability: string) => `~:orcpub.dnd.e5.character/${ability}`;

function wizard1(): StrictEntity {
  const e = engine();
  const scores = { str: 8, dex: 14, con: 13, int: 10, wis: 13, cha: 15 };
  const entity = e.setField(e.emptyCharacter(), ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));
  return e.setClass(entity, 0, "wizard");
}

test("a spell that the character cannot take has the lock, a dimmed name and its reason; its spell view says Not available.", () => {
  useCharacter.getState().load("spells-locked", wizard1());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add spells: Wizard Cantrips Known" }));
  const popup = within(screen.getByRole("dialog", { name: "Wizard Cantrips Known" }));
  const row = popup.getByRole("button", { name: "Fire Bolt, not available" });
  // No box: the lock is in its place, and the row is described by the reason.
  expect(popup.queryByRole("checkbox", { name: "Chosen: Fire Bolt" })).toBeNull();
  const item = row.closest("li")!;
  expect(item.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  expect(document.getElementById(row.getAttribute("aria-describedby")!)!.textContent).toBe(REASON);
  expect(row.querySelector(".text-ink-muted")?.textContent).toContain("Fire Bolt");
  // Space on the row changes nothing.
  fireEvent.keyDown(row, { key: " " });
  fireEvent.keyUp(row, { key: " " });
  expect(engine().evaluate(useCharacter.getState().entity!).built["spells-known"]?.["0"]).toBeUndefined();
  // The spell view has the lock line in the place of the box line.
  fireEvent.click(row);
  const view = within(popup.getByRole("region", { name: "Fire Bolt" }));
  expect(view.getByText(`Not available. ${REASON}`)).toBeTruthy();
  expect(view.queryByRole("checkbox")).toBeNull();
  // Another spell keeps its box.
  expect(popup.getByRole("checkbox", { name: "Chosen: Acid Splash" })).toBeTruthy();
});
