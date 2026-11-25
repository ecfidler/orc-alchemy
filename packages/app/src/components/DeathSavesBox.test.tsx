import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import type { DeathSaves } from "../engine/play.ts";
import { DeathSavesBox } from "./DeathSavesBox.tsx";

afterEach(cleanup);

/** The box with its own state, as the sheet page gives it, and a spy on each change. */
function Changing({ start, onChange }: { start: DeathSaves; onChange: (saves: DeathSaves) => void }) {
  const [saves, setSaves] = useState(start);
  return (
    <DeathSavesBox
      saves={saves}
      onChange={(next) => {
        onChange(next);
        setSaves(next);
      }}
    />
  );
}

const box = () => screen.getByRole("group", { name: /^Death saves/ });
const successes = () => screen.getByRole("slider", { name: "Death save successes" });
const failures = () => screen.getByRole("slider", { name: "Death save failures" });
const dead = () => screen.getByRole("button", { name: "Dead" });

test("without onChange the box shows the counts and takes no clicks, as before", () => {
  render(<DeathSavesBox saves={{ successes: 3, failures: 3 }} />);
  expect(screen.getByRole("img", { name: "Successes: 3 of 3" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Failures: 3 of 3" })).toBeTruthy();
  expect(screen.queryByRole("slider")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByText("Dead")).toBeNull();
});

test("each group is a slider with its state; a click and the arrow keys change it by one", () => {
  const onChange = vi.fn();
  render(<Changing start={{ successes: 0, failures: 2 }} onChange={onChange} />);
  expect(box()).toBeTruthy();
  expect(successes().getAttribute("aria-valuetext")).toBe("0 of 3");
  expect(failures().getAttribute("aria-valuetext")).toBe("2 of 3");
  expect(successes().tabIndex).toBe(0);
  fireEvent.click(successes().children[2]!);
  fireEvent.keyDown(successes(), { key: "ArrowUp" });
  fireEvent.keyDown(failures(), { key: "ArrowLeft" });
  fireEvent.keyDown(failures(), { key: "ArrowDown" });
  fireEvent.keyDown(failures(), { key: "ArrowDown" });
  expect(onChange.mock.calls).toEqual([
    [{ successes: 1, failures: 2 }],
    [{ successes: 2, failures: 2 }],
    [{ successes: 2, failures: 1 }],
    [{ successes: 2, failures: 0 }],
  ]);
});

test("three successes show the tag Stable, which is in the name of the box", () => {
  const { rerender } = render(<DeathSavesBox saves={{ successes: 2, failures: 1 }} onChange={() => {}} />);
  expect(box().getAttribute("aria-labelledby")).not.toContain(" ");
  // The tag keeps its space and is hidden.
  expect(screen.getByText("Stable").getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByText("Stable").className).toContain("invisible");
  rerender(<DeathSavesBox saves={{ successes: 3, failures: 1 }} onChange={() => {}} />);
  expect(screen.getByText("Stable").className).not.toContain("invisible");
  expect(screen.getByRole("group", { name: "Death saves Stable" })).toBeTruthy();
});

test("three failures show the button Dead in the place of the failure circles; it clears one failure", () => {
  const onChange = vi.fn();
  render(<Changing start={{ successes: 3, failures: 2 }} onChange={onChange} />);
  expect(screen.queryByRole("button", { name: "Dead" })).toBeNull();
  fireEvent.keyDown(failures(), { key: "ArrowRight" });
  // Dead, and no Stable tag beside the label.
  expect(screen.getByRole("group", { name: "Death saves Dead" })).toBeTruthy();
  expect(screen.getByText("Stable").className).toContain("invisible");
  expect(screen.queryByRole("slider", { name: "Death save failures" })).toBeNull();
  expect(dead().tabIndex).toBe(0);
  expect(dead().getAttribute("aria-describedby")).toBeTruthy();
  expect(document.getElementById(dead().getAttribute("aria-describedby")!)!.textContent).toBe("Death save failures, 3 of 3. Clears one failure.");
  fireEvent.click(dead());
  expect(failures().getAttribute("aria-valuetext")).toBe("2 of 3");
  expect(screen.queryByRole("button", { name: "Dead" })).toBeNull();
  expect(onChange.mock.calls.at(-1)).toEqual([{ successes: 3, failures: 2 }]);
});

test("Left and Down on the Dead button clear one failure; Right and Up do nothing", () => {
  const onChange = vi.fn();
  render(<DeathSavesBox saves={{ successes: 0, failures: 3 }} onChange={onChange} />);
  fireEvent.keyDown(dead(), { key: "ArrowRight" });
  fireEvent.keyDown(dead(), { key: "ArrowUp" });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(dead(), { key: "ArrowLeft" });
  fireEvent.keyDown(dead(), { key: "ArrowDown" });
  expect(onChange.mock.calls).toEqual([[{ successes: 0, failures: 2 }], [{ successes: 0, failures: 2 }]]);
});

test("the focus goes with the failures: from the circles to Dead, and back", () => {
  render(<Changing start={{ successes: 0, failures: 2 }} onChange={() => {}} />);
  failures().focus();
  fireEvent.keyDown(failures(), { key: "ArrowRight" });
  expect(document.activeElement).toBe(dead());
  fireEvent.click(dead());
  expect(document.activeElement).toBe(failures());
});

test("a change from outside the box does not take the focus", () => {
  const { rerender } = render(<DeathSavesBox saves={{ successes: 0, failures: 0 }} onChange={() => {}} />);
  successes().focus();
  rerender(<DeathSavesBox saves={{ successes: 0, failures: 3 }} onChange={() => {}} />);
  expect(document.activeElement).toBe(successes());
});

test("at exhaustion level 6 the label Dead takes the place of the failure circles, as a text and not a button; the counts stay", () => {
  const onChange = vi.fn();
  render(<DeathSavesBox saves={{ successes: 1, failures: 1 }} exhausted onChange={onChange} />);
  expect(screen.getByRole("group", { name: "Death saves Dead" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Dead" })).toBeNull();
  expect(screen.queryByRole("slider", { name: "Death save failures" })).toBeNull();
  const label = document.querySelector<HTMLElement>("[data-dead-text]")!;
  expect(label.textContent).toBe("Dead");
  fireEvent.click(label);
  expect(onChange).not.toHaveBeenCalled();
  // The successes can still change.
  expect(screen.getByRole("slider", { name: "Death save successes" }).getAttribute("aria-valuetext")).toBe("1 of 3");
});

test("with three failures and exhaustion level 6, the label is not a button either", () => {
  render(<DeathSavesBox saves={{ successes: 0, failures: 3 }} exhausted onChange={() => {}} />);
  expect(screen.queryByRole("button", { name: "Dead" })).toBeNull();
  expect(screen.getByRole("group", { name: "Death saves Dead" })).toBeTruthy();
});
