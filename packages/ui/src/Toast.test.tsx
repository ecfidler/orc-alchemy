import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { TOAST_DURATION, Toast } from "./Toast.tsx";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const status = () => document.querySelector<HTMLElement>("[data-toast-status]")!;
const note = () => screen.getByRole("status", { name: "Test note" });
/** Lets the time pass. The fade at the end starts after the time, so a test waits for it in a second step. */
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** A page with a button that says a text, as an app says what an action did. */
function Page({ text = "5 damage.", withNote = false }: { text?: string; withNote?: boolean }) {
  const [said, setSaid] = useState({ text: "", key: 0 });
  const [shown, setShown] = useState(withNote);
  return (
    <>
      <button type="button" onClick={() => setSaid((last) => ({ text, key: last.key + 1 }))}>
        Act
      </button>
      <button type="button" onClick={() => setSaid((last) => ({ text: "Other text.", key: last.key + 1 }))}>
        Other
      </button>
      <Toast
        status={said.text}
        statusKey={said.key}
        noteName="Test note"
        note={shown ? { text: "Roll a save.", action: { label: "Dismiss", name: "Dismiss the test note", onClick: () => setShown(false) } } : null}
      />
    </>
  );
}

test("the status is a polite live region that is always there, and is empty until a text comes", () => {
  render(<Page />);
  expect(status().getAttribute("role")).toBe("status");
  expect(status().getAttribute("aria-live")).toBe("polite");
  expect(status().textContent).toBe("");
  // The toast is in a portal at the end of the body, out of the page layout.
  expect(status().closest(".ui-toast")?.parentElement).toBe(document.body);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  expect(status().textContent).toBe("5 damage.");
});

test("the status hides after the time, and not before", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  wait(TOAST_DURATION - 10);
  expect(status().textContent).toBe("5 damage.");
  wait(10);
  // The fade at the end: the text is still there.
  expect(status().querySelector("[data-leaving]")?.textContent).toBe("5 damage.");
  wait(200);
  expect(status().textContent).toBe("");
});

test("a new text replaces the old one and starts the time again", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  wait(4000);
  fireEvent.click(screen.getByRole("button", { name: "Other" }));
  expect(status().textContent).toBe("Other text.");
  wait(4000);
  expect(status().textContent).toBe("Other text.");
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
});

test("the same text twice shows again, as a new element, with a new time", () => {
  render(<Page />);
  const act = screen.getByRole("button", { name: "Act" });
  fireEvent.click(act);
  const first = status().firstElementChild;
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
  fireEvent.click(act);
  expect(status().textContent).toBe("5 damage.");
  wait(4000);
  fireEvent.click(act);
  const third = status().firstElementChild;
  // A new element, so that a screen reader says it again.
  expect(third).not.toBe(first);
  wait(4000);
  expect(status().textContent).toBe("5 damage.");
});

test("the status does not hide while the pointer is on the toast", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  const toast = status().closest<HTMLElement>(".ui-toast")!;
  fireEvent.pointerOver(status().firstElementChild!);
  wait(TOAST_DURATION * 3);
  expect(status().textContent).toBe("5 damage.");
  fireEvent.pointerOut(status().firstElementChild!, { relatedTarget: document.body });
  // The time starts again when the pointer leaves.
  wait(TOAST_DURATION - 10);
  expect(status().textContent).toBe("5 damage.");
  wait(10);
  wait(200);
  expect(status().textContent).toBe("");
  expect(toast.isConnected).toBe(true);
});

test("a click on the note's action that sends no pointerleave does not hold the next status", () => {
  render(<Page withNote />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  const dismiss = within(note()).getByRole("button", { name: "Dismiss the test note" });
  fireEvent.pointerOver(dismiss);
  // The click takes the note away from under the pointer, and no pointerleave comes.
  fireEvent.click(dismiss);
  expect(note().textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Other" }));
  expect(status().textContent).toBe("Other text.");
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
});

test("the status does not hide while the focus is on the toast", () => {
  render(<Page withNote />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  const dismiss = within(note()).getByRole("button", { name: "Dismiss the test note" });
  act(() => dismiss.focus());
  wait(TOAST_DURATION * 2);
  expect(status().textContent).toBe("5 damage.");
  act(() => screen.getByRole("button", { name: "Act" }).focus());
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
});

test("the note is a named status with its action; it stays after the time, and the action takes it away", () => {
  render(<Page withNote />);
  expect(note().getAttribute("aria-live")).toBe("polite");
  expect(note().textContent).toBe("Roll a save. Dismiss");
  wait(TOAST_DURATION * 2);
  expect(note().textContent).toBe("Roll a save. Dismiss");
  fireEvent.click(within(note()).getByRole("button", { name: "Dismiss the test note" }));
  expect(note().textContent).toBe("");
});

test("after the note's action, the focus goes back to where it was before it came into the toast", () => {
  render(<Page withNote />);
  const other = screen.getByRole("button", { name: "Other" });
  act(() => other.focus());
  const dismiss = within(note()).getByRole("button", { name: "Dismiss the test note" });
  act(() => dismiss.focus());
  fireEvent.click(dismiss);
  expect(document.activeElement).toBe(other);
  // The focus left the toast, so the status hides again with the time.
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
});

test("the X of the status hides it at once, and is out of the live region (ORC-372)", () => {
  render(<Page />);
  const other = screen.getByRole("button", { name: "Other" });
  act(() => other.focus());
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  const x = screen.getByRole("button", { name: "Dismiss the message" });
  // The text of the region is only the status, so a screen reader does not read the X with it.
  expect([status().textContent, status().contains(x)]).toEqual(["5 damage.", false]);
  act(() => x.focus());
  fireEvent.click(x);
  expect(status().textContent).toBe("");
  expect(screen.queryByRole("button", { name: "Dismiss the message" })).toBeNull();
  // The focus goes back to where it was before it came into the toast.
  expect(document.activeElement).toBe(other);
  // The next text shows again, with its X.
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  expect(status().textContent).toBe("5 damage.");
  expect(screen.getByRole("button", { name: "Dismiss the message" })).toBeTruthy();
});

test("an error status has the error tone, and a status has none (ORC-372)", () => {
  const { rerender } = render(<Toast status="The value is from 1 to 20." statusKey={1} tone="error" />);
  expect(status().dataset.tone).toBe("error");
  rerender(<Toast status="Short rest finished." statusKey={2} />);
  expect(status().dataset.tone).toBeUndefined();
});

test("a click on the X that sends no pointerleave does not hold the next status (ORC-372)", () => {
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Act" }));
  const x = screen.getByRole("button", { name: "Dismiss the message" });
  fireEvent.pointerOver(x);
  // The click takes the X away from under the pointer, and no pointerleave comes.
  fireEvent.click(x);
  fireEvent.click(screen.getByRole("button", { name: "Other" }));
  expect(status().textContent).toBe("Other text.");
  wait(TOAST_DURATION);
  wait(200);
  expect(status().textContent).toBe("");
});
