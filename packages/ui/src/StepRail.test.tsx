import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LeftMark, type RailStep, StepRail } from "./StepRail.tsx";

afterEach(cleanup);

const steps: RailStep[] = [
  { value: "a", label: "Start" },
  { value: "b", label: "Rows", left: 2 },
  { value: "c", label: "Cells", over: 1 },
  { value: "d", label: "Notes", dimmed: true },
];

test("the rail is a nav with a list of buttons: the number and the name, and the current step has aria-current", () => {
  const onStepChange = vi.fn();
  render(<StepRail steps={steps} current="b" onStepChange={onStepChange} />);
  const nav = screen.getByRole("navigation", { name: "Steps" });
  const items = within(within(nav).getByRole("list")).getAllByRole("listitem");
  expect(items).toHaveLength(4);
  const buttons = within(nav).getAllByRole("button");
  // The number shows, but it is not a part of the name.
  expect(buttons[0].textContent).toBe("1Start");
  expect(within(nav).getByRole("button", { name: "Start" })).toBe(buttons[0]);
  expect(buttons[1].getAttribute("aria-current")).toBe("step");
  expect(buttons[0].getAttribute("aria-current")).toBeNull();
  fireEvent.click(buttons[2]);
  expect(onStepChange).toHaveBeenCalledWith("c");
});

test("the marks of a step are numbers and red marks, and the name has them in words", () => {
  render(<StepRail steps={[...steps, { value: "e", label: "Both", left: 1, over: 3 }]} current="a" onStepChange={() => {}} />);
  const rows = screen.getByRole("button", { name: "Rows, 2 picks left" });
  const left = rows.querySelector<HTMLElement>(".ui-inline-note")!;
  expect(left.textContent).toBe("2");
  expect(left.className).toBe("ui-inline-note");
  expect(left.dataset.tone).toBe("act");
  expect(left.getAttribute("aria-hidden")).toBe("true");
  const cells = screen.getByRole("button", { name: "Cells, remove 1 pick" });
  expect(within(cells).getByText("Remove 1").dataset.tone).toBe("failed");
  expect(screen.getByRole("button", { name: "Both, 1 pick left, remove 3 picks" })).toBeTruthy();
  // A step with no picks left has no mark.
  expect(screen.getByRole("button", { name: "Start" }).querySelector(".ui-inline-note")).toBeNull();
});

test("a dimmed step is marked and still opens", () => {
  const onStepChange = vi.fn();
  render(<StepRail steps={steps} current="a" onStepChange={onStepChange} />);
  const notes = screen.getByRole("button", { name: "Notes" });
  expect(notes.hasAttribute("data-dimmed")).toBe(true);
  expect(screen.getByRole("button", { name: "Start" }).hasAttribute("data-dimmed")).toBe(false);
  fireEvent.click(notes);
  expect(onStepChange).toHaveBeenCalledWith("d");
});

test("the current step scrolls into view in the row", () => {
  const { rerender } = render(<StepRail steps={steps} current="a" onStepChange={() => {}} />);
  const row = screen.getByRole("list");
  // jsdom has no layout: give the row and the buttons their boxes.
  Object.defineProperty(row, "clientWidth", { value: 100 });
  screen.getAllByRole("button").forEach((button, i) => {
    Object.defineProperty(button, "offsetLeft", { value: i * 80 });
    Object.defineProperty(button, "offsetWidth", { value: 80 });
  });
  rerender(<StepRail steps={steps} current="d" onStepChange={() => {}} />);
  // The fourth button is at 240 to 320: the row scrolls to show its end.
  expect(row.scrollLeft).toBe(220);
  rerender(<StepRail steps={steps} current="a" onStepChange={() => {}} />);
  expect(row.scrollLeft).toBe(0);
});

test("a left mark: n left in yellow, Remove n in red, and a check with Done, in the same box", () => {
  const { rerender } = render(
    <h3>
      Rows
      <LeftMark left={2} />
    </h3>,
  );
  const heading = screen.getByRole("heading");
  // The mark is a part of the heading text.
  expect(heading.textContent).toBe("Rows2 left");
  const box = heading.querySelector(".ui-left-mark")!;
  expect(within(heading).getByText("2 left").dataset.tone).toBe("act");
  rerender(
    <h3>
      Rows
      <LeftMark left={-1} />
    </h3>,
  );
  expect(heading.textContent).toBe("RowsRemove 1");
  expect(within(heading).getByText("Remove 1").dataset.tone).toBe("failed");
  rerender(
    <h3>
      Rows
      <LeftMark left={0} />
    </h3>,
  );
  expect(heading.textContent).toBe("RowsDone");
  expect(heading.querySelector('svg[data-icon="check"]')).toBeTruthy();
  // The same box holds each mark, so it keeps its place.
  expect(heading.querySelector(".ui-left-mark")).toBe(box);
});
