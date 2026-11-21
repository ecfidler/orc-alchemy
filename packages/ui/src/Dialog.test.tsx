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

/** A button that opens a wide dialog with its own header, no footer, and the focus on a list button at the open. */
function Wide({ footer = false }: { footer?: boolean }) {
  const [open, setOpen] = useState(false);
  const pick = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open atlas</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="wide"
        title="Atlas"
        header={
          <>
            <h2>Atlas</h2>
            <p>Two maps</p>
          </>
        }
        footer={footer}
        initialFocus={pick}
      >
        <input aria-label="Search maps" />
        <button ref={pick}>North map</button>
      </Dialog>
    </>
  );
}

test("a wide dialog has the wide size, the owner's header and an X, no footer, and the focus on the owner's element", async () => {
  render(<Wide />);
  fireEvent.click(screen.getByRole("button", { name: "Open atlas" }));
  // The title names the dialog, and the owner's header shows in place of the title row.
  const dialog = await screen.findByRole("dialog", { name: "Atlas" });
  expect(dialog.dataset.size).toBe("wide");
  const head = dialog.querySelector<HTMLElement>(".ui-modal-head")!;
  expect(within(head).getByRole("heading", { name: "Atlas" })).toBeTruthy();
  expect(within(head).getByText("Two maps")).toBeTruthy();
  expect(head.lastElementChild).toBe(within(head).getByRole("button", { name: "Close" }));
  expect(dialog.querySelector(".ui-modal-foot")).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Cancel" })).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "North map" })));
});

test("a wide dialog closes with the X and with Escape, and the focus goes back to the button that opened it", async () => {
  render(<Wide />);
  const button = screen.getByRole("button", { name: "Open atlas" });
  button.focus();
  fireEvent.click(button);
  const dialog = await screen.findByRole("dialog", { name: "Atlas" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button));

  fireEvent.click(button);
  fireEvent.keyDown(await screen.findByRole("dialog", { name: "Atlas" }), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(button));
});

test("a wide dialog with a footer has Cancel and no X", async () => {
  render(<Wide footer />);
  fireEvent.click(screen.getByRole("button", { name: "Open atlas" }));
  const dialog = await screen.findByRole("dialog", { name: "Atlas" });
  expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
  expect(within(dialog.querySelector<HTMLElement>(".ui-modal-foot")!).getByRole("button", { name: "Cancel" })).toBeTruthy();
});

test("a wide dialog with an X and no initial focus gives the focus to the first control of the body, not to the X", async () => {
  function Plain() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onOpenChange={setOpen} size="wide" title="Plain" footer={false}>
          <p>Some text</p>
          <button>First</button>
        </Dialog>
      </>
    );
  }
  render(<Plain />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("dialog", { name: "Plain" });
  expect(within(dialog).getByRole("heading", { name: "Plain" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "First" })));
});

/** A wide dialog whose body shows its controls late, with an initial focus that gives `target`, or null. */
function LateWide({ toHeader }: { toHeader: boolean }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="wide"
        title="Late wide"
        header={<button ref={back}>Back</button>}
        initialFocus={() => (toHeader ? back.current : null)}
      >
        {ready ? <button>First</button> : <p>Reading…</p>}
      </Dialog>
      {/* Outside the dialog, so the test can show the body's controls while the page is inert. */}
      <output hidden onClick={() => setReady(true)} />
    </>
  );
}

test("an initial focus that gives null keeps the default: a control that the body shows later gets the focus", async () => {
  render(<LateWide toHeader={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("dialog", { name: "Late wide" });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.click(document.querySelector("output")!);
  await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "First" })));
});

test("an element that the initial focus gives keeps the focus when the body shows a control later", async () => {
  render(<LateWide toHeader />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  const dialog = await screen.findByRole("dialog", { name: "Late wide" });
  const back = within(dialog).getByRole("button", { name: "Back" });
  await waitFor(() => expect(document.activeElement).toBe(back));
  fireEvent.click(document.querySelector("output")!);
  await within(dialog).findByRole("button", { name: "First" });
  // Let the observer run.
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(document.activeElement).toBe(back);
});

test("a wide dialog with fill is marked for the full height, and a wide dialog without it is not", async () => {
  function Filled({ fill }: { fill: boolean }) {
    return (
      <Dialog open onOpenChange={() => {}} size="wide" title={fill ? "Filled" : "Plain"} footer={false} fill={fill}>
        <div>Two panes</div>
      </Dialog>
    );
  }
  render(<Filled fill />);
  const dialog = await screen.findByRole("dialog", { name: "Filled" });
  // The CSS gives a dialog with data-fill the window height, and a body with no padding and no scroll of its own.
  expect(dialog.hasAttribute("data-fill")).toBe(true);
  expect(within(dialog).getByText("Two panes").parentElement!.className).toBe("ui-modal-body");
  cleanup();
  render(<Filled fill={false} />);
  expect((await screen.findByRole("dialog", { name: "Plain" })).hasAttribute("data-fill")).toBe(false);
});

test("the types: a wide dialog with no footer takes no actions, and a normal dialog takes no header", () => {
  const close = () => {};
  // @ts-expect-error: no footer, so no actions.
  void (<Dialog open={false} onOpenChange={close} size="wide" title="T" footer={false} actions={<button>Save</button>} children={null} />);
  // @ts-expect-error: a header only with the wide size.
  void (<Dialog open={false} onOpenChange={close} title="T" header={<h2>T</h2>} children={null} />);
  void (<Dialog open={false} onOpenChange={close} size="wide" title="T" actions={<button>Save</button>} children={null} />);
  // @ts-expect-error: fill only with the wide size.
  void (<Dialog open={false} onOpenChange={close} title="T" fill children={null} />);
});
