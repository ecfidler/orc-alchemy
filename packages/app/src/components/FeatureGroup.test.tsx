// The tests of the "Features & traits" section of the character sheet. Each test renders the whole sheet.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { expectedOf, playMocks, sheet, sheetTestHooks } from "./test-sheet.ts";

sheetTestHooks();

const LONG_REST = "orcpub.dnd.e5.units/long-rest";
/** The uses of a sheet feature, with the unit and name of its record key. */
const usesOf = (name: string, amount: number, recharge: string | null, units: string | null, spent = 0) => ({ amount, recharge, units, name, spent });
const usesFeatures = (spent: { wind?: number; hands?: number } = {}) => ({
  ...sheet.features,
  actions: [
    { name: "Second Wind", text: "Regain hit points.", uses: usesOf("Second Wind", 2, "Short rest", "orcpub.dnd.e5.units/rest", spent.wind) },
    { name: "Lay on Hands", text: "Restore hit points.", uses: usesOf("Lay on Hands", 25, "Long rest", LONG_REST, spent.hands) },
    { name: "Sneak Attack", text: "Extra damage.", uses: usesOf("Sneak Attack", 1, "Once per turn", "orcpub.dnd.e5.units/turn") },
    { name: "Dash", text: "Move again." },
  ],
});
const bubbleOf = (name: string) => within(screen.getByRole("group", { name }));

test("a limited-use feature sits in a use bubble, with circles, a pool for more than 8 uses, or no circles each turn", () => {
  render(<CharacterSheet sheet={{ ...sheet, features: usesFeatures({ wind: 1, hands: 5 }) }} />);
  // Without play, the bubbles show the spent uses and take no clicks.
  expect(bubbleOf("Second Wind").getByRole("img", { name: "Second Wind uses spent: 1 of 2" })).toBeTruthy();
  expect(bubbleOf("Second Wind").getByText("Short rest")).toBeTruthy();
  expect(bubbleOf("Lay on Hands").getByText("20")).toBeTruthy();
  expect(bubbleOf("Lay on Hands").queryAllByRole("button")).toHaveLength(0);
  expect(bubbleOf("Sneak Attack").getByText("Once per turn")).toBeTruthy();
  expect(bubbleOf("Sneak Attack").queryByRole("img")).toBeNull();
  expect(screen.queryByRole("group", { name: "Dash" })).toBeNull();
  expect(screen.getByText("Move again.")).toBeTruthy();
});

test("with play, the circles and the pool write the spent uses with play.onUses by the unit and name (ORC-316)", () => {
  const onUses = vi.fn();
  const play = { ...playMocks(), onUses };
  render(<CharacterSheet sheet={{ ...sheet, features: usesFeatures({ wind: 1, hands: 5 }) }} play={play} />);
  const wind = bubbleOf("Second Wind").getByRole("slider", { name: "Second Wind" });
  expect(wind.getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  fireEvent.keyDown(wind, { key: "ArrowRight" });
  expect(onUses).toHaveBeenLastCalledWith({ units: "orcpub.dnd.e5.units/rest", name: "Second Wind" }, 2);
  fireEvent.click(bubbleOf("Lay on Hands").getByRole("button", { name: "Spend 1 Lay on Hands" }));
  expect(onUses).toHaveBeenLastCalledWith({ units: LONG_REST, name: "Lay on Hands" }, 6);
  fireEvent.click(bubbleOf("Lay on Hands").getByRole("button", { name: "Regain 1 Lay on Hands" }));
  expect(onUses).toHaveBeenLastCalledWith({ units: LONG_REST, name: "Lay on Hands" }, 4);
  expect(bubbleOf("Lay on Hands").getByRole("button", { name: "Lay on Hands, 20 of 25 left" })).toBeTruthy();
  // Uses each turn have no circles, also with play.
  expect(bubbleOf("Sneak Attack").queryByRole("slider")).toBeNull();
});

// ORC-203: a typed homebrew feature draws the same bubble as an engine entry. sheet.test.ts and e2e check the sections.
test("scaled-uses draws its homebrew uses as the engine's: circles, a pool above 8, and no bubble for 0 uses or fewer", () => {
  render(<CharacterSheet sheet={toSheet(expectedOf("scaled-uses-fighter-6-barbarian-1"), {})} />);
  expect(bubbleOf("Action Surge").getByRole("img", { name: "Action Surge uses spent: 0 of 1" })).toBeTruthy();
  expect(bubbleOf("Stormcaller").getByRole("img", { name: "Stormcaller uses spent: 0 of 3" })).toBeTruthy();
  expect(bubbleOf("Rolling Gait").getByRole("img").querySelectorAll(".ui-slot-circle")).toHaveLength(7);
  expect(screen.getByRole("group", { name: "Crashing Wave" }).querySelector(".ui-use-pool-count")?.textContent).toBe("30 / 30");
  expect(screen.getByRole("group", { name: "Deep Lungs" }).querySelector(".ui-use-pool-count")?.textContent).toBe("15 / 15");
  // The unit day is "Dawn".
  expect(bubbleOf("Deep Lungs").getByText("Dawn")).toBeTruthy();
  // Undertow resolves to -1 uses: a plain feature.
  expect(screen.queryByRole("group", { name: "Undertow" })).toBeNull();
  expect(screen.getByText("You pull one creature within 30 feet 10 feet toward you.")).toBeTruthy();
});
