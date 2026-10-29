import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vitest";

const sources = readdirSync(import.meta.dirname, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."))
  .map((file) => ({ file, text: readFileSync(join(import.meta.dirname, file), "utf8") }));

// ORC-158: every button comes from @orc-alchemy/ui.
test("the app has no <button> element; its buttons are the package Button", () => {
  expect(sources.filter(({ text }) => /<button[\s>]/.test(text)).map(({ file }) => file)).toEqual([]);
});

test("the app imports no Base UI; its controls come from @orc-alchemy/ui", () => {
  expect(sources.filter(({ text }) => text.includes("@base-ui/react")).map(({ file }) => file)).toEqual([]);
});

// ORC-159: every fieldset comes from @orc-alchemy/ui.
test("the app has no <fieldset> element; its fieldsets are the package Fieldset", () => {
  expect(sources.filter(({ text }) => /<fieldset[\s>]/.test(text)).map(({ file }) => file)).toEqual([]);
});

// ORC-160: every on-or-off button is the package Toggle.
test("the app sets no aria-pressed; its on-or-off buttons are the package Toggle", () => {
  expect(sources.filter(({ text }) => text.includes("aria-pressed")).map(({ file }) => file)).toEqual([]);
});

// ORC-161: every checkbox and radio is the package Checkbox or Radio.
test("the app has no native checkbox or radio input", () => {
  expect(sources.filter(({ text }) => /type="(checkbox|radio)"/.test(text)).map(({ file }) => file)).toEqual([]);
});

// ORC-162: every number field is the package NumberField.
test("the app has no number input", () => {
  expect(sources.filter(({ text }) => text.includes('type="number"')).map(({ file }) => file)).toEqual([]);
});

// ORC-163: every confirmation is the package confirm dialog.
test("the app has no window.confirm; it asks with useConfirm", () => {
  expect(sources.filter(({ text }) => text.includes("window.confirm")).map(({ file }) => file)).toEqual([]);
});

// ORC-164: every pick is the package Select, Combobox, Menu or Autocomplete.
test("the app has no native select or datalist", () => {
  expect(sources.filter(({ text }) => /(^|[^"'\w])<(select|datalist)[\s>]/m.test(text)).map(({ file }) => file)).toEqual([]);
});

// ORC-170: every color is a role token; Tailwind's default colors are gone.
test("the app CSS removes Tailwind's default colors before the role tokens", () => {
  const css = readFileSync(join(import.meta.dirname, "index.css"), "utf8");
  expect(css.indexOf("--color-*: initial;")).toBeGreaterThan(css.indexOf('@import "tailwindcss";'));
  expect(css.indexOf("--color-*: initial;")).toBeLessThan(css.indexOf('@import "@orc-alchemy/ui/theme.css";'));
});

// The palette names come from the installed Tailwind, so a new palette is caught too.
const palette = [...readFileSync(createRequire(import.meta.url).resolve("tailwindcss/theme.css"), "utf8").matchAll(/--color-([a-z]+)-50:/g)]
  .map((match) => match[1])
  .join("|");

test("the app uses no Tailwind default color class or arbitrary color", () => {
  const color = new RegExp(`\\b[a-z]+-(?:(?:${palette})-\\d{2,3}|black|white)\\b|-\\[(?:#|rgb|hsl|oklch|oklab|lab|lch|color)|--color-(?:${palette}|black|white)\\b`);
  const styles = readdirSync(import.meta.dirname, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".css"))
    .map((file) => ({ file, text: readFileSync(join(import.meta.dirname, file), "utf8") }));
  expect(palette).toContain("gray");
  expect([...sources, ...styles].filter(({ text }) => color.test(text)).map(({ file }) => file)).toEqual([]);
  expect(sources.filter(({ text }) => /style=\{\{[^}]*\b(?:color|background)/.test(text)).map(({ file }) => file)).toEqual([]);
});
