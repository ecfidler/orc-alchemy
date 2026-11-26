import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Button } from "./Button.tsx";
import { ListPanel, type ListPanelItem, type ListPanelProps } from "./ListPanel.tsx";

afterEach(cleanup);

const FRUITS: ListPanelItem<string>[] = [
  { value: "apple", label: "Apples" },
  { value: "pear", label: "Pears", aside: "Orchard Pack" },
  { value: "plum", label: "Plums", unavailable: "It needs a stone fruit tree." },
];

/** A list of fruits whose Choose button picks the current fruit. */
function Fruits(props: Partial<ListPanelProps<string>>) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <>
      <output>{picked}</output>
      <ListPanel
        label="Fruits"
        items={FRUITS}
        picked={picked}
        detail={(item, place) => <p>{`${item.label} in the ${place}`}</p>}
        action={(item) =>
          item.unavailable ? (
            <span>{item.unavailable}</span>
          ) : (
            <Button variant="solid" onClick={() => setPicked(item.value)}>
              {`Choose ${item.label}`}
            </Button>
          )
        }
        emptyText="Select a fruit to read about it."
        {...props}
      />
    </>
  );
}

const list = () => screen.getByRole("list", { name: "Fruits" });
const names = () => [...list().querySelectorAll(".ui-list-panel-name")].map((name) => name.textContent);
const rowOf = (name: string) => within(document.querySelector<HTMLElement>(".ui-list-panel")!).getByRole("button", { name });

test("before a click the panel has the empty text; a click shows the row in the panel with aria-current and picks nothing", () => {
  render(<Fruits />);
  expect(screen.getByText("Select a fruit to read about it.")).toBeTruthy();
  expect(names()).toEqual(["Apples", "Pears", "Plums"]);
  expect(rowOf("Pears").querySelector(".ui-list-panel-aside")?.textContent).toBe("Orchard Pack");
  fireEvent.click(rowOf("Pears"));
  expect(rowOf("Pears").getAttribute("aria-current")).toBe("true");
  expect(rowOf("Apples").hasAttribute("aria-current")).toBe(false);
  const panel = screen.getByRole("region", { name: "Pears" });
  expect(within(panel).getByText("Pears in the panel")).toBeTruthy();
  expect(screen.getByRole("status").textContent).toBe("");
  fireEvent.click(within(panel).getByRole("button", { name: "Choose Pears" }));
  expect(screen.getByRole("status").textContent).toBe("pear");
});

test("an unavailable row has the lock and its reason as its description; a click still shows it in the panel", () => {
  render(<Fruits />);
  const plums = rowOf("Plums");
  expect(plums.querySelector("svg")).toBeTruthy();
  expect(document.getElementById(plums.getAttribute("aria-describedby")!)?.textContent).toBe("It needs a stone fruit tree.");
  expect(plums.hasAttribute("disabled")).toBe(false);
  fireEvent.click(plums);
  expect(within(screen.getByRole("region", { name: "Plums" })).getByText("It needs a stone fruit tree.")).toBeTruthy();
});

test("the picked row is bold with the check, and defaultCurrent shows it and gives its row the focus", () => {
  render(<Fruits defaultCurrent="apple" picked="apple" />);
  const apples = rowOf("Apples");
  expect(apples.hasAttribute("data-picked")).toBe(true);
  expect(apples.querySelector("svg")).toBeTruthy();
  expect(apples.getAttribute("aria-current")).toBe("true");
  expect(document.activeElement).toBe(apples);
  expect(screen.getByText("Apples in the panel")).toBeTruthy();
});

test("the search filters by name, and a search with no result shows one line", () => {
  render(<Fruits search={{ placeholder: "Search 3 fruits" }} />);
  const search = screen.getByRole("searchbox", { name: "Search" });
  expect(search.getAttribute("placeholder")).toBe("Search 3 fruits");
  fireEvent.change(search, { target: { value: "plu" } });
  expect(names()).toEqual(["Plums"]);
  fireEvent.change(search, { target: { value: "kiwi" } });
  expect(screen.queryByRole("list", { name: "Fruits" })).toBeNull();
  expect(screen.getByText("Nothing matches. Try another word.")).toBeTruthy();
});

test("Up and Down, Home and End move between the rows and the fixed row; Down in the search goes to the first row", () => {
  render(<Fruits search={{ placeholder: "Search" }} fixedRow={{ value: "new", label: "New fruit", icon: "plus" }} />);
  const search = screen.getByRole("searchbox", { name: "Search" });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(document.activeElement).toBe(rowOf("Apples"));
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(rowOf("New fruit"));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(rowOf("Plums"));
  fireEvent.keyDown(document.activeElement!, { key: "Home" });
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(search);
});

test("the fixed row is after the list, the search does not filter it, and a click shows it in the panel", () => {
  render(<Fruits search={{ placeholder: "Search" }} fixedRow={{ value: "new", label: "New fruit", icon: "plus" }} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "kiwi" } });
  const fixed = rowOf("New fruit");
  expect(fixed.closest(".ui-list-panel-fixed")).toBeTruthy();
  fireEvent.click(fixed);
  expect(screen.getByText("New fruit in the panel")).toBeTruthy();
});

test("when the panel does not show (a narrow part), a click opens the detail in a modal with the action", async () => {
  render(<Fruits />);
  // jsdom has no container queries: hide the panel as the narrow style does.
  document.querySelector<HTMLElement>(".ui-list-panel-detail")!.style.display = "none";
  fireEvent.click(rowOf("Apples"));
  const dialog = await screen.findByRole("dialog", { name: "Apples" });
  expect(within(dialog).getByText("Apples in the modal")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Choose Apples" }));
  // The page under the modal is hidden from the roles.
  expect(document.querySelector("output")?.textContent).toBe("apple");
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
