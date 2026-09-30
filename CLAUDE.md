# orc-alchemy

A Bun-workspaces monorepo that owns the TypeScript projects built on the
Dungeon Master's Vault rules engine. Alchemy 5e, the app, is one workspace
package; the exporter bookmarklet and later the 2024 engine are siblings.

- **The plan is `docs/plan/`.** Plan Set 2 (`docs/plan/README.md`) is
  active; Plan Set 1 (`docs/plan/plan-set-1/`) is reference material it
  builds on. The docs were written in the fork, so "this fork" in them means
  `ecfidler/orcpub`. Doc 00 §Phase B describes this repo.
- **The engine is `@pubdoor/dmv`**, built and published from the
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
- **Current milestone: M2 — Local-first viewer.**

## Layout

```
package.json             private root; workspaces: packages/*, tools/*
tsconfig.base.json       shared compiler options; each package extends it
docs/plan/               the plan
fixtures/                engine fixtures snapshot from the fork
packages/app/            Alchemy 5e (ORC-91)
tools/exporter-bookmarklet/  M5
```

Run `bun install` once from the root. Each package owns its dependencies
and scripts.

## Agent skills

### Issue tracker

Issues live in Linear, team "Orc Alchemy", accessed via the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary; the labels already exist in Linear. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
