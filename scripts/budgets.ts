// The budget check (ORC-362). budgets.json holds the limits, and CODING_STANDARDS.md, section "Budgets", gives the rules.
//
//   bun scripts/budgets.ts files               the tracked files: size, images, lines, the number of unit test files
//   bun scripts/budgets.ts staged              the same size and image rules, for the staged files (pre-commit)
//   bun scripts/budgets.ts bundle              the JavaScript of packages/app/dist (run the build first)
//   bun scripts/budgets.ts e2e                 the number of Playwright tests
//   bun scripts/budgets.ts unit-times <file>   the time of each test file in a Vitest JSON report
//
// A check that fails prints each problem and exits with 1. To allow more, change budgets.json in the same PR.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export type Budgets = {
  e2eTests: number;
  unitTestFiles: number;
  unitTestFileSeconds: number;
  bundleJsKB: number;
  sourceLines: { max: number; exceptions: Record<string, number> };
  fileKB: { max: number; exceptions: string[] };
  imageFolders: string[];
};

type NumberBudget = "e2eTests" | "unitTestFiles" | "unitTestFileSeconds" | "bundleJsKB";

const root = join(import.meta.dirname, "..");
const SOURCE = /^(packages\/[^/]+\/(src|e2e|golden)|tools|scripts)\/.*\.tsx?$/;
const UNIT_TEST = /^packages\/app\/src\/.*\.test\.tsx?$/;
const IMAGE = /\.(png|gif|jpe?g|webp|avif|bmp|tiff?|mp4|mov|webm)$/i;

/** The problems of the size and image rules for a list of files with their sizes in bytes. */
export function sizeProblems(files: { path: string; bytes: number }[], budgets: Budgets): string[] {
  const problems: string[] = [];
  for (const { path, bytes } of files) {
    if (IMAGE.test(path) && !budgets.imageFolders.some((folder) => path.startsWith(`${folder}/`)))
      problems.push(`${path}: an image outside ${budgets.imageFolders.join(", ")}. A screenshot goes to the project thread, not to the repository.`);
    const kb = Math.ceil(bytes / 1024);
    if (kb > budgets.fileKB.max && !budgets.fileKB.exceptions.includes(path))
      problems.push(`${path}: ${kb} KB, and the limit is ${budgets.fileKB.max} KB (fileKB).`);
  }
  return problems;
}

/** The problems of the line limit: a file is over the limit, or an exception is longer than its recorded length. */
export function lineProblems(files: { path: string; lines: number }[], budgets: Budgets): string[] {
  const { max, exceptions } = budgets.sourceLines;
  const problems: string[] = [];
  for (const { path, lines } of files) {
    const allowed = exceptions[path];
    if (allowed === undefined && lines > max) problems.push(`${path}: ${lines} lines, and the limit is ${max} (sourceLines.max). Split the file.`);
    if (allowed !== undefined && lines > allowed)
      problems.push(`${path}: ${lines} lines, and its exception allows ${allowed}. An exception can only become smaller.`);
  }
  for (const path of Object.keys(exceptions))
    if (!files.some((file) => file.path === path)) problems.push(`${path}: the file of this exception does not exist. Remove the exception.`);
  return problems;
}

/** The problem of a count or a size that is over its budget, if there is one. */
export function overBudget(name: NumberBudget, value: number, budgets: Budgets, unit = ""): string[] {
  const limit = budgets[name];
  return value > limit ? [`${name}: ${value}${unit}, and the budget is ${limit}${unit}.`] : [];
}

/** The test files of a Vitest JSON report that took longer than the budget. The time is from the first test to the last, without the imports. */
export function slowTestFiles(report: { testResults: { name: string; startTime: number; endTime: number }[] }, budgets: Budgets): string[] {
  return report.testResults
    .map((result) => ({ name: result.name, seconds: Math.round((result.endTime - result.startTime) / 1000) }))
    .filter(({ seconds }) => seconds > budgets.unitTestFileSeconds)
    .map(({ name, seconds }) => `${name}: ${seconds} s, and the budget for one test file is ${budgets.unitTestFileSeconds} s (unitTestFileSeconds).`);
}

const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((line) => line !== "");

function withSizes(paths: string[]) {
  return paths.filter((path) => existsSync(join(root, path))).map((path) => ({ path, bytes: statSync(join(root, path)).size }));
}

function run(mode: string, args: string[], budgets: Budgets): string[] {
  if (mode === "files") {
    const tracked = git("ls-files");
    const sources = tracked
      .filter((path) => SOURCE.test(path) && existsSync(join(root, path)))
      .map((path) => ({ path, lines: readFileSync(join(root, path), "utf8").split("\n").length - 1 }));
    return [
      ...sizeProblems(withSizes(tracked), budgets),
      ...lineProblems(sources, budgets),
      ...overBudget("unitTestFiles", tracked.filter((path) => UNIT_TEST.test(path)).length, budgets),
    ];
  }
  if (mode === "staged") return sizeProblems(withSizes(git("diff", "--cached", "--name-only", "--diff-filter=ACMR")), budgets);
  if (mode === "bundle") {
    const assets = join(root, "packages/app/dist/assets");
    const bytes = readdirSync(assets)
      .filter((file) => file.endsWith(".js"))
      .reduce((sum, file) => sum + statSync(join(assets, file)).size, 0);
    return overBudget("bundleJsKB", Math.ceil(bytes / 1024), budgets, " KB");
  }
  if (mode === "e2e") {
    const list = execFileSync("bunx", ["playwright", "test", "--list"], { cwd: join(root, "packages/app"), encoding: "utf8" });
    const total = /Total: (\d+) tests?/.exec(list);
    if (!total) return ["e2eTests: the list of Playwright has no total."];
    return overBudget("e2eTests", Number(total[1]), budgets);
  }
  if (mode === "unit-times") return args.flatMap((file) => slowTestFiles(JSON.parse(readFileSync(file, "utf8")), budgets));
  return [`Unknown mode "${mode}". The modes are files, staged, bundle, e2e and unit-times.`];
}

if (import.meta.main) {
  const [mode = "files", ...args] = process.argv.slice(2);
  const budgets: Budgets = JSON.parse(readFileSync(join(root, "budgets.json"), "utf8"));
  const problems = run(mode, args, budgets);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error(`\nbudgets ${mode}: ${problems.length} problem(s). CODING_STANDARDS.md, section "Budgets", says what to do.`);
    process.exit(1);
  }
  console.log(`budgets ${mode}: OK`);
}
