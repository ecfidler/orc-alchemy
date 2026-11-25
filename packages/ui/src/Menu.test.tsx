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
