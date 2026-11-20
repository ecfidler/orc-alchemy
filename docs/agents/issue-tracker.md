---
type: Agent Guide
title: "Issue tracker: Linear"
description: "How agents create, read, and update issues in the Linear team Orc Alchemy."
tags: [agents, linear]
status: stable
generated: { by: claude-code/agent, at: 2026-11-20T13:40:00Z }
---

# Issue tracker: Linear

Issues and specs for this repo live in Linear, team **Orc Alchemy**. Use the Linear MCP tools (`mcp__claude_ai_Linear__*`) for all operations; never the `gh` CLI.

## Conventions

- **Create an issue**: `save_issue` with `team: "Orc Alchemy"`, `project`, `title`, `description` (Markdown, literal newlines), and `labels`. For the project, see "Projects and milestones".
- **Read an issue**: `get_issue` with the identifier (e.g. `ORC-42`), plus `list_comments` for the thread.
- **List issues**: `list_issues` with `team: "Orc Alchemy"` and `label` / `state` filters as needed.
- **Comment on an issue**: `save_comment`.
- **Apply / remove labels**: `save_issue` with `id` and `addLabels` / `removeLabels` (not `labels`, which replaces the whole set).
- **Close**: comment with the reason, then `save_issue` with `state: "Done"` (or `"Canceled"` for won't-do, `"Duplicate"` with `duplicateOf`).
- **Make a sub-issue**: `save_issue` with `parentId: <parent>`.
- **How work closes**: through PRs. Linear moves an issue to `Done` when a PR that names the issue merges. If Linear does not move it, set `state: "Done"`.

Workflow states: Backlog → Todo → In Progress → In Review → Done (also Canceled, Duplicate).

Area labels also exist (Engine, Engine patch, App UI, Backend, Import/Export, Homebrew, Fixtures, Docs, CI, Decision) alongside type labels (Feature, Improvement, Bug). Apply the relevant ones when creating issues.

## Projects and milestones

Linear has no manual archive. It archives a closed issue (Done, Canceled or Duplicate) only after the project of the issue has the status Completed. The issue and the project must then stay unchanged for the auto-archive period of the team (1 month). The free plan has a limit on the number of issues that are not archived. Thus a closed issue in a project that does not end is counted for all time (ORC-278).

- **A product project** does not end: Alchemy 5e, PubDoor, 2024 engine, Demiplane. It holds the issues that are not part of a milestone.
- **A milestone is a project of its own.** Create it with `save_project`. The `name` is the milestone name, for example "M10 — Spells panel". Set `addTeams: ["Orc Alchemy"]`, and name the product in the `summary`. Do not create a Linear milestone inside a product project.
- **To find a milestone**, use `get_project` with the milestone name. An older milestone is a Linear milestone inside a product project (E1, E2, M6, M7): use `list_milestones` on the product project.
- **An issue of a milestone** goes in the milestone project. If a follow-up is found after the milestone project is Completed, put it in the product project.

### Close a milestone

Do these steps in this order, when all the work of the milestone is merged.

1. If the milestone is an older milestone, create a project with its name. Move each closed issue of the milestone into it: `save_issue` with `id` and `project`.
2. Move each open issue of the milestone to the product project.
3. Set the milestone project to Completed: `save_project` with `id` and `state: "completed"`. This is the last write.
4. After step 3, do not change the project or its issues. A change starts the auto-archive period again.

To find an issue of a finished milestone, look in the project with the name of the milestone. After the auto-archive period, the issue is in the archive: use `list_issues` with `includeArchived: true`.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the Orc Alchemy team. If the issue is part of a milestone, use the milestone project. If not, use the product project (Alchemy 5e for the app).

## When a skill says "fetch the relevant ticket"

`get_issue` + `list_comments` on the identifier.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map` holding the Notes / Decisions-so-far / Fog body. Create the `wayfinder:*` labels with `save_issue_label` the first time they're needed.
- **Child ticket**: a Linear sub-issue of the map (`save_issue` with `parentId: <map>`). Label `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, it's assigned to the driving dev.
- **Blocking**: Linear's native relations (`save_issue` with `blockedBy`). A ticket is unblocked when every blocker is Done/Canceled.
- **Frontier query**: `list_issues` with `parentId: <map>`, open states only; drop any with an open blocker or an assignee. First in map order wins.
- **Claim**: `save_issue` with `assignee: "me"`, the session's first write.
- **Resolve**: `save_comment` with the answer, `save_issue` with `state: "Done"`, then append a context pointer (gist + link) to the map's Decisions-so-far.
