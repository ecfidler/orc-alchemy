import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { NumberToggle } from "./NumberToggle.tsx";

afterEach(cleanup);

function Count({ onChange }: { onChange?: (value: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <NumberToggle
      aria-label="Extra baskets"
      values={[null, 1, 2, 3]}
      value={value}
      onValueChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

const pressed = () => screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));

test("a named group of segments, None first, with the value pressed", () => {
  render(<Count />);
  const group = screen.getByRole("group", { name: "Extra baskets" });
  expect([group.className, group.dataset.size]).toEqual(["ui-segmented", "normal"]);
  expect(screen.getAllByRole("button").map((b) => [b.textContent, b.className])).toEqual([
    ["None", "ui-button ui-segment"],
    ["1", "ui-button ui-segment"],
    ["2", "ui-button ui-segment"],
    ["3", "ui-button ui-segment"],
  ]);
  expect(pressed()).toEqual(["true", "false", "false", "false"]);
});

test("a click presses a segment and gives its number; a click on the pressed one changes nothing", () => {
  const change = vi.fn();
  render(<Count onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  expect(pressed()).toEqual(["false", "false", "true", "false"]);
  fireEvent.click(screen.getByRole("button", { name: "2" }));
  fireEvent.click(screen.getByRole("button", { name: "None" }));
  expect(change.mock.calls).toEqual([[2], [null]]);
  expect(pressed()).toEqual(["true", "false", "false", "false"]);
});

test("the keyboard: one tab stop; the arrow keys, Home and End move between the segments", async () => {
  render(<Count />);
  const [none, one, two, three] = screen.getAllByRole("button");
  expect([none, one, two, three].map((b) => b.tabIndex)).toEqual([0, -1, -1, -1]);
  none.focus();
  const key = async (key: string, to: HTMLElement) => {
    fireEvent.keyDown(document.activeElement!, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
  };
  await key("ArrowRight", one);
  await key("End", three);
  await key("ArrowLeft", two);
  await key("Home", none);
});

test("the values are a prop, for example other numbers with no None", () => {
  render(<NumberToggle aria-label="Size" values={[2, 4, 8]} value={4} onValueChange={() => {}} />);
  expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["2", "4", "8"]);
  expect(pressed()).toEqual(["false", "true", "false"]);
});
