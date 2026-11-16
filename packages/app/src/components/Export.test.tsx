// The export buttons (ORC-137): the warning about custom options shows only
// when an exported character has custom content.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { customizeOption } from "../engine/custom.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { fighter20 } from "../engine/test-feats.ts";
import { addCharacter, removeCharacter } from "../state/character.ts";
import { listCharacters } from "../storage/characters.ts";
import { ExportCharacter, ExportEverything } from "./Export.tsx";

const ONE = "This character has custom options. The old Dungeon Master's Vault cannot read them, so the character does not open there as it is.";
const ALL = "Some characters have custom options. The old Dungeon Master's Vault cannot read them, so those characters do not open there as they are.";

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

test("the export of a character with custom content downloads it and warns that the old app cannot read the custom options", async () => {
  const { entity, custom } = withCustomFeat();
  const id = await addCharacter(entity, "2014", null, custom);
  render(<ExportCharacter id={id} />);
  fireEvent.click(screen.getByRole("button", { name: "Export this character" }));
  expect(await screen.findByRole("note")).toHaveTextContent(ONE);
  expect(downloads).toEqual(["Ser Aldric.json"]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the export of a character without custom content shows no warning", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  render(<ExportCharacter id={id} />);
  fireEvent.click(screen.getByRole("button", { name: "Export this character" }));
  await vi.waitFor(() => expect(downloads).toEqual(["character.json"]));
  expect(screen.queryByRole("note")).toBeNull();
});

test("export everything warns when any character has custom content, and not otherwise", async () => {
  await addCharacter(engine().emptyCharacter(), "2014", null);
  const { unmount } = render(<ExportEverything />);
  fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
  await vi.waitFor(() => expect(downloads).toEqual(["dmv-export.json"]));
  expect(screen.queryByRole("note")).toBeNull();
  unmount();

  const { entity, custom } = withCustomFeat();
  await addCharacter(entity, "2014", null, custom);
  render(<ExportEverything />);
  fireEvent.click(screen.getByRole("button", { name: "Export everything" }));
  expect(await screen.findByRole("note")).toHaveTextContent(ALL);
});
