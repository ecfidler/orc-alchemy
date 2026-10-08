import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { storedValue } from "../engine/description.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** Opens a new character in the builder, on the Description step. */
function open(id: string) {
  useCharacter.getState().load(id, engine().emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Description" }));
}

const stored = (key: string) => storedValue(useCharacter.getState().entity!, key);
const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const preview = () => within(screen.getByRole("region", { name: "Preview" }));
const field = (label: string) => builder().getByLabelText(label) as HTMLInputElement;

test("a name is written on blur, and the preview shows it", () => {
  open("description-name");
  fireEvent.change(field("Character Name"), { target: { value: "Brannor" } });
  // A keystroke does not write.
  expect(stored("character-name")).toBe("");
  fireEvent.blur(field("Character Name"));
  expect(stored("character-name")).toBe("Brannor");
  expect(preview().getByRole("heading", { level: 1, name: "Brannor" })).toBeTruthy();
});

test("XP is written on Enter, as an int", () => {
  open("description-xp");
  fireEvent.change(field("Experience Points"), { target: { value: "900" } });
  fireEvent.keyDown(field("Experience Points"), { key: "Enter" });
  expect(engine().evaluate(useCharacter.getState().entity!).built.xps).toBe(900);
  expect(preview().getByLabelText("XP").textContent).toBe("900");
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

test("the portrait shows under its URL when set", () => {
  open("description-portrait");
  expect(builder().queryByAltText("Portrait")).toBeNull();
  fireEvent.change(field("Image URL"), { target: { value: "https://example.com/p.png" } });
  fireEvent.keyDown(field("Image URL"), { key: "Enter" });
  expect(builder().getByAltText("Portrait").getAttribute("src")).toBe("https://example.com/p.png");
  expect(preview().getByAltText("Portrait").getAttribute("src")).toBe("https://example.com/p.png");
  fireEvent.change(field("Faction Image URL"), { target: { value: "https://example.com/f.png" } });
  fireEvent.keyDown(field("Faction Image URL"), { key: "Enter" });
  expect(builder().getByAltText("Faction image").getAttribute("src")).toBe("https://example.com/f.png");
});
