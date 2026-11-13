---
name: "milestone-workflow"
description: "Run a Linear milestone to done: order its issues, take each through linear-issue-workflow one merged PR at a time, then close the milestone. Use when asked to work on, finish, or pick up a milestone (e.g. M4)."
disable-model-invocation: false
version: "0.2.0"
---

Each issue goes through `linear-issue-workflow`. This skill owns what sits around it: the **run plan**, the **merge gate** between issues, and closing the milestone.

## 1. Orient

Read the Linear milestone and every open issue in it with its comments and relations, the milestone's **proof**, and its handoff in `docs/handoffs/` if one exists (it wins on state and order). The proof is the milestone's row in `docs/plan/06-milestones-and-risks.md`; when it has no row, the proof is the spec in `docs/design/` that the issues name.

PubDoor issues are worked in `ecfidler/orcpub`, and an engine build needs my machine. In a cloud session, ask at the start of the run for a separate Remote Control thread for each engine issue, and run the app issues while it works.

Done when you can name every open issue, its blockers, and its repo.

## 2. Plan the Run

- Order by blocking relations. The **finish line** (the issue the others block, ex. a publish) goes last; a decision-only issue goes first when later issues test against its outcome.
- Batch issues into one PR when they change the same files, when one's done-when runs through the other's test, or when they apply one change to different pages. Check every pair of neighbours in the order against this rule.
- Propose moving out an issue that says it can slip and that nothing in the milestone waits on. Move it on my word.

Done when the run plan (order, each batch or its absence with a reason, proposed moves) is posted in the thread. Start the first item at once.

## 3. Run Each Item

- The base branch is the milestone branch (`mN-<kebab-name>`) when one exists, else the repo's default branch. In this repo CI runs only on PRs into `main`, so on a milestone branch the full local suite is the only gate.
- Run `linear-issue-workflow` on the item. When the PR is ready, tell me what to know before merging: plan numbers that proved wrong, scope that moved, follow-ups filed.
- **Merge gate:** the next item starts after I merge the current PR.

Done when every item is Done in Linear.

## 4. Close the Milestone

1. If the base is a milestone branch, open the milestone PR into `main` and drive its CI green.
2. Check the proof claim by claim, naming the test that covers each. Report any claim with no test.
3. If the finish-line issue asks for an exit report, post it there.
4. After the merge, update project memory with the decisions and open follow-ups.

## Run State

In a project thread, keep the run state in project memory: one file for the milestone with the run plan and the open decisions, under 4 KB. Per-issue detail goes in the PR description and the Linear issue, where it does not fill the file.

## Stopping Mid-Milestone

In a session with no project memory, write a handoff at `docs/handoffs/<milestone-branch>.md`, modeled on `docs/handoffs/m3-homebrew-in-the-app.md`, and add it to `docs/handoffs/index.md`. Run `bun run docs:check`, then commit and push it straight to the base branch. A handoff needs no PR.
