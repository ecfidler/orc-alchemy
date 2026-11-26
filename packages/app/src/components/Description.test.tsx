import "fake-indexeddb/auto";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { storedValue } from "../engine/description.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { withSheetPanel } from "./test-sheet-panel.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** Opens a new character in the builder, on the Description step. */
function open(id: string) {
  useCharacter.getState().load(id, newCharacter(engine()));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Description/ }));
}

const stored = (key: string) => storedValue(useCharacter.getState().entity!, key);
const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const field = (label: string) => builder().getByLabelText(label) as HTMLInputElement;

test("the step has no name field; the name is on the Name step", () => {
  open("description-no-name");
  expect(builder().queryByLabelText(/Character Name/i)).toBeNull();
  // The first text field is the player name; the other fields stay.
  expect(builder().getAllByRole("textbox")[0]).toBe(field("Player Name"));
});

test("Alignment is the first field, a ui Select with its left mark in its name; a pick writes it and the mark is Done (ORC-352)", async () => {
  open("description-alignment");
  const alignment = builder().getByRole("combobox", { name: /^Alignment, ?1 left$/ });
  // It is before each text field.
  expect(alignment.compareDocumentPosition(field("Player Name")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(alignment.className).toContain("ui-select");
  expect(await optionNames(alignment)).toHaveLength(9);
  await pickOption(alignment, "Lawful Good");
  expect(engine().evaluate(useCharacter.getState().entity!).built.alignment).toBe("Lawful Good");
  expect(builder().getByRole("combobox", { name: /^Alignment, ?Done$/ }).textContent).toBe("Lawful Good");
  // A pick in the place of the first one replaces it.
  await pickOption(builder().getByRole("combobox", { name: /^Alignment, ?Done$/ }), "Chaotic Neutral");
  expect(engine().evaluate(useCharacter.getState().entity!).built.alignment).toBe("Chaotic Neutral");
  // The step has no pick left, so its button in the rail has no mark.
  expect(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Description" })).toBeTruthy();
});

test("the other 18 fields are ui TextInput and TextArea fields with the label above the field (ORC-352)", () => {
  open("description-fields");
  const boxes = builder().getAllByRole("textbox");
  expect(boxes).toHaveLength(18);
  expect(field("Player Name").className).toContain("ui-input");
  expect(field("Bonds").className).toContain("ui-textarea");
  // The label is above the field: the field is in the label, after the label text.
  for (const box of boxes) {
    const label = box.closest("label")!;
    expect(label.className).toContain("ui-field-label");
    expect(label.firstElementChild!.className).toBe("ui-label");
  }
});

test("a player name is written on blur", () => {
  open("description-player");
  fireEvent.change(field("Player Name"), { target: { value: "Ana" } });
  // A keystroke does not write.
  expect(stored("player-name")).toBe("");
  fireEvent.blur(field("Player Name"));
  expect(stored("player-name")).toBe("Ana");
});

test("XP is written on Enter, as an int", () => {
  open("description-xp");
  fireEvent.change(field("Experience Points"), { target: { value: "900" } });
  fireEvent.keyDown(field("Experience Points"), { key: "Enter" });
  expect(engine().evaluate(useCharacter.getState().entity!).built.xps).toBe(900);
  // A decimal is stored as its int, and the field shows what is stored. The same value does not write again.
  const before = useCharacter.getState().entity;
  fireEvent.change(field("Experience Points"), { target: { value: "900.9" } });
  fireEvent.blur(field("Experience Points"));
  expect(stored("xps")).toBe("900");
  expect(field("Experience Points").value).toBe("900");
  expect(useCharacter.getState().entity).toBe(before);
});

test("a field cleared is stored as an empty string", () => {
  open("description-clear");
  fireEvent.change(field("Bonds"), { target: { value: "My ship" } });
  // Enter in a textarea is a new line, not a commit.
  fireEvent.keyDown(field("Bonds"), { key: "Enter" });
  expect(stored("bonds")).toBe("");
  fireEvent.blur(field("Bonds"));
  expect(stored("bonds")).toBe("My ship");
  fireEvent.change(field("Bonds"), { target: { value: "" } });
  fireEvent.blur(field("Bonds"));
  const values = useCharacter.getState().entity as Record<string, Record<string, unknown>>;
  expect(values["~:orcpub.entity.strict/values"]["~:orcpub.dnd.e5.character/bonds"]).toBe("");
});

test("the portrait shows in the builder under its URL when set", async () => {
  open("description-portrait");
  expect(builder().queryByAltText("Portrait")).toBeNull();
  fireEvent.change(field("Image URL"), { target: { value: "https://example.com/p.png" } });
  fireEvent.keyDown(field("Image URL"), { key: "Enter" });
  expect(builder().getByAltText("Portrait").getAttribute("src")).toBe("https://example.com/p.png");
  // The sheet does not show the portrait (theme spec, "Not on the sheet in M8").
  await withSheetPanel((sheet) => expect(within(sheet).queryByAltText("Portrait")).toBeNull());
  fireEvent.change(field("Faction Image URL"), { target: { value: "https://example.com/f.png" } });
  fireEvent.keyDown(field("Faction Image URL"), { key: "Enter" });
  expect(builder().getByAltText("Faction image").getAttribute("src")).toBe("https://example.com/f.png");
});
