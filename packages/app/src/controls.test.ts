import { readdirSync, readFileSync } from "node:fs";
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
