# orc-alchemy

A Bun-workspaces monorepo that owns the TypeScript projects built on the
Dungeon Master's Vault rules engine. Alchemy 5e, the app, is one workspace
package; the exporter bookmarklet and the 2024 engine are siblings.

You are the owner and long-term maintainer of this codebase, and its design is up to you.

- **The plan is `docs/plan/`.** Plan Set 2 (`docs/plan/README.md`) is
  active; Plan Set 1 (`docs/plan/plan-set-1/`) is reference material it
  builds on. The docs were written in the fork, so "this fork" in them means
  `ecfidler/orcpub`. Doc 00 §Phase B describes this repo.
- **2024 rules come later, from a separate TypeScript engine.**
  `docs/reports/2024-rules-support.md` §Decision records option E:
  `@pubdoor/dmv` serves 2014 only. Read it before any work on rules
  editions, the `rules` tag, or 2024 content. `docs/kb/srd-5.2-rules-delta.md`
  holds the rules facts it relies on.
- **The 2024 engine is `packages/engine`.** Its spec is
  `docs/design/2024-engine.md`, and the spec of its content is
  `docs/design/2024-content-format.md`. Linear project *2024 engine* tracks
  the work.
- **The 2014 engine is `@pubdoor/dmv`**, built and published from the
  `ecfidler/orcpub` fork under `engine-js/`. The fork is also the test
  oracle: expected values come from it, via `fixtures/`.
- **Never import Clojure or the engine source.** Consume the published
  package at an exact version pin.
- **`fixtures/` is a snapshot** of the fork's `fixtures/`, with the source
  commit and engine version recorded in `fixtures/README.md`. Do not
  hand-edit it; regenerate in the fork and re-copy.
- **Tracker:** Linear, workspace *Orc Alchemy*, project
  [Alchemy 5e](https://linear.app/orc-alchemy/project/alchemy-5e-9db66f3ef51e).
  Name the issue (`ORC-nn`) in each commit or PR.
- **`docs/` is an Open Knowledge Format (OKF) v0.2 bundle.** Each document
  has YAML frontmatter, and each directory has an `index.md`. Before you
  add, move, or change a document, read `docs/conventions/okf-profile.md`.
  After the change, run `bun run docs:check`. CI runs the same check.
- **Write to the project writing standard**, `docs/conventions/writing-standard.md`:
  ASD-STE100 Simplified Technical English at about 80 percent. Apply it to
  docs, PR bodies, commit messages, and Linear issues.

## Layout

```
package.json             private root; workspaces: packages/*, tools/*
tsconfig.base.json       shared compiler options; each package extends it
docs/                    OKF bundle: plan, reports, kb, conventions
docs/plan/               the plan
biome.json               formatter and linter config (ORC-213)
scripts/okf-check.ts     the docs bundle check
fixtures/                engine fixtures snapshot from the fork
packages/app/            Alchemy 5e (ORC-91)
packages/ui/             @orc-alchemy/ui: theme and controls (ORC-155)
packages/engine/         @orc-alchemy/engine: the 2024 engine (spec: docs/design/2024-engine.md)
tools/exporter-bookmarklet/  M5
```

Run `bun install` once from the root. Each package owns its dependencies
and scripts. From the root, `bun run format` formats the code and sorts
the imports, and `bun run lint` is the check that CI runs. `bun install`
also installs a pre-commit hook (`.husky/pre-commit`) that runs Biome on
the staged files and stages its fixes.

## Agent skills

The skills in `.claude/skills/` other than `impeccable`,
`linear-issue-workflow` and `milestone-workflow` are copies of
[mattpocock/skills](https://github.com/mattpocock/skills) at tag `v1.3.2`
(ORC-259). Do not edit the copies. To update them, copy the folders under
`skills/engineering/` and `skills/productivity/` from a newer tag.

`.claude/skills/impeccable/` and the `.claude/agents/impeccable-*.md` files
are a copy of the Claude Code build of
[pbakaus/impeccable](https://github.com/pbakaus/impeccable) at tag
`skill-v4.9.1` (ORC-260). Do not edit the copy. To update it, copy
`.claude/skills/impeccable/` and `.claude/agents/` from a newer `skill-v*`
tag. The skill is for design work on `packages/app` and `packages/ui`. On
its first use on a machine, its launcher downloads an engine binary from the
GitHub releases of that repository and checks the SHA-256 digest.

`.claude/settings.json` is the hook file of the same tag. It runs the
Impeccable design detector after each edit of a UI file and at the end of a
session. `/impeccable hooks off` stops it for the project.

### Issue tracker

Issues live in Linear, team "Orc Alchemy", accessed via the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary; the labels already exist in Linear. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
