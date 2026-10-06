---
type: Agent Guide
title: "Issue tracker: Linear"
description: "How agents create, read, and update issues in the Linear team Orc Alchemy."
tags: [agents, linear]
status: stable
generated: { by: claude-code/agent, at: 2026-09-30T01:20:04Z }
---

# Issue tracker: Linear

Issues and specs for this repo live in Linear, team **Orc Alchemy**. Use the Linear MCP tools (`mcp__claude_ai_Linear__*`) for all operations; never the `gh` CLI.

## Conventions

- **Create an issue**: `save_issue` with `team: "Orc Alchemy"`, `project: "Alchemy 5e"`, `title`, `description` (Markdown, literal newlines), and `labels`.
- **Read an issue**: `get_issue` with the identifier (e.g. `ORC-42`), plus `list_comments` for the thread.
- **List issues**: `list_issues` with `team: "Orc Alchemy"` and `label` / `state` filters as needed.
- **Comment on an issue**: `save_comment`.
- **Apply / remove labels**: `save_issue` with `id` and `addLabels` / `removeLabels` (not `labels`, which replaces the whole set).
- **Close**: comment with the reason, then `save_issue` with `state: "Done"` (or `"Canceled"` for won't-do, `"Duplicate"` with `duplicateOf`).

Workflow states: Backlog → Todo → In Progress → In Review → Done (also Canceled, Duplicate).

Area labels also exist (Engine, Engine patch, App UI, Backend, Import/Export, Homebrew, Fixtures, Docs, CI, Decision) alongside type labels (Feature, Improvement, Bug). Apply the relevant ones when creating issues.

## When a skill says "publish to the issue tracker"

Create a Linear issue in the Orc Alchemy team, in the Alchemy 5e project.

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
