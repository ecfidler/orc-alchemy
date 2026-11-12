import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { ListModal, type ListItem } from "./ListModal.tsx";
import { Token } from "./Token.tsx";
import { pickFromPicker } from "./testing/index.ts";

afterEach(cleanup);

const BASKETS: ListItem<string>[] = [
  { value: "apple", label: "Apples", example: "Red or green, crisp" },
  { value: "pear", label: "Pears", example: "Soft and sweet" },
  { value: "plum", label: "Plums", example: "Dark, with a stone" },
];

/** A button that opens a list that closes on a click, and the picks so far. */
function AddBasket({ onPick = () => {} }: { onPick?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  return (
    <>
      <button onClick={() => setOpen(true)}>Add a basket</button>
      <output>{picks.join(",")}</output>
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add a basket"
        items={BASKETS.filter((item) => !picks.includes(item.value))}
        onPick={(value) => {
          onPick(value);
          setPicks([...picks, value]);
        }}
      />
    </>
  );
}

const open = async (name = "Add a basket") => {
  const button = screen.getByRole("button", { name });
  button.focus();
  fireEvent.click(button);
  return { button, dialog: await screen.findByRole("dialog", { name }) };
};

const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

test("a list that closes on a click: rows with a name, an example and an Add mark, and no search or footer", async () => {
  render(<AddBasket />);
  const { dialog } = await open();
  expect(dialog.className).toBe("ui-list-modal");
  const rows = within(dialog.querySelector<HTMLElement>(".ui-list-body")!).getAllByRole("button");
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(["Apples", "Pears", "Plums"]);
  const pears = within(dialog).getByRole("button", { name: "Pears" });
  expect(pears).toHaveProperty("textContent", "PearsSoft and sweetAdd");
  expect(document.getElementById(pears.getAttribute("aria-describedby")!)?.textContent).toBe("Soft and sweet");
  expect(pears.querySelector(".ui-list-add")?.getAttribute("aria-hidden")).toBe("true");
  expect([within(dialog).queryByRole("searchbox"), within(dialog).queryByRole("button", { name: "Done" }), within(dialog).queryByRole("status")]).toEqual([null, null, null]);
  expect(within(dialog).getByRole("button", { name: "Close" }).className).toBe("ui-x-button");
});

test("a click picks the row and closes the list, and the focus goes back to the button", async () => {
  const pick = vi.fn();
  render(<AddBasket onPick={pick} />);
  const { button, dialog } = await open();
  fireEvent.click(within(dialog).getByRole("button", { name: "Pears" }));
  await closed();
  expect(pick).toHaveBeenCalledWith("pear");
  expect(screen.getByRole("status").textContent).toBe("pear");
  await waitFor(() => expect(document.activeElement).toBe(button));
  // The picked row is not in the list when it opens again.
  await pickFromPicker(button, "Plums");
  expect(screen.getByRole("status").textContent).toBe("pear,plum");
});

test("the X, Escape and a click outside close the list, with no pick", async () => {
  const pick = vi.fn();
  render(<AddBasket onPick={pick} />);
  let { dialog } = await open();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await closed();
  ({ dialog } = await open());
  fireEvent.keyDown(dialog, { key: "Escape" });
  await closed();
  await open();
  const backdrop = document.querySelector(".ui-list-backdrop")!;
  fireEvent.pointerDown(backdrop);
  fireEvent.mouseDown(backdrop);
  fireEvent.click(backdrop);
  await closed();
  expect(pick).not.toHaveBeenCalled();
});

test("the focus goes to the first row; Up, Down, Home and End move between the rows", async () => {
  render(<AddBasket />);
  const { button, dialog } = await open();
  const [apples, pears, plums] = within(dialog.querySelector<HTMLElement>(".ui-list-body")!).getAllByRole("button");
  await waitFor(() => expect(document.activeElement).toBe(apples));
  const key = async (key: string, to: HTMLElement) => {
    fireEvent.keyDown(document.activeElement!, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
  };
  await key("ArrowDown", pears);
  await key("ArrowDown", plums);
  await key("ArrowDown", plums);
  await key("Home", apples);
  await key("End", plums);
  await key("ArrowUp", pears);
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await closed();
  await waitFor(() => expect(document.activeElement).toBe(button));
});

test("an empty list shows its empty line", async () => {
  render(<ListModal open onOpenChange={() => {}} title="Add a basket" items={[]} onPick={() => {}} emptyText="Every basket is on the table." />);
  expect(within(await screen.findByRole("dialog")).getByText("Every basket is on the table.")).toBeTruthy();
});

const FRUIT: ListItem<string>[] = [
  { value: "apple", label: "Apple", group: "Orchard" },
  { value: "pear", label: "Pear", group: "Orchard" },
  { value: "plum", label: "Plum", group: "Orchard" },
  { value: "lime", label: "Lime", group: "Citrus" },
  { value: "lemon", label: "Lemon", group: "Citrus" },
];

/** A list that stays open; a pick leaves the list. `full` closes it once that many are picked, as a caller with one slot does. */
function FruitBowl({ search = false, full, pickedText }: { search?: boolean; full?: number; pickedText?: (n: number) => string }) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={button} onClick={() => setOpen(true)}>
        Add fruit
      </button>
      <span>Bowl: {picks.join(",")}</span>
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add fruit"
        items={FRUIT.filter((item) => !picks.includes(item.value))}
        onPick={(value) => {
          const next = [...picks, value];
          setPicks(next);
          if (next.length === full) setOpen(false);
        }}
        stayOpen
        picked={picks.length}
        pickedText={pickedText}
        search={search}
        finalFocus={button}
      />
    </>
  );
}

test("a list that stays open: groups as headings, a picked row leaves, and the footer counts the picks politely", async () => {
  render(<FruitBowl />);
  const { dialog } = await open("Add fruit");
  expect(within(dialog).getByRole("list", { name: "Orchard" }).querySelectorAll("button")).toHaveLength(3);
  expect(within(dialog).getByRole("list", { name: "Citrus" }).querySelectorAll("button")).toHaveLength(2);
  const count = within(dialog).getByRole("status");
  expect(count.textContent).toBe("0 picked");
  fireEvent.click(within(dialog).getByRole("button", { name: "Pear" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Lime" }));
  expect(count.textContent).toBe("2 picked");
  expect(within(dialog).queryByRole("button", { name: "Pear" })).toBeNull();
  expect(screen.getByText("Bowl: pear,lime")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await closed();
});

test("after a pick the picked row's button goes, and the focus goes to the next row, or to the row before at the end of the list", async () => {
  render(<FruitBowl />);
  const { dialog } = await open("Add fruit");
  const row = (name: string) => within(dialog).getByRole("button", { name });
  const apple = row("Apple");
  await waitFor(() => expect(document.activeElement).toBe(apple));
  fireEvent.click(apple);
  expect(apple.isConnected).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(row("Pear")));
  const lemon = row("Lemon");
  lemon.focus();
  fireEvent.click(lemon);
  expect(lemon.isConnected).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(row("Lime")));
  // The last row of a group: its heading goes too, and the focus goes to the first row of the next group.
  const lime = row("Lime");
  fireEvent.click(lime);
  expect(within(dialog).queryByRole("list", { name: "Citrus" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(row("Plum")));
});

test("search filters as the user types, by name or group, and shows a line when nothing matches", async () => {
  render(<FruitBowl search />);
  const { dialog } = await open("Add fruit");
  const search = within(dialog).getByRole("searchbox", { name: "Search" });
  await waitFor(() => expect(document.activeElement).toBe(search));
  const rows = () => [...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"));
  fireEvent.change(search, { target: { value: "le" } });
  expect(rows()).toEqual(["Apple", "Lemon"]);
  fireEvent.change(search, { target: { value: "CITRUS" } });
  expect(rows()).toEqual(["Lime", "Lemon"]);
  fireEvent.change(search, { target: { value: "kiwi" } });
  expect(rows()).toEqual([]);
  expect(within(dialog).getByText("Nothing matches. Try another word.")).toBeTruthy();
  // Down goes from the search field to the first row, and Up from the first row back.
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Apple" })));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
  await waitFor(() => expect(document.activeElement).toBe(search));
});

test("the search text is empty again at the next open", async () => {
  render(<FruitBowl search />);
  let { dialog } = await open("Add fruit");
  fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "lime" } });
  fireEvent.keyDown(dialog, { key: "Escape" });
  await closed();
  ({ dialog } = await open("Add fruit"));
  expect(within(dialog).getByRole("searchbox")).toHaveProperty("value", "");
});

test("the owner can close a list that stays open, for example when a slot is full; the focus goes to finalFocus", async () => {
  render(<FruitBowl full={2} />);
  const { button, dialog } = await open("Add fruit");
  fireEvent.click(within(dialog).getByRole("button", { name: "Plum" }));
  expect(screen.queryByRole("dialog")).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Lime" }));
  await closed();
  expect(screen.getByText("Bowl: plum,lime")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(button));
});

test("pickFromPicker picks several rows, types each name in the search field, and clicks Done", async () => {
  render(<FruitBowl search />);
  await pickFromPicker(screen.getByRole("button", { name: "Add fruit" }), ["Lemon", "Apple"]);
  expect(screen.getByText("Bowl: lemon,apple")).toBeTruthy();
});

test("pickedText sets the footer text", async () => {
  render(<FruitBowl pickedText={(n) => `${n} on the form`} />);
  const { dialog } = await open("Add fruit");
  fireEvent.click(within(dialog).getByRole("button", { name: "Plum" }));
  expect(within(dialog).getByRole("status").textContent).toBe("1 on the form");
});

test("pickFromPicker clears the search field for a RegExp name", async () => {
  render(<FruitBowl search />);
  await pickFromPicker(screen.getByRole("button", { name: "Add fruit" }), ["Lemon", /Apple/]);
  expect(screen.getByText("Bowl: lemon,apple")).toBeTruthy();
});

/** One slot: an add button while it is empty, a token once it holds a pick. The add button goes with the pick, so finalFocus finds the token's X. */
function Slot() {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const item = FRUIT.find((f) => f.value === pick);
  const slot = useRef<HTMLDivElement>(null);
  return (
    <div ref={slot}>
      {item ? (
        <Token label={item.label} onRemove={() => setPick(null)} />
      ) : (
        <button onClick={() => setOpen(true)}>Add to the slot</button>
      )}
      <ListModal
        open={open}
        onOpenChange={setOpen}
        title="Add to the slot"
        items={FRUIT}
        onPick={(value) => {
          setPick(value);
          setOpen(false);
        }}
        stayOpen
        picked={pick ? 1 : 0}
        // A DOM query, not a role query: the page is still inert while the modal closes.
        finalFocus={() => slot.current?.querySelector<HTMLElement>(".ui-token .ui-x-button") ?? null}
      />
    </div>
  );
}

test("finalFocus can be a function, for an element that the pick made", async () => {
  render(<Slot />);
  const { dialog } = await open("Add to the slot");
  fireEvent.click(within(dialog).getByRole("button", { name: "Lime" }));
  await closed();
  expect(screen.queryByRole("button", { name: "Add to the slot" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Lime" })));
});
