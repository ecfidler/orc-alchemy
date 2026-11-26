import "fake-indexeddb/auto";
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
  // The first field is the player name; the other fields stay.
  expect(builder().getAllByRole("textbox")[0]).toBe(field("Player Name"));
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
