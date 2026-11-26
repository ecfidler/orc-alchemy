import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Button } from "./Button.tsx";
import { ListModal } from "./ListModal.tsx";
import { SidePanel } from "./SidePanel.tsx";

afterEach(cleanup);

/** A button that opens a side panel with a long body and a list to add from. */
function Notes() {
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open the notes</Button>
      <SidePanel open={open} onOpenChange={setOpen} title="Notes">
        <p>The first note.</p>
        <Button onClick={() => setListOpen(true)}>Add a note</Button>
        <ListModal open={listOpen} onOpenChange={setListOpen} title="Add a note" items={[{ value: "a", label: "A note" }]} onPick={() => {}} />
      </SidePanel>
    </>
  );
}

const openNotes = async () => {
  const button = screen.getByRole("button", { name: "Open the notes" });
  button.focus();
  fireEvent.click(button);
  return { button, panel: await screen.findByRole("dialog", { name: "Notes" }) };
};

test("the panel has its title, a Close button and the body; the focus goes into the panel", async () => {
  render(<Notes />);
  const { panel } = await openNotes();
  expect(panel.className).toBe("ui-side-panel");
  expect(within(panel).getByRole("heading", { name: "Notes" })).toBeTruthy();
  expect(panel.querySelector(".ui-side-panel-body")?.textContent).toContain("The first note.");
  const close = within(panel).getByRole("button", { name: "Close" });
  await waitFor(() => expect(document.activeElement).toBe(close));
});

test("Close, Escape and a click outside close the panel, and the focus goes back to the button that opened it", async () => {
  render(<Notes />);
  const first = await openNotes();
  fireEvent.click(within(first.panel).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(first.button));

  const second = await openNotes();
  fireEvent.keyDown(second.panel, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(second.button));

  await openNotes();
  const backdrop = document.querySelector<HTMLElement>(".ui-list-backdrop")!;
  fireEvent.pointerDown(backdrop);
  fireEvent.mouseDown(backdrop);
  fireEvent.click(backdrop);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a list modal that the body opens shows above the panel, and Escape closes only the list", async () => {
  render(<Notes />);
  const { panel } = await openNotes();
  fireEvent.click(within(panel).getByRole("button", { name: "Add a note" }));
  const list = await screen.findByRole("dialog", { name: "Add a note" });
  fireEvent.keyDown(list, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a note" })).toBeNull());
  expect(screen.getByRole("dialog", { name: "Notes" })).toBeTruthy();
});
