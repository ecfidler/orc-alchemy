import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { NumberField } from "./NumberField.tsx";

afterEach(cleanup);

function Count({ onChange, initial = 5 }: { onChange?: (n: number | null) => void; initial?: number | null }) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <NumberField
      aria-label="Count"
      value={value}
      min={1}
      max={20}
      onValueChange={(n) => {
        onChange?.(n);
        setValue(n);
      }}
      className="w-20"
    />
  );
}

const field = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Count" });

test("a number field is a named textbox that shows its value and takes layout classes", () => {
  render(<Count />);
  expect([field().value, field().className]).toEqual(["5", "ui-number-input w-20"]);
});

test("each typed change reports the whole number, or null when the field is empty", () => {
  const change = vi.fn();
  render(<Count onChange={change} />);
  for (const text of ["12", "", "7.9", "-3", "-0"]) fireEvent.change(field(), { target: { value: text } });
  expect(change.mock.calls.map(([n]) => n)).toEqual([12, null, 7, -3, 0]);
});

test("a typed number outside min and max still reaches onValueChange", () => {
  const change = vi.fn();
  render(<Count onChange={change} />);
  fireEvent.change(field(), { target: { value: "0" } });
  fireEvent.change(field(), { target: { value: "25" } });
  expect(change.mock.calls.map(([n]) => n)).toEqual([0, 25]);
});

test("the arrow keys step by 1 and stop at the limits", () => {
  render(<Count initial={19} />);
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  expect(field().value).toBe("20");
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  expect(field().value).toBe("20");
  fireEvent.keyDown(field(), { key: "ArrowDown" });
  expect(field().value).toBe("19");
});

test("a large number shows with no grouping", () => {
  render(<NumberField aria-label="Total" value={12000} onValueChange={() => {}} />);
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Total" }).value).toBe("12000");
});

test("in a label, the label names the field", () => {
  render(
    <label>
      Speed <NumberField value={null} onValueChange={() => {}} />
    </label>,
  );
  expect(screen.getByLabelText<HTMLInputElement>("Speed").value).toBe("");
});

test("a new value from the owner replaces the shown number", () => {
  const { rerender } = render(<NumberField aria-label="Count" value={5} onValueChange={() => {}} />);
  rerender(<NumberField aria-label="Count" value={8} onValueChange={() => {}} />);
  expect(field().value).toBe("8");
  rerender(<NumberField aria-label="Count" value={null} onValueChange={() => {}} />);
  expect(field().value).toBe("");
});

test("a disabled field is disabled and marked, and the arrow keys do not change it", () => {
  const change = vi.fn();
  render(<NumberField aria-label="Count" value={5} min={1} max={20} onValueChange={change} disabled />);
  expect([field().disabled, field().hasAttribute("data-disabled")]).toEqual([true, true]);
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  expect([field().value, change.mock.calls.length]).toEqual(["5", 0]);
  // src/number-field.css gives [data-disabled] the muted text and the --rule-strong border of a disabled button.
});

test("a field is not disabled by default", () => {
  render(<Count />);
  expect([field().disabled, field().hasAttribute("data-disabled")]).toEqual([false, false]);
});

test("onValueCommitted gets a typed number at the loss of the focus, and at Enter, after which the focus stays", () => {
  const committed = vi.fn();
  render(<NumberField aria-label="Count" value={5} onValueChange={() => {}} onValueCommitted={committed} />);
  field().focus();
  fireEvent.change(field(), { target: { value: "8" } });
  expect(committed).not.toHaveBeenCalled();
  fireEvent.keyDown(field(), { key: "Enter" });
  expect(committed.mock.calls.map(([n]) => n)).toEqual([8]);
  expect(document.activeElement).toBe(field());
  fireEvent.change(field(), { target: { value: "-0" } });
  field().blur();
  expect(committed.mock.calls.map(([n]) => n)).toEqual([8, 0]);
  // Enter with no typed number commits nothing.
  field().focus();
  fireEvent.keyDown(field(), { key: "Enter" });
  expect(committed).toHaveBeenCalledTimes(2);
});

test("a typed number that the owner does not take shows the value again after the commit", () => {
  render(<NumberField aria-label="Count" value={5} onValueChange={() => {}} onValueCommitted={() => {}} />);
  field().focus();
  fireEvent.change(field(), { target: { value: "30" } });
  fireEvent.keyDown(field(), { key: "Enter" });
  expect(field().value).toBe("5");
});

test("onValueCommitted gets each step of the arrow keys", () => {
  const committed = vi.fn();
  render(<NumberField aria-label="Count" value={5} min={1} max={20} onValueChange={() => {}} onValueCommitted={committed} />);
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  fireEvent.keyDown(field(), { key: "ArrowDown" });
  expect(committed.mock.calls.map(([n]) => n)).toEqual([6, 4]);
});

test("with stepFromValue, an arrow key steps from the value and drops a typed number; a step past a limit does nothing", () => {
  const committed = vi.fn();
  const change = vi.fn();
  const { rerender } = render(<NumberField aria-label="Count" value={3} min={1} max={20} stepFromValue onValueChange={change} onValueCommitted={committed} />);
  field().focus();
  fireEvent.change(field(), { target: { value: "7" } });
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  // The typed 7 does not count: the step is from 3.
  expect(committed.mock.calls.map(([n]) => n)).toEqual([4]);
  expect(change.mock.calls.map(([n]) => n)).toEqual([7]);
  expect([field().value, document.activeElement === field()]).toEqual(["3", true]);
  // The loss of the focus does not count the dropped number.
  field().blur();
  expect(committed).toHaveBeenCalledTimes(1);
  rerender(<NumberField aria-label="Count" value={20} min={1} max={20} stepFromValue onValueChange={change} onValueCommitted={committed} />);
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  expect(committed).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(field(), { key: "ArrowDown" });
  expect(committed.mock.calls.map(([n]) => n)).toEqual([4, 19]);
});

test("inputRef gives the input element", () => {
  const ref = createRef<HTMLInputElement>();
  render(<NumberField aria-label="Count" value={5} onValueChange={() => {}} inputRef={ref} />);
  expect(ref.current).toBe(field());
});
