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
  expect(screen.getByRole("link", { name: "Import page" }).getAttribute("href")).toBe("/import");
});
