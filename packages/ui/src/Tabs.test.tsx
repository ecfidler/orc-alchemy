import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Tabs } from "./Tabs.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // jsdom has no scrollIntoView; one test stubs it.
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

const tabs = [
  { value: "one", label: "One", color: "yellow" as const, content: <p>First</p> },
  { value: "two", label: "Two", color: "blue" as const, content: <p>Second</p> },
];

test("the first tab is open, each tab is a flag, and a click opens another tab", () => {
  render(<Tabs label="Sections" tabs={tabs} />);
  const [one, two] = screen.getAllByRole("tab");
  expect(screen.getByRole("tablist", { name: "Sections" })).toBeTruthy();
  expect([one.dataset.flag, two.dataset.flag]).toEqual(["yellow", "blue"]);
  expect(one.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("tabpanel").textContent).toBe("First");
  fireEvent.click(two);
  expect(screen.getByRole("tabpanel").textContent).toBe("Second");
  expect(screen.queryByText("First")).toBeNull();
});

test("a switch with the row stuck scrolls the page back to the tabs; a switch with the row in place does not", () => {
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  render(<Tabs label="Sections" tabs={tabs} />);
  const root = screen.getByRole("tablist").parentElement!;

  fireEvent.click(screen.getByRole("tab", { name: "Two" }));
  expect(scroll).not.toHaveBeenCalled();

  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ top: -300 } as DOMRect);
  fireEvent.click(screen.getByRole("tab", { name: "One" }));
  expect(scroll).toHaveBeenCalledWith({ block: "start" });
});
