---
name: "linear-issue-workflow"
description: "Take a Linear issue from Todo to a reviewed, PR-ready branch. Use when asked to work on, implement, or complete a Linear issue (e.g. ORC-44)."
disable-model-invocation: false
version: "1.2.0"
---

## Orchestrator Introduction

- Your role is the orchestrator, it is your responsibility to understand the scope, acceptance criteria, and ambiguities of the issue.
- You will be tracking its progress in Linear and delegating tasks for subagents.
- The work goes on a new branch from the up-to-date **base branch**, formatted `<ISSUE-ID>-<kebab-case-description>` (ex. `ORC-44-setup-alchemy-monorepo`), and its PR targets the base branch.
    - The base branch is `main` unless I name another, such as a milestone branch (ex. `m2-local-first-viewer`).
    - An issue is Done when its work merges into the base branch, a milestone branch included. Linear's GitHub integration sets Done when the PR merges; when it doesn't (ex. the work merged without its own PR), set Done yourself.

### Subagents

- Implementation goes to the `worker` agent; review goes to the `standards-reviewer` and `spec-reviewer` agents. Their definitions in `.claude/agents/` set the model, the effort, and the fixed part of each brief.
- Each brief carries the task-specific part: the goal, the relevant files, constraints, what not to touch, and the shape of the summary to return.
- More specific instructions for what to return are better. (ex. ask for a list of changed files, one-line rationale each, and any open questions.)

### When to Stop

1. If progress on the issue is blocked.
2. If human input is required or outlined in the issue description.
3. If you need to deviate from the original scope or acceptance criteria. (ex. You discover that an assumption in the issue description is wrong in such a way that impacts scope)
4. If review round 2 returns a blocking finding whose fix is more than a small, local change.

- Comment on the Linear issue with what's blocking and the options you see, then report back to me and end.
- Update the comment when the stop is resolved.

### Several Issues at Once

When I ask for several issues together, run this workflow for each issue.

- Give each issue's worker its own git worktree (`isolation: "worktree"`), with its branch cut from the base branch.
- Review each issue separately.
- Before asking me to merge, trial-merge the issue branches together and run the full checks on the result. This is done when the combined tree is green.

## Sequential Workflow

### Plan and Initial Development

1. Start by understanding the issue, move it to In Progress, and dispatch Explore agents as necessary.
    - If the issue is already In Progress or In Review, read its Linear comments and check for an existing branch and PR, then resume from the matching step instead of starting over.
2. When you have the full context, post the plan as a Linear comment: the approach, the files it touches, and the delegation choice with its reason (implement it yourself, or which workers and why). The step is done when the comment is posted.
3. Delegate tasks to subagents as the plan says.
    - If the issue is small enough (ex. all changes are in a single small file or single function), skip worker subagents and implement yourself.
    - Multiple worker subagents can be used when they can finish their tasks in parallel and not know what the others are doing.
    - Parallel workers must touch disjoint files; if that isn't possible, run them sequentially or give each its own git worktree.
    - Parallel workers in the main checkout leave changes uncommitted and the parent commits.
4. Run the full test, lint, and typecheck suite on the combined branch. The step is done when testing is green and no tasks are open.

### Review

1. Review Subagents should always be used, even if you decided on no subagents for the initial tasks.
2. Open a Pull Request as a draft against the base branch if you have not already and update the Linear status to "In Review"
3. Round 1: spawn a `standards-reviewer` and a `spec-reviewer` in parallel, after every worker has stopped. A worker's test runs and the reviewers' checks share the CPU, and slow tests then time out. Each brief gives:
    - the diff refs (`<base>...<issue-branch>`) and the commit list;
    - the worktree path, if the branch lives in one;
    - the check results from the last step;
    - for the `spec-reviewer`, the full issue text: description, done-when, and decisions recorded in its comments.
4. When a review subagent returns, decide which findings are real, which are out of scope, and which conflict with the original intent, then dispatch fixes and rerun the checks.
5. Round 2: resume the same two reviewers with `SendMessage`. Send the fix commit and your triage of every round-1 finding: fixed, or kept with its reason.
6. After round 2:
    - No real findings: review is done.
    - Real findings that are minor or have small, local fixes: fix them, rerun the checks, and say in the PR description that the round-2 fixes were not re-reviewed. Review is done.
    - A blocking finding whose fix is more than a small, local change: stop (see When to Stop).

### Completion

1. Write the PR description.
2. Mark the PR as ready for merge.
3. Identify any follow-up tickets that may need to be created as a result of this session.
    - Create them in Linear linked to this issue.
4. Send the PR to me to review and approve.
