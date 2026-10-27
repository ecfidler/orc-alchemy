import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Toggle, ToggleGroup } from "./Toggle.tsx";

afterEach(cleanup);

test("a toggle is a ghost button that reports its pressed state and its press", () => {
  const change = vi.fn();
  render(
    <Toggle pressed={false} onPressedChange={change} className="w-full">
      Bold
    </Toggle>,
  );
  const toggle = screen.getByRole("button", { name: "Bold" });
  expect([toggle.getAttribute("type"), toggle.getAttribute("aria-pressed"), toggle.dataset.variant, toggle.className]).toEqual([
    "button",
    "false",
    "ghost",
    "ui-button w-full",
  ]);
  fireEvent.click(toggle);
  expect(change).toHaveBeenCalledWith(true, expect.anything());
});

test("a pressed toggle is marked for the solid look", () => {
  render(<Toggle pressed>Bold</Toggle>);
  const toggle = screen.getByRole("button", { name: "Bold" });
  expect([toggle.getAttribute("aria-pressed"), toggle.hasAttribute("data-pressed")]).toEqual(["true", true]);
});

function Methods({ onPress }: { onPress?: (key: string, pressed: boolean) => void }) {
  const [value, setValue] = useState(["roll"]);
  return (
    <ToggleGroup aria-label="Method" value={value} className="grid">
      {["average", "roll", "manual"].map((key) => (
        <Toggle
          key={key}
          value={key}
          onPressedChange={(pressed) => {
            onPress?.(key, pressed);
            if (pressed) setValue([key]);
          }}
        >
          {key}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

test("a group is named, takes layout classes, and its value sets which toggles are pressed", () => {
  render(<Methods />);
  const group = screen.getByRole("group", { name: "Method" });
  expect(group.className).toBe("grid");
  const pressed = screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));
  expect(pressed).toEqual(["false", "true", "false"]);
  fireEvent.click(screen.getByRole("button", { name: "average" }));
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
});

test("a group is one tab stop; the arrow keys, Home and End move focus in it", async () => {
  render(<Methods />);
  const [average, roll, manual] = screen.getAllByRole("button");
  expect([average, roll, manual].filter((b) => b.tabIndex === 0)).toHaveLength(1);
  const key = async (from: HTMLElement, key: string, to: HTMLElement) => {
    fireEvent.keyDown(from, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
  };
  average.focus();
  await key(average, "ArrowRight", roll);
  await key(roll, "End", manual);
  await key(manual, "ArrowRight", average);
  await key(average, "ArrowLeft", manual);
  await key(manual, "Home", average);
});

test("a press of a toggle in a controlled group reaches the toggle, and the group keeps its value until the owner changes it", () => {
  const press = vi.fn();
  render(
    <ToggleGroup aria-label="Fixed" value={["a"]}>
      <Toggle value="a" onPressedChange={(pressed) => press("a", pressed)}>
        A
      </Toggle>
    </ToggleGroup>,
  );
  const a = screen.getByRole("button", { name: "A" });
  fireEvent.click(a);
  expect(press).toHaveBeenCalledWith("a", false);
  expect(a.getAttribute("aria-pressed")).toBe("true");
});

test("multiple lets more than one toggle be pressed", () => {
  render(
    <ToggleGroup aria-label="Toppings" value={["a", "b"]} multiple>
      <Toggle value="a">A</Toggle>
      <Toggle value="b">B</Toggle>
    </ToggleGroup>,
  );
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true"]);
});
