import { readFileSync } from "node:fs";
import { join } from "node:path";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { expect, test } from "vitest";

// Builds the CSS the way an app does, so these tests see what the app gets.
const root = join(import.meta.dirname, "..");

async function build(candidates: string[]) {
  const compiler = await compile('@import "tailwindcss";\n@import "./theme.css";\n', { base: root, onDependency: () => {} });
  return { compiler, css: compiler.build(candidates) };
}

test("the role utilities map to the role tokens", async () => {
  const { css } = await build(["bg-paper", "text-ink", "border-rule-strong", "bg-note", "text-note-ink", "bg-panel", "font-sans"]);
  expect(css).toMatch(/\.bg-paper \{\s*background-color: var\(--paper\);/);
  expect(css).toMatch(/\.text-ink \{\s*color: var\(--ink\);/);
  expect(css).toMatch(/\.border-rule-strong \{[^}]*border-color: var\(--rule-strong\);/);
  expect(css).toMatch(/\.bg-panel \{\s*background-color: var\(--panel\);/);
  expect(css).toMatch(/\.font-sans \{\s*font-family: "Inter Variable"/);
});

test("dark: matches the stored override and the system mode", async () => {
  const { css } = await build(["dark:bg-paper"]);
  expect(css).toContain('.dark\\:bg-paper:where([data-theme="dark"], [data-theme="dark"] *) {');
  expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*\.dark\\:bg-paper:where\(:not\(\[data-theme="light"\], \[data-theme="light"\] \*\)\)/);
});

test("theme.css registers the package's src folder as a source", async () => {
  const { compiler } = await build([]);
  const scanner = new Scanner({ sources: compiler.sources });
  const files = scanner.files.map((file) => file.replaceAll("\\", "/"));
  expect(files).toContain(join(root, "src/theme-preference.ts").replaceAll("\\", "/"));
});

test("the fonts are self-hosted", () => {
  const css = readFileSync(join(root, "theme.css"), "utf8");
  expect(css).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  expect(css).toContain('@import "@fontsource-variable/newsreader/opsz.css";');
  expect(css).toContain('@import "@fontsource-variable/inter/index.css";');
});
