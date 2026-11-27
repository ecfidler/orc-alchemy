---
name: "project-workflow"
description: "Run a Linear project to done: order its issues, build them in slices of stacked PRs, then close the project. Use when asked to work on, finish, or pick up a project or one of its milestones (e.g. Spells panel, or an older name such as M9 or E1)."
disable-model-invocation: false
version: "0.6.0"
---

Each issue goes through `linear-issue-workflow`. This skill owns what sits around it: the **run plan**, the **slices**, and closing the project.

A **slice** is one to four issues that go in one PR, most often two to four. The PRs are stacked, and the work does not wait for a merge (ORC-291).

## 1. Orient

A project is one feature, and a milestone is a stage inside it. `docs/agents/issue-tracker.md`, section "Products, projects and milestones", gives the terms. Find the Linear project with `get_project` and its name. A project from before 2026-11-20 can have a number in its name or summary, for example "M9 — Homebrew forms": if the name is not found, use `list_projects` with `query`.

Read the Linear project and every open issue in it with its comments and relations, the project's **proof**, and the record of an earlier run if one exists: the file of the Linear project in project memory, or its handoff in `docs/handoffs/`. That record wins on state and order. The proof is the project's row in `docs/plan/06-milestones-and-risks.md`, which names it a milestone; when it has no row, the proof is the spec in `docs/design/` that the issues name. When I name one milestone of the project, run only the issues of that milestone.

PubDoor issues are worked in `ecfidler/orcpub`, and an engine build needs my machine. In a cloud session, ask at the start of the run for a separate Remote Control thread for each engine issue. While that thread works, run the app issues that do not wait on the engine. Engine issues are outside the slices.

Done when you can name every open issue, its blockers, and its repo.

## 2. Plan the Run

- Order by blocking relations. The **finish line** (the issue the others block, ex. a publish) goes last; a decision-only issue goes first when later issues test against its outcome.
- Cut the order into slices. A slice ends at a state that I can try in the app, or, for work with no UI, at a state that passes the full checks without the later issues. Issues go in the same slice when they change the same files, or when one's done-when runs through the other's test. A large issue is a slice of one.
- Propose moving out an issue that says it can slip and that nothing in the project waits on. Move it on my word.

Done when the run plan (order, the slices with the state each ends at, proposed moves) is posted in the thread. Start the first slice at once.

## 3. Run Each Slice

The base branch is the project branch (`<kebab-name>`) when one exists, else the repo's default branch.

1. **Branch.** The first slice uses the branch the session assigns, cut from the base branch. Each later slice gets `<session-branch>-<first issue id>` (ex. `claude/project-thread-k15ffd-orc-289`), cut from the branch of the slice before.
2. **Build.** Run `linear-issue-workflow` on each issue in order, one at a time, in its "Inside a Slice" form.
3. **Check.** Run lint, typecheck, and the test files that the slice changes. CI runs the full suite on the PR of the slice.
4. **Review.** Open the draft PR against the branch of the slice before (the first slice: the base branch). Name every issue ID of the slice in the title. Run one `standards-reviewer` on the diff of the slice, with the rounds of `linear-issue-workflow`, section "Review".
5. **Hand over.** Write the PR description and mark the PR ready. Then send me one message with:
    - the PR;
    - what to know before merging: plan numbers that proved wrong, scope that moved, follow-ups filed, and each issue that waits on a question;
    - when the slice changes the UI, its screenshots (section "Screenshots") and a short list of things to try in the app.
6. Start the next slice at once. Between PRs, progress goes only on the progress checklist of the thread, or on the to-do list of a session that has no thread.

### The merge

The slice PRs are a stack on GitHub, and I merge the stack one time (ORC-359). When I have reviewed the slices, I squash-merge the top PR. GitHub then lands each PR below it in the same operation.

- CI runs on each PR. Drive the CI of each slice green as soon as its PR is open, and again after each push. Do not wait for a merge.
- A fix to a slice goes on the branch of that slice. Then rebase each slice above it onto the slice below it (`git rebase --onto <slice below> <old tip of the slice below>`), and push each one with `--force-with-lease`.
- If I merge only a part of the stack, GitHub rebases the PRs that remain and points the lowest at the base branch. Do not rebase them or change a base by hand after a merge. Do these steps:
    1. Run `git fetch`.
    2. Move each local branch to its remote branch.
    3. Cherry-pick the work that you did not push.
- If the merge from the top PR does not land the stack, stop and tell me.

### Screenshots

- Light mode only, at desktop width only.
- Add a shot at 390 px only for an issue that changes the phone layout. Add a dark shot only for an issue that changes theme colors.
- One shot for each state that the issue adds or changes. No shot of a state that an earlier slice showed.
- Take the shots at the head of the slice, after the last review fix.
- Do not commit the test or script that takes the shots, and do not commit the images. Save the images in the project files and attach them in the thread.

### A question in the build

1. Put the question to me with `decision-rounds`.
2. Set the issue aside, with each issue that depends on it. Take its commit off the slice branch and keep it on `<slice branch>-<issue id>-wip`. Comment on the issue with the question; it stays In Progress.
3. Move those issues to a later slice, and say in the thread which issues wait.
4. Continue with the other issues. If the slice no longer ends at a state that I can try, say so in the hand-over.

When no issue is free, stop.

### Merge gate

When I ask for a merge gate, each issue is a slice of one, and the next issue starts after I merge the current PR.

Done when every issue is Done in Linear.

## 4. Close the Project

1. If the base is a project branch, open the PR of the project branch into `main` and drive its CI green.
2. Check the proof claim by claim, naming the test that covers each. Report any claim with no test.
3. If the finish-line issue asks for an exit report, post it there.
4. After the merge, update project memory with the decisions and open follow-ups. Cut the line of the project in the memory index to one sentence with a pointer to its file.
5. Last, close the Linear project with the steps in `docs/agents/issue-tracker.md`, section "Close a project".

Done when the Linear project is Completed.

## Run State

In a project thread, keep the run state in project memory: one file for the Linear project with the run plan, the branch and PR of each slice, and the open decisions, under 4 KB. Per-issue detail goes in the PR description and the Linear issue, where it does not fill the file.

## Stopping Mid-Project

In a session that is not a project thread, write a handoff at `docs/handoffs/<project-branch>.md`, modeled on `docs/handoffs/m3-homebrew-in-the-app.md`, and add it to `docs/handoffs/index.md`. Run `bun run docs:check`, then commit and push it straight to the base branch. A handoff needs no PR.
