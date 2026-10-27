import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Radio, RadioGroup } from "./Radio.tsx";

afterEach(cleanup);

function Size({ initial }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <RadioGroup aria-label="Size" value={value} onValueChange={setValue} className="space-y-1">
      <Radio value="small" label="Small" />
      <Radio value="large" label="Large" className="block" />
    </RadioGroup>
  );
}

const checked = () => screen.getAllByRole("radio").map((r) => r.getAttribute("aria-checked"));

test("a radio group is named; none is chosen until a click on a radio or its label", () => {
  render(<Size />);
  const group = screen.getByRole("radiogroup", { name: "Size" });
  expect(group.className).toBe("space-y-1");
  expect(checked()).toEqual(["false", "false"]);
  expect(screen.getByRole("radio", { name: "Large" }).closest("label")?.className).toBe("ui-check-label block");
  fireEvent.click(screen.getByRole("radio", { name: "Small" }));
  expect(checked()).toEqual(["true", "false"]);
  fireEvent.click(screen.getByText("Large"));
  expect(checked()).toEqual(["false", "true"]);
});

test("the arrow keys move the choice", async () => {
  render(<Size initial="small" />);
  const small = screen.getByRole("radio", { name: "Small" });
  small.focus();
  fireEvent.keyDown(small, { key: "ArrowDown" });
  await waitFor(() => expect(checked()).toEqual(["false", "true"]));
});
