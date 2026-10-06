---
type: Convention
title: How this project uses the Open Knowledge Format
description: The project rules for OKF v0.2 bundles, frontmatter, types, actors, links, indexes, and logs in orc-alchemy and the orcpub fork.
tags: [docs, okf, conventions]
status: stable
generated: { by: claude-code/agent, at: 2026-10-05T22:20:14Z }
sources:
  - id: okf-spec
    resource: https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md
    title: Open Knowledge Format specification, version 0.2
---

# Purpose

Project documentation follows the Open Knowledge Format (OKF), version
0.2.[^okf-spec] An OKF bundle is a directory of markdown files. Each file
starts with YAML frontmatter. People and agents can read the files without
special tools.

This document gives the project rules. Where the spec gives a choice, this
document makes the choice. Where this document says nothing, the spec
applies.

# Bundles

| Repository | Bundle root | Contents |
|---|---|---|
| `ecfidler/orc-alchemy` | `docs/` | All project knowledge: the plan, reports, the knowledge base, conventions, and agent guides. |
| `ecfidler/orcpub` | `docs/pubdoor/` | Fork-owned knowledge about the engine package and the fork. |

orc-alchemy is the home of project knowledge. If a new document describes
only the fork, put it in the fork bundle. Otherwise, put it in orc-alchemy.

## Files outside a bundle

These files do not get OKF frontmatter. They keep their own format.

- Root `README.md`, `CLAUDE.md`, and `CONTEXT.md` files. GitHub and agent
  tools read them as plain markdown.
- Package READMEs, for example `packages/app/README.md` and
  `engine-js/README.md`. npm shows frontmatter as text.
- `fixtures/README.md`. orc-alchemy keeps a copy of the fork file, and the
  copy must not change by hand.
- Skills under `.claude/skills/`. Skills have their own frontmatter.
- The upstream OrcPub and Dungeon Master's Vault documents in the fork. Do
  not edit them. The fork bundle lists them in
  `docs/pubdoor/doc-ownership.md`.

# Frontmatter

The spec requires only `type`. This project also requires `title`,
`description`, `status`, and `generated` on each concept document.

```yaml
---
type: Plan
title: "04: Homebrew"
description: One sentence that says what the document contains.
tags: [plan, homebrew]
status: stable
generated: { by: claude-code/agent, at: 2026-10-05T02:23:51Z }
---
```

| Key | Rule |
|---|---|
| `type` | Required. Use a value from the type list below. |
| `title` | Required. The display name. Use the H1 text or a short form of it. |
| `description` | Required. One sentence. Index files copy it. |
| `tags` | Recommended. Lowercase words joined by hyphens. Use an existing tag before you make a new one. |
| `status` | Required. `draft`, `stable`, or `deprecated`. |
| `generated` | Required. `by` is an actor. `at` is the UTC time of the last change to the meaning of the content. |
| `verified` | Optional. Only a person who checked the content against its sources adds it. |
| `sources` | Recommended for reports and knowledge base articles. Give each source an `id`. |
| `stale_after` | Optional. Use it for facts that expire, for example a version or a status. |
| `resource` | Optional. A URL for the thing that the document describes, for example a Linear project. |

Write every time in UTC with a `Z` suffix, for example
`2026-10-05T22:30:00Z`. Write `generated` on one line, as above.

The `title` key is the page title. Body sections can use `#` headings, as
the OKF spec examples do.

## When you edit a document

1. If you change the meaning of the content, set `generated.at` to the
   current UTC time and `generated.by` to your actor.
2. If you only fix a typo or a link, do not change `generated`.
3. Do not add `verified` for another person. Merging a pull request is not
   verification.
4. If the document is no longer current, set `status: deprecated`.
5. If other documents link to a deprecated document, do not delete it.

# Types

Use one of these values for `type`. If no value fits, add a new type to
this table in the same change.

| Type | Use it for | Diátaxis mode |
|---|---|---|
| `Plan` | One document of a plan set. | Explanation |
| `Plan Overview` | The README of a plan set. | Explanation |
| `Handoff` | The start point for an agent or a person who takes over a phase. | How-to |
| `Report` | An investigation with options and a decision. | Explanation |
| `Reference` | Facts for lookup, for example a rules delta. | Reference |
| `Convention` | A rule for how the project works, for example this document. | Reference |
| `Agent Guide` | Instructions that skills and agents read. | How-to |
| `Decision Record` | An ADR under `docs/adr/`. | Explanation |
| `How-to` | Steps to a goal. | How-to |
| `Notes` | Informal notes by a person. | None |

# Actors

`generated.by` and `verified[].by` use the OKF actor format.

- A person: `human:<github-login>`, for example `human:ecfidler`.
- A Claude Code agent: `claude-code/agent`. Do not put a model name in the
  actor. The repositories do not record model names, so the version part
  of the actor is `agent`. This is a deliberate difference from the spec
  example, which puts a model version there.
- An automated process: `process:<name>`, for example `process:ci`.

# Links

Use relative links, for example `[the plan](../plan/README.md)`. GitHub
resolves a link that starts with `/` from the repository root, not from the
bundle root. Thus bundle-absolute links break on GitHub.

Link to a file in the other repository with a full GitHub URL. Pin the URL
to a commit when the target can move.

# Index files

Each directory in a bundle has an `index.md` file.

- An `index.md` file has no frontmatter. The exception is the bundle root,
  which has `okf_version: "0.2"` and no other key.
- List each concept and each subdirectory in that directory, with the
  description from the frontmatter.
- When you add, move, or delete a document, update the index in the same
  change.

A `README.md` file in a bundle is a concept, not an index. It needs
frontmatter.

# Log files

Each bundle root has a `log.md` file. Add an entry when you add, deprecate,
or restructure documents. Do not add an entry for a small edit.

- Put the newest date first.
- Use `## YYYY-MM-DD` headings.
- Start each entry with a bold word: `**Creation**`, `**Update**`,
  `**Deprecation**`, or `**Initialization**`.
- Name the Linear issue in the entry.

# Check a bundle

In orc-alchemy, run this command from the repository root:

```bash
bun run docs:check
```

The check runs in CI. It fails when:

- A concept has no frontmatter, or misses a required key.
- `status` or a timestamp has a value that is not permitted.
- An `index.md` file has frontmatter that is not permitted, or does not
  link to each document and subdirectory in its directory.
- A `log.md` heading is not an ISO date.
- A relative link points to a file that does not exist.

The spec tells consumers to accept broken links. The check is stricter on
purpose: in this project, a broken link is a mistake.

[^okf-spec]: Open Knowledge Format specification, version 0.2
