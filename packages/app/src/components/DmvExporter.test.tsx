import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, test } from "vitest";
import { DmvExporter } from "./DmvExporter.tsx";

afterEach(cleanup);

test("the bookmark link runs the exporter bookmarklet's source", () => {
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <DmvExporter /> }])} />);
  const href = screen.getByText("Export from Dungeon Master's Vault").getAttribute("href")!;
  expect(href.startsWith("javascript:")).toBe(true);
  const source = readFileSync(join(import.meta.dirname, "../../../../tools/exporter-bookmarklet/bookmarklet.js"), "utf8");
  expect(decodeURIComponent(href.slice("javascript:".length))).toBe(source);
  for (const link of screen.getAllByRole("link", { name: "Import page" })) expect(link.getAttribute("href")).toBe("/import");
});

test("the guide puts the homebrew before the characters, and covers unresolved content and the public link", () => {
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <DmvExporter /> }])} />);
  const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
  expect(headings).toEqual([
    "1. Export your homebrew from Dungeon Master's Vault",
    "2. Export your characters and magic items",
    "3. Import the homebrew first",
    "4. Then import the characters",
    "5. Check the sheets",
    "If a character has unresolved content",
    "Without the bookmark",
  ]);
});
