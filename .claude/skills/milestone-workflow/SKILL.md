---
name: "milestone-workflow"
description: "Run a Linear milestone to done: order its issues, take each through linear-issue-workflow one merged PR at a time, then close the milestone. Use when asked to work on, finish, or pick up a milestone (e.g. M4)."
disable-model-invocation: false
version: "0.1.0"
---

Each issue goes through `linear-issue-workflow`. This skill owns what sits around it: the **run plan**, the **merge gate** between issues, and closing the milestone.

## 1. Orient

Read the `CLAUDE.md` milestone line, the milestone's **proof** in `docs/plan/06-milestones-and-risks.md`, its handoff in `docs/handoffs/` if one exists (it wins on state and order), and every open issue in the Linear milestone with its comments and relations. PubDoor issues are worked in `ecfidler/orcpub`.

Done when you can name every open issue, its blockers, and its repo.

## 2. Plan the Run

- Order by blocking relations. The **finish line** (the issue the others block, ex. a publish) goes last; a decision-only issue goes first when later issues test against its outcome.
- Batch issues into one PR when they change the same files or one's done-when runs through the other's test.
- Propose moving out an issue that says it can slip and that nothing in the milestone waits on. Move it on my word.

Done when the run plan (order, batches with reasons, proposed moves) is posted in the thread. Start the first item at once.

## 3. Run Each Item

- The base branch is the milestone branch (`mN-<kebab-name>`) when one exists, else the repo's default branch. In this repo CI runs only on PRs into `main`, so on a milestone branch the full local suite is the only gate.
- Run `linear-issue-workflow` on the item. When the PR is ready, tell me what to know before merging: plan numbers that proved wrong, scope that moved, follow-ups filed.
- **Merge gate:** the next item starts after I merge the current PR.

Done when every item is Done in Linear.

## 4. Close the Milestone

1. If the base is a milestone branch, open the milestone PR into `main` and drive its CI green.
2. Check the proof claim by claim, naming the test that covers each. Report any claim with no test.
3. If the finish-line issue asks for an exit report, post it there.
4. After the merge, move the `CLAUDE.md` milestone line to the next milestone, and update project memory with the decisions and open follow-ups.

## Stopping Mid-Milestone

Write a handoff at `docs/handoffs/<milestone-branch>.md`, modeled on `docs/handoffs/m3-homebrew-in-the-app.md`, and add it to `docs/handoffs/index.md`.
