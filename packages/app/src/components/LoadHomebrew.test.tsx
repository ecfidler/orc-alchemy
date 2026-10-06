import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useHomebrew } from "../state/homebrew.ts";
import { LoadHomebrew } from "./LoadHomebrew.tsx";

afterEach(() => {
  cleanup();
  useHomebrew.setState({ homebrew: undefined, lastImport: null });
});

const orcbrewDir = join(import.meta.dirname, "../../../../fixtures/orcbrew");

function choose(name: string, text: string) {
  fireEvent.change(screen.getByLabelText("Load homebrew file"), { target: { files: [new File([text], name)] } });
}

test("a chosen pack is listed with its import log, and Remove takes it out", async () => {
  render(<LoadHomebrew />);
  choose("warlock-test-content.orcbrew", readFileSync(join(orcbrewDir, "warlock-test-content.orcbrew"), "utf8"));

  const pack = await screen.findByRole("listitem", { name: "warlock-test-content" });
  const log = screen.getByRole("region", { name: "Last homebrew import" });
  expect(within(log).getByText(/^✅ Import successful/)).toBeTruthy();
  expect(within(log).getByText(/"imported-count": 3/)).toBeTruthy();

  fireEvent.click(within(pack).getByRole("button", { name: "Remove warlock-test-content" }));
  expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull();
});

test("a file that does not parse lists no pack and its log says why", async () => {
  render(<LoadHomebrew />);
  choose("broken.orcbrew", "{:orcpub.dnd.e5/spells {:fireball");

  const log = await screen.findByRole("region", { name: "Last homebrew import" });
  expect(within(log).getByText(/^⚠️ Could not read file/)).toBeTruthy();
  expect(within(log).getByText(/"parse-error": true/)).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull();
});
