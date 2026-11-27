// The Name step (ORC-342, docs/design/character-builder.md "The Name step").
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { storedValue } from "../engine/description.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { summaryCard } from "./test-sheet-panel.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

const rail = () => within(screen.getByRole("navigation", { name: "Steps" }));
const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const title = () => builder().getByRole("heading", { level: 2 });
const field = () => builder().getByRole("textbox", { name: "Character name" }) as HTMLInputElement;
const stored = () => storedValue(useCharacter.getState().entity!, "character-name");

/** A new character in the builder, at the step, as `/build/{id}?step=` opens it. */
function open(id: string, step?: string) {
  useCharacter.getState().load(id, newCharacter(engine()));
  render(<Builder step={step} />);
}

test("a new character opens on Name with the focus in the field, and Enter writes the name and goes to Class", async () => {
  open("name-enter", "Name");
  expect(title().textContent).toBe("Name");
  // The step has one field, and no other text.
  expect(builder().getAllByRole("textbox")).toEqual([field()]);
  expect(builder().queryByText(/Description step/)).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(field()));
  fireEvent.change(field(), { target: { value: "Brannor" } });
  // A keystroke does not write.
  expect(stored()).toBe("");
  fireEvent.keyDown(field(), { key: "Enter" });
  expect(stored()).toBe("Brannor");
  expect(title().textContent).toBe("Class");
  expect(document.activeElement).toBe(title());
  expect(within(summaryCard()).getByLabelText("Name").textContent).toBe("Brannor");
});

test("the name is written on blur, and the field shows the stored name when the step opens again", () => {
  open("name-blur", "Name");
  fireEvent.change(field(), { target: { value: "Tess" } });
  fireEvent.blur(field());
  expect(stored()).toBe("Tess");
  fireEvent.click(builder().getByRole("button", { name: "Next: Class" }));
  fireEvent.click(builder().getByRole("button", { name: "Back" }));
  expect(field().value).toBe("Tess");
  // After Back the focus goes to the step title, not to the field.
  expect(document.activeElement).toBe(title());
});

test("the name is optional: the Name step has no mark, with or without a name", () => {
  open("name-mark", "Name");
  expect(rail().getByRole("button", { name: "Name" })).toBeTruthy();
  fireEvent.change(field(), { target: { value: "Ash" } });
  fireEvent.blur(field());
  expect(rail().getByRole("button", { name: "Name" })).toBeTruthy();
});

test("the field does not get the focus when the builder opens on another step", async () => {
  open("name-other", "Class");
  fireEvent.click(rail().getByRole("button", { name: "Name" }));
  expect(title().textContent).toBe("Name");
  // Give a focus effect the time to run.
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.activeElement).not.toBe(field());
});

test("when the write of the name fails, Enter shows the refusal in the status toast, and the player stays on Name", async () => {
  open("name-refused", "Name");
  const { update } = useCharacter.getState();
  // The store refuses the next write, as the engine refuses a change.
  useCharacter.setState({
    update: () => {
      throw new Error("The engine refuses the name.");
    },
  });
  try {
    fireEvent.change(field(), { target: { value: "Brannor" } });
    fireEvent.keyDown(field(), { key: "Enter" });
  } finally {
    useCharacter.setState({ update });
  }
  expect(stored()).toBe("");
  expect(title().textContent).toBe("Name");
  await waitFor(() => expect(document.querySelector("[data-toast-status]")?.textContent).toBe("The engine refuses the name."));
  // A refusal of the engine is an error (ORC-372).
  expect(document.querySelector<HTMLElement>("[data-toast-status]")?.dataset.tone).toBe("error");
});
