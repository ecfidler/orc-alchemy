import { Input } from "@base-ui/react/input";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Field, Fieldset } from "./Field.tsx";

afterEach(cleanup);

test("a fieldset is a group named by its legend", () => {
  render(
    <Fieldset legend="Speed">
      <label>
        Walk <input />
      </label>
    </Fieldset>,
  );
  const group = screen.getByRole("group", { name: "Speed" });
  expect(group.tagName).toBe("FIELDSET");
  expect(group.getAttribute("aria-labelledby")).toBe(screen.getByText("Speed").id);
});

test("label names the fieldset instead of the legend", () => {
  render(<Fieldset legend="Speed bonus" label="Speeds" />);
  expect(screen.getByRole("group", { name: "Speeds" }).hasAttribute("aria-labelledby")).toBe(false);
  expect(screen.getByText("Speed bonus")).toBeTruthy();
});

test("a field with no errors shows no list and is valid", () => {
  render(
    <Field label="Name" errors={[]}>
      <input aria-label="Name" />
    </Field>,
  );
  expect(screen.queryByRole("list")).toBeNull();
  expect(screen.getByRole("textbox").parentElement!.hasAttribute("data-invalid")).toBe(false);
});

test("a field's errors are a list named for the field, after its controls", () => {
  render(
    <Field label="Name" errors={["Name is required.", "Name must start with a letter."]}>
      <input aria-label="Name" />
    </Field>,
  );
  const list = screen.getByRole("list", { name: "Problems: Name" });
  expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Name is required.", "Name must start with a letter."]);
  expect(list.previousElementSibling).toBe(screen.getByRole("textbox"));
  expect(list.parentElement!.hasAttribute("data-invalid")).toBe(true);
});

test("a Base UI control in a field is described by the field's errors", () => {
  render(
    <Field label="Name" errors={["Name is required."]}>
      <Input aria-label="Name" />
    </Field>,
  );
  const list = screen.getByRole("list", { name: "Problems: Name" });
  expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(list.id);
});
