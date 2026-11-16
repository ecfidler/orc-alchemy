import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, test } from "vitest";
import { useConfirm } from "./AlertDialog.tsx";
import { Button } from "./Button.tsx";
import { Dialog } from "./Dialog.tsx";
import { ListModal } from "./ListModal.tsx";
import { answerConfirmDialog } from "./testing/index.ts";

afterEach(cleanup);

/** A button that opens a dialog with a text field and a list to add from. The dialog closes at once, or with `ask`, after a question. */
function Basket({ ask = false }: { ask?: boolean }) {
  const [open, setOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [closes, setCloses] = useState(0);
  const [confirm, confirmDialog] = useConfirm();
  const close = async () => {
    setCloses((n) => n + 1);
    if (!ask || (await confirm("Close the basket?", "Close", "Stay"))) setOpen(false);
  };
  return (
    <>
      <button onClick={() => setOpen(true)}>Open basket</button>
      <output>{closes}</output>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        title="A basket"
        actions={
          <Button variant="solid" onClick={() => setOpen(false)}>
            Save
          </Button>
        }
      >
        <label>
          Name <input />
        </label>
        <button onClick={() => setListOpen(true)}>Add a fruit</button>
        <ListModal open={listOpen} onOpenChange={setListOpen} title="Add a fruit" items={[{ value: "apple", label: "Apples" }]} onPick={() => {}} />
        {confirmDialog}
      </Dialog>
    </>
  );
}

const openBasket = async () => {
  const button = screen.getByRole("button", { name: "Open basket" });
  button.focus();
  fireEvent.click(button);
  return { button, dialog: await screen.findByRole("dialog", { name: "A basket" }) };
};
// The page is inert while the dialog is open, so the count is read without its role.
const closes = () => Number(document.querySelector("output")?.textContent);

test("the dialog has its title, the body, and Cancel then the actions in the footer; the focus goes to the first control", async () => {
  render(<Basket />);
  const { dialog } = await openBasket();
  expect(dialog.className).toBe("ui-modal");
  expect(dialog.querySelector(".ui-modal-body")?.contains(within(dialog).getByRole("textbox", { name: "Name" }))).toBe(true);
  const foot = dialog.querySelector<HTMLElement>(".ui-modal-foot")!;
  expect(
    within(foot)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Cancel", "Save"]);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Name" })));
});

test("Cancel and Escape ask the owner, which closes the dialog, and the focus goes back to the button that opened it", async () => {
  render(<Basket />);
  const { button, dialog } = await openBasket();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(closes()).toBe(1);
  await waitFor(() => expect(document.activeElement).toBe(button));

  const again = await openBasket();
  fireEvent.keyDown(again.dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(closes()).toBe(2);
});

test("the dialog stays open while the owner asks, and closes on the owner's yes", async () => {
  render(<Basket ask />);
  const { dialog } = await openBasket();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(await answerConfirmDialog("Stay")).toBe("Close the basket?");
  expect(screen.getByRole("dialog", { name: "A basket" })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await answerConfirmDialog("Close");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("a list modal opens above the dialog; Escape closes only the list, and the focus comes back into the dialog", async () => {
  render(<Basket />);
  const { dialog } = await openBasket();
  const add = within(dialog).getByRole("button", { name: "Add a fruit" });
  add.focus();
  fireEvent.click(add);
  const list = await screen.findByRole("dialog", { name: "Add a fruit" });
  // The list's portal comes after the dialog's, so it shows above it.
  expect(dialog.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.keyDown(list, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add a fruit" })).toBeNull());
  expect(screen.getByRole("dialog", { name: "A basket" })).toBeTruthy();
  expect(closes()).toBe(0);
  await waitFor(() => expect(document.activeElement).toBe(add));
});

test("finalFocus gives the focus to the element that it finds at the close", async () => {
  function Moving() {
    const [open, setOpen] = useState(false);
    const [saved, setSaved] = useState(false);
    const target = useRef<HTMLButtonElement>(null);
    return (
      <>
        {/* The button changes its name at the save, as an "Edit" button that a save makes. */}
        <button key={String(saved)} ref={target} onClick={() => setOpen(true)}>
          {saved ? "Edit" : "Make"}
        </button>
        <Dialog
          open={open}
          onOpenChange={setOpen}
          title="Make it"
          finalFocus={() => target.current}
          actions={
            <Button
              onClick={() => {
                setSaved(true);
                setOpen(false);
              }}
            >
              Save
            </Button>
          }
        >
          <input aria-label="Name" />
        </Dialog>
      </>
    );
  }
  render(<Moving />);
  fireEvent.click(screen.getByRole("button", { name: "Make" }));
  fireEvent.click(within(await screen.findByRole("dialog", { name: "Make it" })).getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" })));
});

test("a body that shows its controls after the dialog opens gives the focus to its first control, a button too", async () => {
  function Late() {
    const [open, setOpen] = useState(false);
    const [ready, setReady] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onOpenChange={setOpen} title="Late">
          {ready ? <button>First</button> : <p>Reading…</p>}
        </Dialog>
        {/* Outside the dialog, so the test can show the body's controls while the page is inert. */}
        <output hidden onClick={() => setReady(true)} />
      </>
    );
  }
  render(<Late />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("dialog", { name: "Late" });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
  fireEvent.click(document.querySelector("output")!);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "First" })));
});
