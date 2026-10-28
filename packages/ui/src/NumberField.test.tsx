import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
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
  for (const text of ["12", "", "7.9", "-3"]) fireEvent.change(field(), { target: { value: text } });
  expect(change.mock.calls.map(([n]) => n)).toEqual([12, null, 7, -3]);
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
  render(<NumberField aria-label="Gold" value={12000} onValueChange={() => {}} />);
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Gold" }).value).toBe("12000");
});

test("in a label, the label names the field", () => {
  render(
    <label>
      Speed <NumberField value={null} onValueChange={() => {}} />
    </label>,
  );
  expect(screen.getByLabelText<HTMLInputElement>("Speed").value).toBe("");
});
