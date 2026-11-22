// Archives closed Linear issues through the GraphQL API (ORC-292).
//
//   bun scripts/linear-archive.ts [--project <name>]... [--only <ids>] [--team <key>] [--apply]
//
// The Linear screens and the Linear connector have no archive command, but
// the API has the mutation `issueArchive`. An archived issue does not count
// in the issue limit of the free plan. It keeps its comments and links, and
// `issueUnarchive` restores it.
//
// Without `--apply` the script makes a dry run: it prints the list and
// changes nothing. The API key comes from LINEAR_API_KEY. Bun reads it from
// `.env.local`, which git ignores.
//
// The list has each closed issue of each project that is Completed or
// Canceled. `--project` adds the closed issues of one more project, for
// example an upkeep project. `--only` keeps only the given ids in the list.

const API = "https://api.linear.app/graphql";
const ISSUE_LIMIT = 250;
const CLOSED = new Set(["completed", "canceled", "duplicate"]);
const CHILD_PAGE = 40;

export type IssueRef = { identifier: string; stateType: string; archived: boolean };

export type Issue = IssueRef & {
  uuid: string;
  title: string;
  stateName: string;
  project: { name: string; statusType: string } | null;
  parent: IssueRef | null;
  children: IssueRef[];
  moreChildren: boolean;
};

export type Selection = { projects: string[]; only: string[] | null };

export type Plan = { archive: Issue[]; skip: { issue: Issue; reason: string }[]; unknown: string[] };

const isClosed = (ref: IssueRef) => CLOSED.has(ref.stateType);

function inScope(issue: Issue, selection: Selection): boolean {
  if (selection.only) return selection.only.includes(issue.identifier);
  if (!isClosed(issue) || !issue.project) return false;
  return CLOSED.has(issue.project.statusType) || selection.projects.includes(issue.project.name);
}

// The reason an issue stays out of the list, when the reason does not depend on the other issues.
function ownReason(issue: Issue): string | null {
  if (!isClosed(issue)) return `the issue is open (${issue.stateName})`;
  if (issue.parent && !issue.parent.archived && !isClosed(issue.parent)) return `the parent ${issue.parent.identifier} is open`;
  if (issue.moreChildren) return `the issue has more than ${CHILD_PAGE} sub-issues`;
  return null;
}

// `issues` holds the issues of the team that are not archived.
export function planArchive(issues: Issue[], selection: Selection): Plan {
  const scoped = issues.filter((issue) => inScope(issue, selection));
  const skip: Plan["skip"] = [];
  let archive: Issue[] = [];
  for (const issue of scoped) {
    const reason = ownReason(issue);
    if (reason) skip.push({ issue, reason });
    else archive.push(issue);
  }

  // `issueArchive` also archives the sub-issues. Thus a parent goes in the
  // list only when each of its sub-issues is in the list too. A parent that
  // drops out can make its own parent drop out, so repeat until no change.
  for (let changed = true; changed; ) {
    changed = false;
    const listed = new Set(archive.map((issue) => issue.identifier));
    const kept: Issue[] = [];
    for (const issue of archive) {
      const loose = issue.children.find((child) => !child.archived && !listed.has(child.identifier));
      if (loose) {
        skip.push({ issue, reason: `the sub-issue ${loose.identifier} is not in the list` });
        changed = true;
      } else kept.push(issue);
    }
    archive = kept;
  }

  const known = new Set(issues.map((issue) => issue.identifier));
  const unknown = (selection.only ?? []).filter((id) => !known.has(id));
  return { archive, skip, unknown };
}

// The issues to send to `issueArchive`: a sub-issue goes with its parent.
export function archiveRoots(archive: Issue[]): Issue[] {
  const listed = new Set(archive.map((issue) => issue.identifier));
  return archive.filter((issue) => !(issue.parent && listed.has(issue.parent.identifier)));
}

export function parseArgs(argv: string[]): { selection: Selection; team: string; apply: boolean } {
  const selection: Selection = { projects: [], only: null };
  let team = "ORC";
  let apply = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value`);
      return next;
    };
    if (arg === "--apply") apply = true;
    else if (arg === "--project") selection.projects.push(value());
    else if (arg === "--team") team = value();
    else if (arg === "--only") {
      const ids = value()
        .split(",")
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean);
      selection.only = [...(selection.only ?? []), ...ids];
    } else throw new Error(`unknown argument: ${arg}`);
  }
  return { selection, team, apply };
}

export const ISSUES_QUERY = `
  query Issues($team: String!, $after: String) {
    issues(first: 50, after: $after, filter: { team: { key: { eq: $team } } }) {
      nodes {
        id
        identifier
        title
        archivedAt
        state { name type }
        project { name status { type } }
        parent { identifier archivedAt state { type } }
        children(first: ${CHILD_PAGE}) {
          nodes { identifier archivedAt state { type } }
          pageInfo { hasNextPage }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

export const ARCHIVE_MUTATION = `
  mutation Archive($id: String!) {
    issueArchive(id: $id) { success }
  }`;

type RawRef = { identifier: string; archivedAt: string | null; state: { type: string } };
type RawIssue = RawRef & {
  id: string;
  title: string;
  state: { name: string; type: string };
  project: { name: string; status: { type: string } } | null;
  parent: RawRef | null;
  children: { nodes: RawRef[]; pageInfo: { hasNextPage: boolean } };
};
type IssuesPage = { issues: { nodes: RawIssue[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } };

const toRef = (raw: RawRef): IssueRef => ({ identifier: raw.identifier, stateType: raw.state.type, archived: raw.archivedAt !== null });

export function toIssue(raw: RawIssue): Issue {
  return {
    ...toRef(raw),
    uuid: raw.id,
    title: raw.title,
    stateName: raw.state.name,
    project: raw.project ? { name: raw.project.name, statusType: raw.project.status.type } : null,
    parent: raw.parent ? toRef(raw.parent) : null,
    children: raw.children.nodes.map(toRef),
    moreChildren: raw.children.pageInfo.hasNextPage,
  };
}

async function request<T>(key: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: key },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json().catch(() => null)) as { data?: T; errors?: { message: string }[] } | null;
  if (body?.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!response.ok || !body?.data) throw new Error(`Linear answered ${response.status}`);
  return body.data;
}

// The issues of the team that are not archived.
async function fetchIssues(key: string, team: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  let after: string | null = null;
  do {
    const page: IssuesPage = await request<IssuesPage>(key, ISSUES_QUERY, { team, after });
    issues.push(...page.issues.nodes.filter((raw) => raw.archivedAt === null).map(toIssue));
    after = page.issues.pageInfo.hasNextPage ? page.issues.pageInfo.endCursor : null;
  } while (after);
  return issues;
}

const number = (issue: Issue) => Number(issue.identifier.split("-")[1]);
const byProjectThenNumber = (a: Issue, b: Issue) => (a.project?.name ?? "").localeCompare(b.project?.name ?? "") || number(a) - number(b);

function printPlan(plan: Plan, total: number): void {
  let project: string | undefined;
  for (const issue of [...plan.archive].sort(byProjectThenNumber)) {
    const name = issue.project?.name ?? "(no project)";
    if (name !== project) console.log(`\n${name}`);
    project = name;
    console.log(`  ${issue.identifier}  ${issue.stateName}  ${issue.title}`);
  }
  if (plan.skip.length) {
    console.log("\nNot in the list:");
    for (const { issue, reason } of plan.skip) console.log(`  ${issue.identifier}  ${reason}`);
  }
  if (plan.unknown.length) console.log(`\nNot found, or archived already: ${plan.unknown.join(", ")}`);
  console.log(`\nNot archived now: ${total}. To archive: ${plan.archive.length}. Then: ${total - plan.archive.length}. The limit is ${ISSUE_LIMIT}.`);
}

async function main(): Promise<void> {
  const { selection, team, apply } = parseArgs(process.argv.slice(2));
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY is not set. Put it in .env.local at the root of the repo.");

  const issues = await fetchIssues(key, team);
  const plan = planArchive(issues, selection);
  printPlan(plan, issues.length);
  if (!apply) {
    console.log("\nDry run: no change was made. Add --apply to archive the list.");
    return;
  }

  const send = async (issue: Issue) => {
    const data = await request<{ issueArchive: { success: boolean } }>(key, ARCHIVE_MUTATION, { id: issue.uuid });
    if (!data.issueArchive.success) throw new Error(`Linear did not archive ${issue.identifier}`);
    console.log(`archived ${issue.identifier}`);
  };
  console.log("");
  for (const issue of archiveRoots(plan.archive)) await send(issue);

  // A sub-issue goes with its parent. Send each one that stayed.
  const listed = new Set(plan.archive.map((issue) => issue.identifier));
  let after = await fetchIssues(key, team);
  const stayed = after.filter((issue) => listed.has(issue.identifier));
  for (const issue of stayed) await send(issue);
  if (stayed.length) after = await fetchIssues(key, team);
  console.log(`\nNot archived now: ${after.length}. The limit is ${ISSUE_LIMIT}.`);
}

if (import.meta.main) {
  main().catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
