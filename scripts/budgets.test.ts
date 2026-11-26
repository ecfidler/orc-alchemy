import { expect, test } from "bun:test";
import { type Budgets, lineProblems, overBudget, sizeProblems, slowTestFiles } from "./budgets";

const budgets: Budgets = {
  e2eTests: 400,
  unitTestFiles: 125,
  unitTestFileSeconds: 60,
  bundleJsKB: 4600,
  sourceLines: { max: 600, exceptions: { "packages/app/src/Big.tsx": 900 } },
  fileKB: { max: 500, exceptions: ["packages/engine/content/srd52.json"] },
  imageFolders: ["packages/app/public"],
};

test("an image is a problem outside the image folders, and not in them", () => {
  const problems = sizeProblems(
    [
      { path: "packages/app/public/logo.png", bytes: 2000 },
      { path: "packages/app/pr-screenshots/sheet.png", bytes: 2000 },
    ],
    budgets,
  );
  expect(problems).toHaveLength(1);
  expect(problems[0]).toStartWith("packages/app/pr-screenshots/sheet.png: an image outside packages/app/public.");
});

test("a file over the size limit is a problem, unless it is an exception", () => {
  const problems = sizeProblems(
    [
      { path: "packages/engine/content/srd52.json", bytes: 900 * 1024 },
      { path: "packages/app/src/data.json", bytes: 500 * 1024 },
      { path: "packages/app/src/large.json", bytes: 500 * 1024 + 1 },
    ],
    budgets,
  );
  expect(problems).toEqual(["packages/app/src/large.json: 501 KB, and the limit is 500 KB (fileKB)."]);
});

test("a file over the line limit is a problem", () => {
  const files = [
    { path: "packages/app/src/Big.tsx", lines: 900 },
    { path: "packages/app/src/Small.tsx", lines: 600 },
    { path: "packages/app/src/New.tsx", lines: 601 },
  ];
  expect(lineProblems(files, budgets)).toEqual(["packages/app/src/New.tsx: 601 lines, and the limit is 600 (sourceLines.max). Split the file."]);
});

test("an exception can become smaller, and it cannot grow", () => {
  expect(lineProblems([{ path: "packages/app/src/Big.tsx", lines: 850 }], budgets)).toEqual([]);
  expect(lineProblems([{ path: "packages/app/src/Big.tsx", lines: 901 }], budgets)).toEqual([
    "packages/app/src/Big.tsx: 901 lines, and its exception allows 900. An exception can only become smaller.",
  ]);
});

test("an exception for a file that does not exist is a problem", () => {
  expect(lineProblems([], budgets)).toEqual(["packages/app/src/Big.tsx: the file of this exception does not exist. Remove the exception."]);
});

test("a value at its budget passes, and a value over it is a problem", () => {
  expect(overBudget("e2eTests", 400, budgets)).toEqual([]);
  expect(overBudget("e2eTests", 401, budgets)).toEqual(["e2eTests: 401, and the budget is 400."]);
  expect(overBudget("bundleJsKB", 4700, budgets, " KB")).toEqual(["bundleJsKB: 4700 KB, and the budget is 4600 KB."]);
});

test("a test file that takes longer than the budget is a problem", () => {
  const report = {
    testResults: [
      { name: "/repo/packages/app/src/fast.test.ts", startTime: 1000, endTime: 61_000 },
      { name: "/repo/packages/app/src/slow.test.ts", startTime: 1000, endTime: 62_000 },
    ],
  };
  expect(slowTestFiles(report, budgets)).toEqual([
    "/repo/packages/app/src/slow.test.ts: 61 s, and the budget for one test file is 60 s (unitTestFileSeconds).",
  ]);
});
