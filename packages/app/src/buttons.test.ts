import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// ORC-158: every button comes from @orc-alchemy/ui.
test("the app has no <button> element; its buttons are the package Button", () => {
  const files = readdirSync(import.meta.dirname, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));
  const native = files.filter((f) => /<button[\s>]/.test(readFileSync(join(import.meta.dirname, f), "utf8")));
  expect(native).toEqual([]);
});
