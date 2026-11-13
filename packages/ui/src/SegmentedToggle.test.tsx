import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { SegmentedToggle } from "./SegmentedToggle.tsx";

afterEach(cleanup);

const OPTIONS = [
  ["none", "None"],
  ["fixed", "Fixed"],
  ["scaled", "Scaled"],
] as const;
type Kind = (typeof OPTIONS)[number][0];

function Kinds({ start = "none", onChange }: { start?: Kind | null; onChange?: (value: Kind) => void }) {
  const [value, setValue] = useState<Kind | null>(start);
  return (
    <SegmentedToggle
      aria-label="Uses"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        onChange?.(next);
        setValue(next);
      }}
    />
  );
}

const pressed = () => screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));

test("a named group of segments with their text, the value pressed", () => {
  render(<Kinds />);
  const group = screen.getByRole("group", { name: "Uses" });
  expect([group.className, group.dataset.size]).toEqual(["ui-segmented", "normal"]);
  expect(screen.getAllByRole("button").map((b) => [b.textContent, b.className])).toEqual([
    ["None", "ui-button ui-segment"],
    ["Fixed", "ui-button ui-segment"],
    ["Scaled", "ui-button ui-segment"],
  ]);
  expect(pressed()).toEqual(["true", "false", "false"]);
});

test("a click presses a segment and gives its value; a click on the pressed one changes nothing", () => {
  const change = vi.fn();
  render(<Kinds onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: "Scaled" }));
  expect(pressed()).toEqual(["false", "false", "true"]);
  fireEvent.click(screen.getByRole("button", { name: "Scaled" }));
  fireEvent.click(screen.getByRole("button", { name: "Fixed" }));
  expect(change.mock.calls).toEqual([["scaled"], ["fixed"]]);
});

test("a null value presses no segment", () => {
  render(<Kinds start={null} />);
  expect(pressed()).toEqual(["false", "false", "false"]);
});

test("the keyboard: the arrow keys, Home and End move between the segments", async () => {
  render(<Kinds />);
  const [none, fixed, scaled] = screen.getAllByRole("button");
  none.focus();
  const key = async (key: string, to: HTMLElement) => {
    fireEvent.keyDown(document.activeElement!, { key });
    await waitFor(() => expect(document.activeElement).toBe(to));
  };
  await key("ArrowRight", fixed);
  await key("End", scaled);
  await key("Home", none);
});
