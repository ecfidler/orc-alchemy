// The list with a detail panel and the Background step (ORC-347, docs/design/character-builder.md "The Background and
// Race steps"): the panel shows a background and picks nothing, Choose picks it, the block takes the place of the list
// with the focus on Change, Change and Cancel, About, "Also choose", and the search of a long list.
import "fake-indexeddb/auto";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { BACKGROUND_PACK, SAGE, TAGGED_BACKGROUNDS, VALE_BACKGROUNDS, VALE_PACK } from "../engine/test-backgrounds.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { openFighter, resetBuilder } from "./test-builder.tsx";
import { pickIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(resetBuilder);

/** A new fighter with these picks, open in the builder on the Background step. */
const open = (picks: [path: string[], key: string][] = []) => openFighter("Background", picks);

const background = () => section("Background");
const picked = () =>
  engine()
    .evaluate(useCharacter.getState().entity!, useHomebrew.getState().content)
    .selections.find((s) => s.key === "background")!.selected;
const rows = () => [...background().querySelectorAll(".ui-list-panel-name")].map((name) => name.textContent);

test("before a click the panel asks for one; a click shows Acolyte with its facts and feature, and picks nothing", async () => {
  open();
  expect(within(background()).getByRole("heading", { level: 3 }).textContent).toBe("Background,1 left");
  expect(within(background()).getByText("Select a background to read about it.")).toBeTruthy();
  fireEvent.click(within(background()).getByRole("button", { name: "Acolyte" }));
  const panel = within(background()).getByRole("region", { name: "Acolyte" });
  await waitFor(() => expect(within(panel).getByText("Your life has been devoted to serving a god or gods.")).toBeTruthy());
  const facts = [...panel.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
  expect(facts).toEqual([
    ["Skills", "Insight, Religion"],
    ["Languages", "Two of your choice"],
    ["Equipment", "Clothes, common, Pouch, Incense (5), Vestements, Prayer Book or Prayer Wheel, 15 gp"],
  ]);
  expect(panel).toHaveTextContent("Shelter the Faithful.");
  expect(within(background()).getByRole("button", { name: "Acolyte" }).getAttribute("aria-current")).toBe("true");
  expect(picked()).toEqual([]);
});

test("Choose picks the background: the block takes the place of the list, and the focus goes to Change", async () => {
  open();
  fireEvent.click(within(background()).getByRole("button", { name: "Acolyte" }));
  fireEvent.click(within(background()).getByRole("button", { name: "Choose Acolyte" }));
  expect(picked()).toEqual(["acolyte"]);
  expect(background().querySelector(".ui-list-panel")).toBeNull();
  const block = background();
  expect(within(block).getByRole("heading", { level: 3 }).textContent).toBe("Acolyte,Done");
  expect(
    within(block)
      .getAllByRole("button", { name: /^(About|Customize|Change)/ })
      .map((b) => b.getAttribute("aria-label")),
  ).toEqual(["About Acolyte", "Customize Acolyte", "Change Background"]);
  await waitFor(() => expect(document.activeElement).toBe(within(block).getByRole("button", { name: "Change Background" })));
  // The Customize line under the cards goes.
  expect(screen.queryByRole("list", { name: "Customize Background" })).toBeNull();
});

test("Also choose: a line for the languages and one for the equipment, each opens its step", () => {
  open([[["background"], "acolyte"]]);
  const lines = within(background()).getByRole("list", { name: "Also choose" });
  expect(
    within(lines)
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label")),
  ).toEqual(["Languages, 2 left, Proficiencies", "Starting equipment, 2 left, Equipment"]);
  fireEvent.click(within(lines).getByRole("button", { name: "Languages, 2 left, Proficiencies" }));
  expect(within(screen.getByRole("region", { name: "Builder" })).getByRole("heading", { level: 2 }).textContent).toBe("Proficiencies");
  expect(document.activeElement).toBe(within(screen.getByRole("region", { name: "Builder" })).getByRole("heading", { level: 2 }));
});

test("a background that gives no pick on another step says so", async () => {
  await useHomebrew.getState().saveItem(VALE_PACK, TAGGED_BACKGROUNDS, VALE_BACKGROUNDS[0]);
  open([[["background"], "archivist"]]);
  expect(within(background()).getByText("This background gives no pick on another step.")).toBeTruthy();
  // The pack shows small after the name.
  expect(within(background()).getByRole("heading", { level: 3 }).textContent).toBe(`Archivist${VALE_PACK},Done`);
});

test("Change opens the list on the picked background, bold with the check; Cancel puts the block back with the focus on Change", async () => {
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, SAGE);
  open([[["background"], "acolyte"]]);
  fireEvent.click(within(background()).getByRole("button", { name: "Change Background" }));
  expect(within(background()).getByRole("heading", { level: 3 }).textContent).toBe("Background: Acolyte,Done");
  const acolyte = within(background()).getByRole("button", { name: "Acolyte" });
  expect(acolyte.hasAttribute("data-picked")).toBe(true);
  expect(acolyte.getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(acolyte);
  // The panel of the picked background has no Choose button.
  const panel = within(background()).getByRole("region", { name: "Acolyte" });
  expect(within(panel).queryByRole("button", { name: "Choose Acolyte" })).toBeNull();
  expect(panel).toHaveTextContent("The background of this character");
  // The row of a pack background has the pack at the right.
  expect(within(background()).getByRole("button", { name: "Sage" }).querySelector(".ui-list-panel-aside")?.textContent).toBe(BACKGROUND_PACK);
  fireEvent.click(within(background()).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.activeElement).toBe(within(background()).getByRole("button", { name: "Change Background" })));
  expect(picked()).toEqual(["acolyte"]);
});

test("a pick from the list of Change replaces the background, and pickIn picks through the list", async () => {
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, SAGE);
  open([[["background"], "acolyte"]]);
  await pickIn(background(), "Sage");
  expect(picked()).toEqual(["sage"]);
  expect(within(background()).getByRole("heading", { level: 3 }).textContent).toMatch(/^Sage/);
  await waitFor(() => expect(document.activeElement).toBe(within(background()).getByRole("button", { name: "Change Background" })));
});

test("About shows the detail of the picked background in a modal with no Choose button", async () => {
  open([[["background"], "acolyte"]]);
  fireEvent.click(within(background()).getByRole("button", { name: "About Acolyte" }));
  const dialog = await screen.findByRole("dialog", { name: "Acolyte" });
  await waitFor(() => expect(dialog).toHaveTextContent("Your life has been devoted to serving a god or gods."));
  expect(within(dialog).queryByRole("button", { name: /^Choose/ })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a pack of more than 20 backgrounds: a search field with the count, which filters, and one line for no result", async () => {
  await useHomebrew.getState().saveItem(VALE_PACK, TAGGED_BACKGROUNDS, VALE_BACKGROUNDS[0]);
  await useHomebrew.getState().saveItems(
    VALE_PACK,
    VALE_BACKGROUNDS.slice(1).map((item) => ({ contentType: TAGGED_BACKGROUNDS, key: item["~:key"], item })),
  );
  open();
  // The SRD Acolyte and the 24 of the pack, in the order of the names.
  expect(rows()).toHaveLength(25);
  expect(rows().slice(0, 3)).toEqual(["Acolyte", "Archivist", "Bargehand"]);
  const search = within(background()).getByRole("searchbox", { name: "Search" });
  expect(search.getAttribute("placeholder")).toBe("Search 25 backgrounds");
  fireEvent.change(search, { target: { value: "salt" } });
  expect(rows()).toEqual(["Salt Trader"]);
  fireEvent.change(search, { target: { value: "dragon" } });
  expect(within(background()).getByText("Nothing matches. Try another word.")).toBeTruthy();
});
