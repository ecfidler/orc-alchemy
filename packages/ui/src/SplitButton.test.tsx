import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { SplitButton, type SplitButtonItem } from "./SplitButton.tsx";

afterEach(cleanup);

const ITEMS: SplitButtonItem<string>[] = [
  { value: "large", label: "Large", detail: "+2 cups", aside: "3 left" },
  { value: "huge", label: "Huge", detail: "+4 cups", aside: "none left", disabled: true },
];

const openMenu = async (name = "Pour more") => {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.findByRole("menu", { name });
};

test("the main part does the action; the arrow part has the menu's name and opens the menu with its title and items in three columns", async () => {
  const click = vi.fn();
  render(
    <>
      <SplitButton aria-label="Pour" icon="sparkles" onClick={click} aria-describedby="hint" menuLabel="Pour more" items={ITEMS} onPick={() => {}}>
        Pour
      </SplitButton>
      <p id="hint">Small cup · 2 left</p>
    </>,
  );
  const group = screen.getByRole("group", { name: "Pour" });
  const main = within(group).getByRole("button", { name: "Pour" });
  expect([main.dataset.variant, main.getAttribute("aria-describedby"), main.querySelector("svg")?.dataset.icon]).toEqual(["solid", "hint", "sparkles"]);
  fireEvent.click(main);
  expect(click).toHaveBeenCalledTimes(1);
  const arrow = within(group).getByRole("button", { name: "Pour more" });
  expect(arrow.getAttribute("aria-haspopup")).toBe("menu");
  const menu = await openMenu();
  expect(menu.textContent).toContain("Pour more");
  expect(menu.hasAttribute("data-details")).toBe(true);
  const items = within(menu).getAllByRole("menuitem");
  expect(items.map((item) => [...item.children].map((cell) => cell.textContent))).toEqual([
    ["Large", "+2 cups", "3 left"],
    ["Huge", "+4 cups", "none left"],
  ]);
  expect(items[1].hasAttribute("data-disabled")).toBe(true);
});

test("a pick calls onPick with the value and closes the menu; a disabled item does nothing", async () => {
  const pick = vi.fn();
  render(
    <SplitButton onClick={() => {}} menuLabel="Pour more" items={ITEMS} onPick={pick}>
      Pour
    </SplitButton>,
  );
  let menu = await openMenu();
  fireEvent.click(within(menu).getByRole("menuitem", { name: /Huge/ }));
  expect(pick).not.toHaveBeenCalled();
  fireEvent.click(within(menu).getByRole("menuitem", { name: /Large/ }));
  expect(pick).toHaveBeenCalledWith("large");
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  menu = await openMenu();
  expect(menu).toBeTruthy();
});

test("with no detail the menu has two columns; a note shows at the bottom and describes the menu", async () => {
  render(
    <SplitButton
      onClick={() => {}}
      menuLabel="Pour more"
      items={ITEMS.map(({ detail: _, ...item }) => item)}
      onPick={() => {}}
      menuNote="A larger cup holds more."
    >
      Pour
    </SplitButton>,
  );
  const menu = await openMenu();
  expect(menu.hasAttribute("data-details")).toBe(false);
  expect(within(menu).getAllByRole("menuitem")[0].children).toHaveLength(2);
  const note = within(menu).getByText("A larger cup holds more.");
  expect(menu.getAttribute("aria-describedby")).toBe(note.id);
});

test("the two parts disable apart", () => {
  render(
    <SplitButton disabled menuDisabled onClick={() => {}} menuLabel="Pour more" items={ITEMS} onPick={() => {}}>
      Pour
    </SplitButton>,
  );
  expect(screen.getByRole("button", { name: "Pour" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Pour more" }).hasAttribute("data-disabled")).toBe(true);
});

test("with no items it is a plain button in its group, with no arrow part", () => {
  render(
    <SplitButton variant="ghost" onClick={() => {}} menuLabel="Pour more" items={null}>
      Pour
    </SplitButton>,
  );
  expect(screen.getAllByRole("button").map((b) => [b.textContent, b.dataset.variant])).toEqual([["Pour", "ghost"]]);
});

test("with widthOf the menu fills that element", async () => {
  function Wide() {
    const column = useRef<HTMLDivElement>(null);
    return (
      <div ref={column}>
        <SplitButton onClick={() => {}} menuLabel="Pour more" items={ITEMS} onPick={() => {}} widthOf={column}>
          Pour
        </SplitButton>
      </div>
    );
  }
  render(<Wide />);
  expect((await openMenu()).hasAttribute("data-fill")).toBe(true);
});
