import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// The rules for the Playwright tests (ORC-360, ORC-362). CODING_STANDARDS.md says when a test is an e2e test.
const e2e = join(import.meta.dirname, "../e2e");
const specs = readdirSync(e2e, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => ({ file, text: readFileSync(join(e2e, file), "utf8") }));

const filesWith = (pattern: RegExp) => specs.filter(({ text }) => pattern.test(text)).map(({ file }) => file);

test("the e2e folder has spec files", () => {
  expect(specs.length).toBeGreaterThan(0);
});

// A screenshot for a PR is taken one time with a script outside the repository, and it goes to the project thread.
test("no e2e file takes a screenshot", () => {
  expect(filesWith(/\.screenshot\(|toHaveScreenshot\(|PR_SCREENSHOTS/)).toEqual([]);
});

// A test that an environment variable turns on does not run in CI, but each run pays for its setup.
test("no e2e test is skipped, focused or conditional on the environment", () => {
  expect(filesWith(/\b(test|describe|it)\.(skip|only|fixme)\b|(?<!")process\.env\./)).toEqual([]);
});
