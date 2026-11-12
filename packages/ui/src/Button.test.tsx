import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Button, ButtonLink, XButton } from "./Button.tsx";

afterEach(cleanup);

test("a button is a ghost button of type button by default, and calls onClick", () => {
  const click = vi.fn();
  render(<Button onClick={click}>Save</Button>);
  const button = screen.getByRole("button", { name: "Save" });
  expect([button.tagName, button.getAttribute("type"), button.dataset.variant, button.dataset.size, button.className]).toEqual([
    "BUTTON",
    "button",
    "ghost",
    "normal",
    "ui-button",
  ]);
  fireEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
});

test("variant, size, type and layout classes reach the element; a link button has no size", () => {
  render(
    <>
      <Button variant="solid" size="large" type="submit" className="w-full">
        Go
      </Button>
      <Button variant="link" size="small">
        More
      </Button>
    </>,
  );
  const go = screen.getByRole("button", { name: "Go" });
  expect([go.getAttribute("type"), go.dataset.variant, go.dataset.size, go.className]).toEqual(["submit", "solid", "large", "ui-button w-full"]);
  const more = screen.getByRole("button", { name: "More" });
  expect([more.dataset.variant, more.dataset.size]).toEqual(["link", undefined]);
});

test("a disabled button is disabled, marked, and takes no click", () => {
  const click = vi.fn();
  render(
    <Button disabled onClick={click}>
      Apply
    </Button>,
  );
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Apply" });
  expect(button.disabled).toBe(true);
  expect(button.hasAttribute("data-disabled")).toBe(true);
  fireEvent.click(button);
  expect(click).not.toHaveBeenCalled();
});

test("ARIA state and labels pass through", () => {
  render(
    <>
      <Button aria-expanded aria-label="More">
        More options
      </Button>
      <Button aria-current="step">Race</Button>
    </>,
  );
  expect(screen.getByRole("button", { name: "More" }).getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "Race" }).getAttribute("aria-current")).toBe("step");
});

test("a button link stays a link, with the button look", () => {
  render(
    <ButtonLink size="large" className="w-full" render={<a href="/import" className="ignored" />}>
      Import
    </ButtonLink>,
  );
  const link = screen.getByRole("link", { name: "Import" });
  expect([link.getAttribute("href"), link.className, link.dataset.variant, link.dataset.size]).toEqual(["/import", "ui-button w-full", "ghost", "large"]);
});

test("a wide button is marked wide, and a link button never is", () => {
  render(
    <>
      <Button wide>Add a row</Button>
      <Button variant="link" wide>
        More
      </Button>
    </>,
  );
  expect(screen.getByRole("button", { name: "Add a row" }).hasAttribute("data-wide")).toBe(true);
  expect(screen.getByRole("button", { name: "More" }).hasAttribute("data-wide")).toBe(false);
  expect(screen.getByRole("button", { name: "More" }).dataset.variant).toBe("link");
});

test("an X button has no text, is named by its aria-label, shows the name as its tooltip, and calls onClick", () => {
  const click = vi.fn();
  render(<XButton aria-label="Delete row 1" onClick={click} className="ml-auto" />);
  const button = screen.getByRole("button", { name: "Delete row 1" });
  expect([button.getAttribute("type"), button.textContent, button.title, button.className]).toEqual(["button", "", "Delete row 1", "ui-x-button ml-auto"]);
  fireEvent.click(button);
  expect(click).toHaveBeenCalledOnce();
});

test("a disabled X button takes no click", () => {
  const click = vi.fn();
  render(<XButton aria-label="Delete row 1" onClick={click} disabled />);
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Delete row 1" });
  fireEvent.click(button);
  expect([button.disabled, click.mock.calls.length]).toEqual([true, 0]);
});
