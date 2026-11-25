import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Menu } from "./Menu.tsx";
import { optionNames, pickOption } from "./testing/index.ts";

afterEach(cleanup);

test("a menu is a ghost button that lists its items; a pick calls onPick", async () => {
  const pick = vi.fn();
  render(
    <Menu
      label="Add a row at"
      items={[
        [2, "Row 2"],
        [3, "Row 3"],
      ]}
      onPick={pick}
    />,
  );
  const button = screen.getByRole("button", { name: "Add a row at" });
  expect([button.className, button.dataset.variant, button.dataset.size]).toEqual(["ui-button", "ghost", "small"]);
  fireEvent.click(button);
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Row 2", "Row 3"]);
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  await pickOption(button, "Row 3");
  expect(pick).toHaveBeenCalledWith(3);
});

test("optionNames reads a menu's items", async () => {
  render(
    <Menu
      label="Add a row at"
      items={[
        [2, "Row 2"],
        [3, "Row 3"],
      ]}
      onPick={() => {}}
    />,
  );
  expect(await optionNames(screen.getByRole("button", { name: "Add a row at" }))).toEqual(["Row 2", "Row 3"]);
});

test("a menu button can show an icon before its label and gives a ref to the button", () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Menu label="Actions" icon="moon" size="normal" buttonRef={ref} items={[[1, "One"]]} onPick={() => {}} />);
  const button = screen.getByRole("button", { name: "Actions" });
  expect(ref.current).toBe(button);
  expect(button.dataset.size).toBe("normal");
  expect(button.querySelector("svg")?.dataset.icon).toBe("moon");
});

test("the third element of an item adds a muted note at the end of the item, as a part of its name", async () => {
  render(
    <Menu
      label="Add a fruit"
      items={[
        ["fig", "Fig"],
        ["plum", "Plum", "ripe"],
      ]}
      onPick={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Add a fruit" }));
  const items = await screen.findAllByRole("menuitem");
  expect(items.map((i) => i.textContent)).toEqual(["Fig", "Plumripe"]);
  expect(items[1]?.querySelector(".ui-menu-note")?.textContent).toBe("ripe");
  expect(items[0]?.querySelector(".ui-menu-note")).toBeNull();
});

test("a title shows over the items and names the list", async () => {
  render(<Menu label="Sort" title="Sort by" items={[["name", "Name"]]} onPick={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Sort" }));
  const menu = await screen.findByRole("menu", { name: "Sort by" });
  expect(menu.querySelector(".ui-menu-title")?.textContent).toBe("Sort by");
  expect(menu.querySelector(".ui-menu-title")?.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Name"]);
});

test("with checked, the items are radio items: the checked one has aria-checked, and a pick calls onPick and closes the menu", async () => {
  const pick = vi.fn();
  render(
    <Menu
      label="Size"
      checked="m"
      items={[
        ["s", "Small"],
        ["m", "Medium", "default"],
      ]}
      onPick={pick}
    />,
  );
  const button = screen.getByRole("button", { name: "Size" });
  fireEvent.click(button);
  const items = await screen.findAllByRole("menuitemradio");
  expect(items.map((i) => [i.textContent, i.getAttribute("aria-checked")])).toEqual([
    ["Small", "false"],
    ["Mediumdefault", "true"],
  ]);
  expect(screen.queryByRole("menuitem")).toBeNull();
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  expect(await optionNames(button)).toEqual(["Small", "Mediumdefault"]);
  await pickOption(button, "Small");
  expect(pick).toHaveBeenCalledWith("s");
  expect(button.getAttribute("aria-expanded")).toBe("false");
});

test("a bare menu button shows its children, has no look of its own, and the label names it", () => {
  render(
    <Menu label="Score, 18" variant="bare" className="box" items={[[1, "One"]]} onPick={() => {}}>
      <span>18</span>
    </Menu>,
  );
  const button = screen.getByRole("button", { name: "Score, 18" });
  expect([button.className, button.dataset.variant, button.dataset.size, button.textContent]).toEqual(["ui-button box", "bare", undefined, "18"]);
  expect(button.getAttribute("aria-haspopup")).toBe("menu");
});
