import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import type { ListItem } from "./ListModal.tsx";
import { AddButton, Picker } from "./Picker.tsx";
import { pickFromPicker, removeToken } from "./testing/index.ts";

afterEach(cleanup);

const FRUIT: ListItem<string>[] = ["Apple", "Banana", "Cherry", "Damson", "Elderberry", "Fig", "Grape"].map((label) => ({ value: label.toLowerCase(), label }));

function Fruit({ start = [], search, pickedText }: { start?: string[]; search?: boolean; pickedText?: (n: number) => string }) {
  const [value, setValue] = useState(start);
  return (
    <>
      <Picker label="Add a fruit" title="Add fruit" options={FRUIT} value={value} onValueChange={setValue} search={search} pickedText={pickedText} />
      <span>Value: {value.join(",")}</span>
    </>
  );
}

const tokens = () => [...document.querySelectorAll(".ui-token-label")].map((label) => label.textContent);
const addButton = () => screen.getByRole("button", { name: "Add a fruit" });

test("the add button is wide, says how many options remain, and opens the modal", async () => {
  render(<Fruit start={["cherry"]} />);
  const button = addButton();
  expect([button.className, button.dataset.wide, button.textContent]).toEqual(["ui-button ui-add-button", "", "+ Add a fruit6 more"]);
  expect(document.getElementById(button.getAttribute("aria-describedby")!)?.textContent).toBe("6 more");
  expect([button.getAttribute("aria-haspopup"), button.getAttribute("aria-expanded")]).toEqual(["dialog", "false"]);
  fireEvent.click(button);
  expect(await screen.findByRole("dialog", { name: "Add fruit" })).toBeTruthy();
  expect(button.getAttribute("aria-expanded")).toBe("true");
});

test("the tokens are in the order of the options, not of the clicks, and a pick goes at the end of the value", async () => {
  render(<Fruit />);
  await pickFromPicker(addButton(), ["Fig", "Banana", "Damson"]);
  expect(tokens()).toEqual(["Banana", "Damson", "Fig"]);
  expect(screen.getByText("Value: fig,banana,damson")).toBeTruthy();
  expect(document.getElementById(addButton().getAttribute("aria-describedby")!)?.textContent).toBe("4 more");
});

test("a picked option leaves the modal's list, and the footer counts the picks", async () => {
  render(<Fruit start={["apple", "grape"]} />);
  fireEvent.click(addButton());
  const dialog = await screen.findByRole("dialog");
  expect([...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"))).toEqual(["Banana", "Cherry", "Damson", "Elderberry", "Fig"]);
  expect(within(dialog).getByRole("status").textContent).toBe("2 picked");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cherry" }));
  expect(within(dialog).getByRole("status").textContent).toBe("3 picked");
  expect(tokens()).toEqual(["Apple", "Cherry", "Grape"]);
});

test("a token's X removes the pick, and keeps a value that is no option", async () => {
  render(<Fruit start={["kiwi", "banana", "fig"]} />);
  expect(tokens()).toEqual(["Banana", "Fig"]);
  await removeToken(document.querySelector<HTMLElement>(".ui-picker")!, "Banana");
  expect(tokens()).toEqual(["Fig"]);
  expect(screen.getByText("Value: kiwi,fig")).toBeTruthy();
});

test("with the keyboard: the focus goes to the search field, Down to the rows, and back to the add button on Done or Escape", async () => {
  render(<Fruit search />);
  const button = addButton();
  button.focus();
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog");
  const search = within(dialog).getByRole("searchbox");
  await waitFor(() => expect(document.activeElement).toBe(search));
  fireEvent.keyDown(search, { key: "ArrowDown" });
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Apple" })));
  fireEvent.click(document.activeElement!);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Banana" })));
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button));
  fireEvent.click(button);
  fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button));
  expect(tokens()).toEqual(["Apple"]);
});

test("after an X removes a token, the focus goes to the next X, then to the last one, then to the add button", async () => {
  render(<Fruit start={["apple", "cherry", "fig"]} />);
  const x = (name: string) => screen.getByRole("button", { name: `Remove ${name}` });
  const cherry = x("Cherry");
  cherry.focus();
  fireEvent.click(cherry);
  // The X of the removed token goes; the focus is on another button.
  expect(cherry.isConnected).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(x("Fig")));
  fireEvent.click(x("Fig"));
  await waitFor(() => expect(document.activeElement).toBe(x("Apple")));
  fireEvent.click(x("Apple"));
  await waitFor(() => expect(document.activeElement).toBe(addButton()));
  expect(document.querySelector(".ui-tokens")?.children).toHaveLength(0);
});

test("an AddButton with no count is a wide button with no description", () => {
  render(<AddButton label="Add a row" />);
  const button = screen.getByRole("button", { name: "Add a row" });
  expect([button.textContent, button.hasAttribute("aria-describedby")]).toEqual(["+ Add a row", false]);
});

test("the picker passes pickedText to its modal", async () => {
  render(<Fruit start={["fig"]} pickedText={(n) => `${n} on the form`} />);
  fireEvent.click(addButton());
  expect(within(await screen.findByRole("dialog")).getByRole("status").textContent).toBe("1 on the form");
});
