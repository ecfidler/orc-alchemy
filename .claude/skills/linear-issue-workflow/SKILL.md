---
name: "linear-issue-workflow"
description: "Take a Linear issue from Todo to a reviewed, PR-ready branch. Use when asked to work on, implement, or complete a Linear issue (e.g. ORC-44)."
disable-model-invocation: false
version: "1.0.0"
---

## Orchestrator Introduction

- Your role is the orchestrator, it is your responsibility to understand the scope, acceptance criteria, and ambiguities of the issue.
- You will be tracking its progress in Linear and delegating tasks for subagents.
- The work should be in a new branch from up to date `master` formatted `<ISSUE-ID>-<kebab-case-description>` (ex. `ORC-44-setup-alchemy-monorepo`)

### Subagents

- Should run Opus on medium effort by default, review agents and large tasks can use high.
- Should receive a brief including the goal, the relevant files, constraints, what not to touch, and the shape of the summary to return.
- More specific instructions for what to return are better. (ex. ask for a list of changed files, one-line rationale each, and any open questions.)
- Subagents should run their own tests, lint, typechecking and verification with playwright if available.

### When to Stop

1. If progress on the issue is blocked.
2. If human input is required or outlined in the issue description.
3. If you need to deviate from the original scope or acceptance criteria. (ex. You discover that an assumption in the issue description is wrong in such a way that impacts scope)
4. If review hasn't converged after 2 rounds.

- Comment on the Linear issue with what's blocking and the options you see, then report back to me and end.
- Update the comment when the stop is resolved.

## Sequential Workflow

### Plan and Initial Development

1. Start by understanding the issue, move it to In Progress, and dispatch Explore agents as necessary.
    - If the issue is already In Progress or In Review, read its Linear comments and check for an existing branch and PR, then resume from the matching step instead of starting over.
2. When you have the full context, write the plan and delegate tasks to subagents as necessary.
    - If the issue is small enough (ex. all changes are in a single small file or single function), skip worker subagents and implement yourself.
    - Multiple worker subagents can be used when they can finish their tasks in parallel and not know what the others are doing.
    - Parallel workers must touch disjoint files; if that isn't possible, run them sequentially or give each its own git worktree.
    - Parallel workers in the main checkout leave changes uncommitted and the parent commits.
3. Run the full test, lint, and typecheck suite on the combined branch. The step is done when testing is green and no tasks are open.

### Review

1. Review Subagents should always be used, even if you decided on no subagents for the initial tasks.
2. Open a Pull Request as a draft for the issue if you have not already and update the Linear status to "In Review"
3. Run `/mattpocock-skills:code-review` passing the base branch to test against and the Linear issue as the spec.
    - If that skill is not available, do the following:
        - Spawn 2 review agents with the following tasks.
            - Standards: does the code conform to this repo's documented coding standards?
            - Spec: does the code faithfully implement the originating issue / spec?
4. When a review subagent returns, decide which findings are real, which are out of scope, and which conflict with the original intent, then dispatch fixes.
    - When the fixes are complete, run another round of review.
    - Limit this to 2 rounds; if the second review still returns real findings, stop (see When to Stop)
5. This step is done when a review round returns no findings you classified as real.

### Completion

1. Write the PR description.
2. Mark the PR as ready for merge.
3. Identify any follow-up tickets that may need to be created as a result of this session.
    - Create them in Linear linked to this issue.
4. Send the PR to me to review and approve.
