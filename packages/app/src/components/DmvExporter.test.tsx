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

test("the page has the same sections as the Markdown copy of the guide", () => {
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <DmvExporter /> }])} />);
  const markdown = readFileSync(join(import.meta.dirname, "../../../../docs/guides/moving-from-dungeon-masters-vault.md"), "utf8");
  const sections = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  expect(sections).toContain("Without the bookmark");
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(sections);
});
