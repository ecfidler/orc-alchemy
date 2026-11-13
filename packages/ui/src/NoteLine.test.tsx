import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { NoteLine } from "./NoteLine.tsx";

afterEach(cleanup);

test("a note line is readable text, with its action as a button at the end", () => {
  const act = vi.fn();
  render(<NoteLine action={{ label: "Use this", name: "Row 2: Use this", onClick: act }}>The list has a better order.</NoteLine>);
  const button = screen.getByRole("button", { name: "Row 2: Use this" });
  expect(button.textContent).toBe("Use this");
  expect(button.getAttribute("type")).toBe("button");
  const line = button.closest("p")!;
  expect(line.className).toBe("ui-note-line");
  expect(line.textContent).toBe("The list has a better order. Use this");
  fireEvent.click(button);
  expect(act).toHaveBeenCalledOnce();
});

test("a note line with no action has no button, and the label names a button with no name", () => {
  const { rerender } = render(<NoteLine>Nothing to do.</NoteLine>);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("Nothing to do.").className).toBe("ui-note-line");
  rerender(<NoteLine action={{ label: "Apply", onClick: () => {} }}>Text.</NoteLine>);
  expect(screen.getByRole("button", { name: "Apply" })).toBeTruthy();
});
