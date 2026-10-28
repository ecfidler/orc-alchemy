import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { useConfirm } from "./AlertDialog.tsx";
import { answerConfirmDialog } from "./testing/index.ts";

afterEach(cleanup);

function Remove({ action }: { action?: string }) {
  const [confirm, dialog] = useConfirm();
  const [answers, setAnswers] = useState<boolean[]>([]);
  return (
    <>
      <button onClick={async () => setAnswers([...answers, await confirm("Remove the row? This cannot be undone.", action)])}>Remove</button>
      <output>{answers.join(",")}</output>
      {dialog}
    </>
  );
}

test("the dialog asks the question, and the action answers yes", async () => {
  render(<Remove action="Remove row" />);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Remove the row? This cannot be undone." });
  expect(dialog.className).toBe("ui-dialog");
  expect(await answerConfirmDialog("Remove row")).toBe("Remove the row? This cannot be undone.");
  expect(screen.getByRole("status").textContent).toBe("true");
});

test("Cancel answers no, and so does Escape", async () => {
  render(<Remove />);
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await answerConfirmDialog("Cancel");
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  fireEvent.keyDown(await screen.findByRole("alertdialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  expect(screen.getByRole("status").textContent).toBe("false,false");
});

test("the action is OK when no action is given, and Cancel has the focus", async () => {
  render(<Remove />);
  fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  await screen.findByRole("button", { name: "OK" });
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" })));
});

test("an unmount answers an open question with no", async () => {
  let answer: Promise<boolean> | undefined;
  function Asker() {
    const [confirm, dialog] = useConfirm();
    return (
      <>
        <button onClick={() => (answer = confirm("Go on?"))}>Ask</button>
        {dialog}
      </>
    );
  }
  const { unmount } = render(<Asker />);
  fireEvent.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("alertdialog");
  unmount();
  expect(await answer).toBe(false);
});
