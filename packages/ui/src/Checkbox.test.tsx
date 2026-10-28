import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Checkbox } from "./Checkbox.tsx";

afterEach(cleanup);

function Strict({ disabled }: { disabled?: boolean }) {
  const [on, setOn] = useState(false);
  return <Checkbox label="Strict" checked={on} onCheckedChange={setOn} disabled={disabled} className="block" />;
}

test("a checkbox is named by its label, and a click on the box or the label checks it", () => {
  render(<Strict />);
  const box = screen.getByRole("checkbox", { name: "Strict" });
  expect([box.getAttribute("aria-checked"), box.className, box.closest("label")?.className]).toEqual(["false", "ui-check", "ui-check-label block"]);
  expect(box.querySelector(".ui-check-mark")).toBeNull();
  fireEvent.click(box);
  expect(box.getAttribute("aria-checked")).toBe("true");
  expect(box.querySelector(".ui-check-mark")).not.toBeNull();
  fireEvent.click(screen.getByText("Strict"));
  expect(box.getAttribute("aria-checked")).toBe("false");
});

test("Space checks a focused checkbox", () => {
  render(<Strict />);
  const box = screen.getByRole("checkbox", { name: "Strict" });
  box.focus();
  fireEvent.keyDown(box, { key: " " });
  fireEvent.keyUp(box, { key: " " });
  expect(box.getAttribute("aria-checked")).toBe("true");
});

test("a disabled checkbox is marked and takes no click", () => {
  render(<Strict disabled />);
  const box = screen.getByRole("checkbox", { name: "Strict" });
  expect([box.getAttribute("aria-disabled"), box.hasAttribute("data-disabled")]).toEqual(["true", true]);
  fireEvent.click(box);
  expect(box.getAttribute("aria-checked")).toBe("false");
});

test("with aria-label and no label, the box stands alone and takes the layout classes", () => {
  const change = vi.fn();
  render(<Checkbox aria-label="Select row: Apples" checked onCheckedChange={change} className="mx-auto" />);
  const box = screen.getByRole("checkbox", { name: "Select row: Apples" });
  expect([box.getAttribute("aria-checked"), box.className, box.closest("label")]).toEqual(["true", "ui-check mx-auto", null]);
  fireEvent.click(box);
  expect(change).toHaveBeenCalledWith(false);
});

test("name names the box instead of the label, which stays visible and still checks it", () => {
  const change = vi.fn();
  render(<Checkbox label="Wrap" name="Wrap long lines" checked={false} onCheckedChange={change} />);
  const box = screen.getByRole("checkbox", { name: "Wrap long lines" });
  fireEvent.click(screen.getByText("Wrap"));
  expect(change).toHaveBeenCalledWith(true);
  expect(box.closest("label")?.textContent).toBe("Wrap");
  expect(box.getAttribute("aria-label")).toBe("Wrap long lines");
});
