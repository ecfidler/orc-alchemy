// The export buttons (ORC-137): an export of a character with custom content
// shows no warning, and a failed export in the list shows under the row.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { customizeOption } from "../engine/custom.ts";
import { loadEngine } from "../engine/engine.ts";
import { fighter20 } from "../engine/test-feats.ts";
import { addCharacter, removeCharacter } from "../state/character.ts";
import { listCharacters, write } from "../storage/characters.ts";
import { CharacterList } from "./CharacterList.tsx";
import { ExportCharacter, ExportEverything } from "./Export.tsx";

/** fighter-20 with a custom copy of his feat Grappler. */
function withCustomFeat() {
  const item = { "~:name": "Grappler (Custom)", "~:description": "You hold on tight.", "~:ability-increases": { "~#set": [] } };
  return customizeOption(fighter20(), undefined, { contentType: "orcpub.dnd.e5/feats", path: ["feats", "grappler"], item });
}

const downloads: string[] = [];

beforeAll(() => loadEngine());
beforeEach(() => {
  downloads.length = 0;
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:test", revokeObjectURL: () => {} });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const { id } of await listCharacters()) await removeCharacter(id);
});

test("the export of a character with custom content downloads it with no warning", async () => {
  const { entity, custom } = withCustomFeat();
  const id = await addCharacter(entity, "2014", null, custom);
  render(<ExportCharacter id={id} />);
  fireEvent.click(screen.getByRole("button", { name: "Export this character" }));
  await vi.waitFor(() => expect(downloads).toEqual(["Ser Aldric.json"]));
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("export everything with a character with custom content shows no warning", async () => {
  const { entity, custom } = withCustomFeat();
  await addCharacter(entity, "2014", null, custom);
  render(<ExportEverything />);
  fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
  await vi.waitFor(() => expect(downloads).toEqual(["dmv-export.json"]));
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("in the character list, a failed export shows on its own line under the row, not between its buttons", async () => {
  const id = await addCharacter(fighter20(), "2014", null);
  render(
    <MemoryRouter>
      <CharacterList />
    </MemoryRouter>,
  );
  const row = await screen.findByRole("listitem", { name: "Ser Aldric" });
  // The record goes and its summary stays, so the export fails.
  await write([{ store: "characters", delete: id }]);
  fireEvent.click(within(row).getByRole("button", { name: "Export Ser Aldric" }));
  const alert = await within(row).findByRole("alert");
  expect(alert).toHaveTextContent("The character is no longer stored");
  // The line is the row's last item, at the full width of the row, after Delete.
  expect(alert).toHaveClass("basis-full");
  expect(row.lastElementChild).toBe(alert);
  expect(downloads).toEqual([]);
  await removeCharacter(id); // its summary
});
