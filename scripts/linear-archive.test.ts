import { expect, test } from "bun:test";
import { archiveRoots, type Issue, type IssueRef, parseArgs, planArchive, toIssue } from "./linear-archive.ts";

const DONE = { name: "M9", statusType: "completed" };
const UPKEEP = { name: "Upkeep Q4", statusType: "started" };

function issue(identifier: string, over: Partial<Issue> = {}): Issue {
  return {
    identifier,
    uuid: `uuid-${identifier}`,
    title: identifier,
    stateType: "completed",
    stateName: "Done",
    archived: false,
    project: DONE,
    parent: null,
    children: [],
    moreChildren: false,
    ...over,
  };
}

const ref = (identifier: string, stateType = "completed", archived = false): IssueRef => ({ identifier, stateType, archived });
const ids = (issues: Issue[]) => issues.map((item) => item.identifier);
const ALL = { projects: [], only: null };

test("the list has the closed issues of closed projects only", () => {
  const plan = planArchive(
    [
      issue("ORC-1"),
      issue("ORC-2", { stateType: "canceled", stateName: "Canceled" }),
      issue("ORC-3", { stateType: "duplicate", stateName: "Duplicate" }),
      issue("ORC-4", { project: UPKEEP }),
      issue("ORC-5", { project: null }),
      issue("ORC-6", { stateType: "started", stateName: "In Progress" }),
    ],
    ALL,
  );
  expect(ids(plan.archive)).toEqual(["ORC-1", "ORC-2", "ORC-3"]);
  expect(plan.skip).toEqual([]);
});

test("--project adds the closed issues of an open project", () => {
  const plan = planArchive(
    [issue("ORC-1"), issue("ORC-4", { project: UPKEEP }), issue("ORC-6", { project: UPKEEP, stateType: "backlog", stateName: "Backlog" })],
    { projects: ["Upkeep Q4"], only: null },
  );
  expect(ids(plan.archive)).toEqual(["ORC-1", "ORC-4"]);
});

test("--only keeps the given ids, and reports the open and the unknown ones", () => {
  const plan = planArchive([issue("ORC-1"), issue("ORC-4", { project: UPKEEP }), issue("ORC-6", { stateType: "started", stateName: "In Progress" })], {
    projects: [],
    only: ["ORC-4", "ORC-6", "ORC-99"],
  });
  expect(ids(plan.archive)).toEqual(["ORC-4"]);
  expect(plan.skip.map((item) => [item.issue.identifier, item.reason])).toEqual([["ORC-6", "the issue is open (In Progress)"]]);
  expect(plan.unknown).toEqual(["ORC-99"]);
});

test("an issue with an open parent stays", () => {
  const plan = planArchive([issue("ORC-2", { parent: ref("ORC-1", "started") })], ALL);
  expect(plan.archive).toEqual([]);
  expect(plan.skip[0].reason).toBe("the parent ORC-1 is open");
});

test("a parent stays when a sub-issue is not in the list, and so does its own parent", () => {
  const top = issue("ORC-1", { children: [ref("ORC-2")] });
  const middle = issue("ORC-2", { parent: ref("ORC-1"), children: [ref("ORC-3"), ref("ORC-4", "completed", true)] });
  const leaf = issue("ORC-3", { parent: ref("ORC-2"), project: UPKEEP });
  const plan = planArchive([top, middle, leaf], ALL);
  expect(plan.archive).toEqual([]);
  expect(plan.skip.map((item) => [item.issue.identifier, item.reason])).toEqual([
    ["ORC-2", "the sub-issue ORC-3 is not in the list"],
    ["ORC-1", "the sub-issue ORC-2 is not in the list"],
  ]);
});

test("a family that is all in the list goes, and only the root is sent", () => {
  const top = issue("ORC-1", { children: [ref("ORC-2")] });
  const child = issue("ORC-2", { parent: ref("ORC-1") });
  const plan = planArchive([top, child, issue("ORC-7")], ALL);
  expect(ids(plan.archive)).toEqual(["ORC-1", "ORC-2", "ORC-7"]);
  expect(ids(archiveRoots(plan.archive))).toEqual(["ORC-1", "ORC-7"]);
});

test("an issue with more sub-issues than one page stays", () => {
  const plan = planArchive([issue("ORC-1", { moreChildren: true })], ALL);
  expect(plan.archive).toEqual([]);
});

test("parseArgs reads the flags", () => {
  expect(parseArgs([])).toEqual({ selection: ALL, team: "ORC", apply: false });
  expect(parseArgs(["--project", "A b", "--project", "C", "--only", "orc-1, ORC-2", "--team", "X", "--apply"])).toEqual({
    selection: { projects: ["A b", "C"], only: ["ORC-1", "ORC-2"] },
    team: "X",
    apply: true,
  });
  expect(() => parseArgs(["--aply"])).toThrow("unknown argument");
  expect(() => parseArgs(["--project"])).toThrow("needs a value");
});

test("toIssue reads an API issue", () => {
  const raw = {
    id: "u1",
    identifier: "ORC-2",
    title: "T",
    archivedAt: null,
    state: { name: "Done", type: "completed" },
    project: { name: "M9", status: { type: "completed" } },
    parent: { identifier: "ORC-1", archivedAt: "2026-01-01T00:00:00Z", state: { type: "completed" } },
    children: { nodes: [{ identifier: "ORC-3", archivedAt: null, state: { type: "started" } }], pageInfo: { hasNextPage: false } },
  };
  expect(toIssue(raw)).toEqual(issue("ORC-2", { uuid: "u1", title: "T", parent: ref("ORC-1", "completed", true), children: [ref("ORC-3", "started")] }));
});
