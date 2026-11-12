import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { Field, FieldLabel } from "./Field.tsx";
import { TextArea, TextInput } from "./TextInput.tsx";

afterEach(cleanup);

test("a text input is a boxed textbox named by its label, and gives the whole text on each change", () => {
  const change = vi.fn();
  function Name() {
    const [value, setValue] = useState("Sea");
    return (
      <FieldLabel label="Name">
        <TextInput
          value={value}
          onValueChange={(next) => {
            change(next);
            setValue(next);
          }}
        />
      </FieldLabel>
    );
  }
  render(<Name />);
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });
  expect([input.className, input.dataset.width, input.value]).toEqual(["ui-input", "normal", "Sea"]);
  fireEvent.change(input, { target: { value: "Sea Legs" } });
  expect(change).toHaveBeenCalledWith("Sea Legs");
  expect(input.value).toBe("Sea Legs");
});

test("aria-label names a text input instead of its label; width and layout classes reach it", () => {
  render(
    <FieldLabel label="Name">
      <TextInput aria-label="Row 1 name" value="" onValueChange={() => {}} width="full" className="flex-1" />
    </FieldLabel>,
  );
  const input = screen.getByRole("textbox", { name: "Row 1 name" });
  expect([input.className, input.dataset.width]).toEqual(["ui-input flex-1", "full"]);
});

test("in a field with errors, a text input is described by them", () => {
  render(
    <Field label="Name" errors={["Name is required."]}>
      <FieldLabel label="Name">
        <TextInput value="" onValueChange={() => {}} />
      </FieldLabel>
    </Field>,
  );
  const list = screen.getByRole("list", { name: "Problems: Name" });
  expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("aria-describedby")).toBe(list.id);
});

test("a text area is a native textarea with its rows, and gives the whole text on each change", () => {
  const change = vi.fn();
  render(
    <FieldLabel label="Description">
      <TextArea value="At sea." onValueChange={change} rows={6} />
    </FieldLabel>,
  );
  const area = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Description" });
  expect([area.tagName, area.className, area.rows, area.value]).toEqual(["TEXTAREA", "ui-textarea", 6, "At sea."]);
  fireEvent.change(area, { target: { value: "On land." } });
  expect(change).toHaveBeenCalledWith("On land.");
});
