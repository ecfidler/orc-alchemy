import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { Autocomplete } from "./Autocomplete.tsx";
import { pickOption } from "./testing/index.ts";

afterEach(cleanup);

function Folder() {
  const [value, setValue] = useState("");
  return (
    <label>
      Folder <Autocomplete value={value} onValueChange={setValue} suggestions={["Archive", "Arcade", "Notes"]} placeholder="Inbox" />
    </label>
  );
}

test("an autocomplete takes any text, and suggests the matching texts", async () => {
  render(<Folder />);
  const field = screen.getByRole("combobox", { name: "Folder" }) as HTMLInputElement;
  expect([field.className, field.placeholder]).toEqual(["ui-combobox", "Inbox"]);
  fireEvent.change(field, { target: { value: "Drafts" } });
  expect(field.value).toBe("Drafts");
  field.focus();
  fireEvent.keyDown(field, { key: "ArrowDown" });
  fireEvent.change(field, { target: { value: "Arc" } });
  await waitFor(() => expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Archive", "Arcade"]));
  fireEvent.keyDown(field, { key: "Escape" });
  await pickOption(field, "Notes");
  expect(field.value).toBe("Notes");
});
