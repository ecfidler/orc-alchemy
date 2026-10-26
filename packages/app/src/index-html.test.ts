import { readFileSync } from "node:fs";
import { join } from "node:path";
import { themeHeadScript } from "@orc-alchemy/ui";
import { expect, test } from "vitest";

const squash = (source: string) => source.replace(/\s+/g, " ").trim();

test("index.html carries the ui package's theme head script, before the app's module script", () => {
  const html = readFileSync(join(import.meta.dirname, "../index.html"), "utf8");
  const inline = /<script>([\s\S]*?)<\/script>/.exec(html);
  expect(squash(inline?.[1] ?? "")).toBe(squash(themeHeadScript));
  expect(html.indexOf("<script>")).toBeLessThan(html.indexOf('<script type="module"'));
});
