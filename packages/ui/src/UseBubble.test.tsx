import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { UseBubble } from "./UseBubble.tsx";

afterEach(cleanup);

const bubble = (name: string) => screen.getByRole("group", { name });
const pressed = () => screen.getAllByRole("button").map((b) => b.getAttribute("aria-pressed"));

test("a bubble is a group named by its title, with a circle for each use, its text and its tag", () => {
  render(
    <UseBubble title="Lamp" tag="Each morning" uses={2}>
      Lights the room.
    </UseBubble>,
  );
  expect(bubble("Lamp").className).toBe("ui-use-bubble");
  expect(screen.getByText("Lights the room.").className).toBe("ui-use-bubble-body");
  expect(screen.getByText("Each morning").className).toBe("ui-use-bubble-tag");
  expect(bubble("2 uses, 2 left")).toBeTruthy();
  expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Use 1", "Use 2"]);
  expect(pressed()).toEqual(["false", "false"]);
});

test("a click spends a use, a click on a spent circle gives it back, and with all spent the bubble is spent", () => {
  render(<UseBubble title="Lamp" uses={2} />);
  fireEvent.click(screen.getByRole("button", { name: "Use 1" }));
  expect(bubble("2 uses, 1 left")).toBeTruthy();
  expect(pressed()).toEqual(["true", "false"]);
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Use 2" }));
  expect(bubble("2 uses, 0 left")).toBeTruthy();
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Use 1" }));
  expect(bubble("2 uses, 2 left")).toBeTruthy();
  expect(pressed()).toEqual(["false", "false"]);
  expect(bubble("Lamp").hasAttribute("data-spent")).toBe(false);
});

test("a pool shows current / max, spends its step on a click, and fills again when empty", () => {
  render(<UseBubble title="Well" tag="Each week" pool={{ max: 10, step: 5 }} />);
  const pool = () => screen.getByRole("button");
  expect(pool().getAttribute("aria-label")).toBe("10 / 10 left. Spend 5");
  expect(pool().textContent).toBe("10 / 10");
  fireEvent.click(pool());
  expect(pool().getAttribute("aria-label")).toBe("5 / 10 left. Spend 5");
  fireEvent.click(pool());
  expect(pool().getAttribute("aria-label")).toBe("0 / 10 left. Fill again");
  expect(bubble("Well").hasAttribute("data-spent")).toBe(true);
  fireEvent.click(pool());
  expect(pool().getAttribute("aria-label")).toBe("10 / 10 left. Spend 5");
});

test("nothing is stored: a new bubble starts with every use", () => {
  const { unmount } = render(<UseBubble title="Lamp" uses={1} />);
  fireEvent.click(screen.getByRole("button", { name: "Use 1" }));
  unmount();
  render(<UseBubble title="Lamp" uses={1} />);
  expect(bubble("1 use, 1 left")).toBeTruthy();
});
