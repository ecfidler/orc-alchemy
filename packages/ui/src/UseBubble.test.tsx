import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { UseBubble } from "./UseBubble.tsx";

afterEach(cleanup);

const bubble = () => document.querySelector(".ui-use-bubble")!;

test("a bubble has its title, a circle for each use, its text and its tag", () => {
  render(
    <UseBubble title="Lamp" tag="Each morning" uses={2}>
      Lights the room.
    </UseBubble>,
  );
  expect(screen.getByText("Lamp").className).toBe("ui-use-bubble-title");
  expect(screen.getByText("Lights the room.").className).toBe("ui-use-bubble-body");
  expect(screen.getByText("Each morning").className).toBe("ui-use-bubble-tag");
  expect(screen.getByRole("group", { name: "2 uses, 2 left" })).toBeTruthy();
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Use 1", "Use 2"]);
});

test("a click spends a use, a click on a spent circle gives it back, and with all spent the bubble is spent", () => {
  render(<UseBubble title="Lamp" uses={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Use 1" }));
  expect(screen.getByRole("group", { name: "2 uses, 1 left" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Use 1, spent" }).hasAttribute("data-spent")).toBe(true);
  expect(bubble().hasAttribute("data-spent")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Use 2" }));
  expect(screen.getByRole("group", { name: "2 uses, 0 left" })).toBeTruthy();
  expect(bubble().hasAttribute("data-spent")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Use 1, spent" }));
  expect(screen.getByRole("group", { name: "2 uses, 2 left" })).toBeTruthy();
  expect(bubble().hasAttribute("data-spent")).toBe(false);
});

test("a pool shows current / max, spends its step on a click, and fills again when empty", () => {
  render(<UseBubble title="Well" tag="Each week" pool={{ max: 10, step: 5 }} />);
  const pool = () => screen.getByRole("button", { name: /left\. Click to spend 5\.$/ });
  expect(pool().getAttribute("aria-label")).toBe("10 of 10 left. Click to spend 5.");
  expect(pool().textContent).toBe("10/ 10");
  fireEvent.click(pool());
  fireEvent.click(pool());
  expect(pool().getAttribute("aria-label")).toBe("0 of 10 left. Click to spend 5.");
  expect(bubble().hasAttribute("data-spent")).toBe(true);
  fireEvent.click(pool());
  expect(pool().getAttribute("aria-label")).toBe("10 of 10 left. Click to spend 5.");
});

test("nothing is stored: a new bubble starts with every use", () => {
  const { unmount } = render(<UseBubble title="Lamp" uses={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Use 1" }));
  unmount();
  render(<UseBubble title="Lamp" uses={1} />);
  expect(screen.getByRole("group", { name: "1 use, 1 left" })).toBeTruthy();
});
