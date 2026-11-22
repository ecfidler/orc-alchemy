---
type: Agent Guide
title: "Issue tracker: Linear"
description: "How agents create, read, and update issues in the Linear team Orc Alchemy."
tags: [agents, linear]
status: stable
generated: { by: claude-code/agent, at: 2026-11-22T16:20:00Z }
---

# Issue tracker: Linear

Issues and specs for this repo live in Linear, team **Orc Alchemy**. Use the Linear MCP tools (`mcp__claude_ai_Linear__*`) for all operations; never the `gh` CLI.

## Conventions

- **Create an issue**: `save_issue` with `team: "Orc Alchemy"`, `project`, `title`, `description` (Markdown, literal newlines), and `labels`. For the project, see "Put an issue in a project".
- **Read an issue**: `get_issue` with the identifier (e.g. `ORC-42`), plus `list_comments` for the thread.
- **List issues**: `list_issues` with `team: "Orc Alchemy"` and `label` / `state` filters as needed.
- **Comment on an issue**: `save_comment`.
- **Apply / remove labels**: `save_issue` with `id` and `addLabels` / `removeLabels` (not `labels`, which replaces the whole set).
- **Close**: comment with the reason, then `save_issue` with `state: "Done"` (or `"Canceled"` for won't-do, `"Duplicate"` with `duplicateOf`).
- **Make a sub-issue**: `save_issue` with `parentId: <parent>`.
- **How work closes**: through PRs. Linear moves an issue to `Done` when a PR that names the issue merges. If Linear does not move it, set `state: "Done"`.

Workflow states: Backlog → Todo → In Progress → In Review → Done (also Canceled, Duplicate).

Area labels also exist (Engine, Engine patch, App UI, Backend, Import/Export, Homebrew, Fixtures, Docs, CI, Decision) alongside type labels (Feature, Improvement, Bug). Apply the relevant ones when creating issues.

## Products, projects and milestones

The terms have the same meaning as in Linear (ORC-279).

- **A product** is a Linear initiative: Alchemy 5e, PubDoor, 2024 engine, Demiplane. A product does not end.
- **A project** is one feature or deliverable, for example "Spells panel". It has a proof, and it ends with the status Completed. Before 2026-11-20, the docs named this a milestone (M9, E1).
- **A milestone** is a stage inside one project. The standard milestones are "Decisions" and "Build". "Decisions" holds the map, research, prototype and decision issues. "Build" holds the issues that the spec makes. A small project has no milestones.
- **An upkeep project** holds the bugs and follow-ups of one product that are not part of a feature. There is one for each product and each quarter, for example "Alchemy 5e upkeep 2026 Q4".

The free plan has a limit of 250 issues that are not archived. Linear archives a closed issue (Done, Canceled or Duplicate) by itself only after the project of the issue has the status Completed. The issue and the project must then stay unchanged for the auto-archive period of the team (1 month). Thus each project must end, and no issue stays outside a project (ORC-278).

The Linear app and the Linear MCP tools have no archive command, but the Linear API has one. `scripts/linear-archive.ts` archives closed issues at once (ORC-292). The `linear-cleanup` skill gives the steps. When the count comes near the limit, or when Linear refuses a new issue, use the skill.

### Create a project

1. Use `save_project` with `name`, `addTeams: ["Orc Alchemy"]`, `addInitiatives: ["<product>"]` and a `summary` that starts with the product name. The `name` is the name of the feature, with no number.
2. If the project has a decision stage, create the milestones with `save_milestone`: "Decisions", then "Build".
3. Set the `state` to show where the project is: `backlog`, `planned` or `started`.

The Linear tools cannot create an initiative. If `addInitiatives` fails, create the project without it and tell the owner.

### Put an issue in a project

- An issue of a feature goes in the project of the feature: `save_issue` with `project`. If the project has milestones, set `milestone` also.
- Other issues go in the upkeep project of the product for the current quarter. If it does not exist, create it as a project with the status `started`.
- A follow-up that is found after a project is Completed goes in the upkeep project.

### Close a project

Do these steps in this order, when all the work of the project is merged.

1. Move each open issue of the project to the upkeep project of the product.
2. Set the project to Completed: `save_project` with `id` and `state: "completed"`. This is the last write.
3. After step 2, do not change the project or its issues. A change starts the auto-archive period again.

Close an upkeep project the same way at the end of its quarter. Its open issues move to the upkeep project of the next quarter.

To find an issue of a finished project, look in the project. After a cleanup or the auto-archive period, the issue is in the archive: use `list_issues` with `includeArchived: true`. The projects that were Completed before 2026-11-20 keep their old names, for example "M9 — Homebrew forms".

Before 2026-11-20, each product was one project with a milestone for each feature. Those projects have new names: "Alchemy 5e upkeep 2026 Q4", "PubDoor upkeep 2026 Q4", "2024 engine build" (E1) and "Backend" (M6, product Demiplane). The old milestones that remain in them are empty. Do not put an issue in one.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the Orc Alchemy team, in the project that "Put an issue in a project" gives.

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
