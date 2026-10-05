---
type: Plan
title: "00: Repository strategy"
description: "Where the work happens: the engine is built and published from the fork, and the app is its own repository."
tags: [plan, repositories]
status: stable
generated: { by: claude-code/agent, at: 2026-10-05T02:18:10Z }
---

# 00: Repository strategy

This document says where the work happens and how the pieces are split
across repositories. The decision shapes M0 to M2 in doc 06 and replaces
the "vendor the engine source" arrangement that doc 02 originally described.

## Decision: split the work at the engine package boundary

The plan has two kinds of work with different toolchains:

- **Clojure work.** Capturing fixtures from the running old app, building
  the engine library with shadow-cljs, and the five small engine patches.
  This work needs a JVM, Leiningen, the Datomic transactor, and the old app
  itself.
- **TypeScript work.** The new application, its tests, and its backend.
  This work needs Node and nothing else.

So the split is:

| Phase | Where | What |
|---|---|---|
| A | This fork (`ecfidler/orcpub`), on the `engine` branch | M0 fixtures and the built-value dump script. The engine library at `engine-js/`: shadow-cljs build, facade, `.d.ts`, and golden tests. The engine patches as ordinary commits. Publishing `@pubdoor/dmv` |
| B | `ecfidler/orc-alchemy`, a Bun-workspaces monorepo that owns all the TypeScript projects | Everything from M2 onward: the app, local-first storage, homebrew UI, import tooling, and backend. It consumes `@pubdoor/dmv` from a package registry and never has a Clojure toolchain |

The engine package is the boundary because it is a build artifact with a
typed interface. The app repo depends on it exactly as it would on any npm
dependency, and the fork is the only place that can build it.

## What this changes in the other documents

- **Doc 02's original "Vendoring" section.** Superseded. That section is
  now "Where the engine is built". The engine source is not copied into the
  app repo. `engine-js/` sits in this fork beside `src/` and compiles
  against `../src/cljc` and the named `src/cljs` namespaces in place. The
  five patches are commits to this fork's own source. It is the user's
  fork, so there is no upstream copy to track a diff against. The exclusion
  list (`pdf_spec.cljc`, `character/random.cljc`, `char_decision_tree.cljc`,
  `templates/`) becomes shadow-cljs build configuration rather than a copy
  list.
- **Doc 06 milestones.** M0 and M1 happen in this fork. M2 onward happens
  in the app repo. M1's deliverable is a published package version, not a
  directory.
- **Plan Set 1 doc 03.** It already describes `engine-js/` in this repo.
  That layout is reused unchanged.

## Phase A: this fork

The work is on the `engine` branch, created from `develop`. M0 already
added `fixtures/` and `scripts/`. `fixtures/README.md` describes their
layout and the regeneration commands. M1 adds:

```
engine-js/
  shadow-cljs.edn          ; :esm target, :advanced; source-paths ["src" "../src/cljc" "../src/cljs"]
  src/orcpub/facade.cljs   ; the exported API (doc 02)
  package.json             ; name @pubdoor/dmv; publishes dist/ and types/
  types/index.d.ts         ; hand-written
  test/                    ; golden tests (vitest) against ../fixtures/
```

The Phase A decision review on 2026-09-20, where all 24 Phase A decisions
were approved, named the package `@dmv/pubdoor`. ORC-26 renamed it to
`@pubdoor/dmv` and publishes it to the public npm registry under the
`pubdoor` org. PubDoor is the project, and this package is its DMV engine.
A rename was needed either way, because the `dmv` GitHub account belongs
to someone else. GitHub Packages was rejected because its scope must match
the repository owner. Version the package with semver from `0.1.0`. Every
engine patch or facade addition bumps the version, and the app repo pins
exact versions. CI in this fork builds the package and runs the golden
tests on every push to `engine`.

Fixtures are generated here and copied to the app repo because generating
them needs the old app and consuming them does not. The app repo's tests
must stay self-contained, so it carries a snapshot under its own
`fixtures/` and a note of which fork commit produced it, and which
`@pubdoor/dmv` version that commit publishes. Refresh the snapshot in the
same change that bumps the engine pin.

## Phase B: the orc-alchemy monorepo

Phase B happens in `ecfidler/orc-alchemy`, a Bun-workspaces monorepo that
owns all the TypeScript projects. Alchemy 5e, the app, is one workspace
package. Other TypeScript packages, such as the exporter bookmarklet and
later the 2024 engine, are sibling workspaces. The plan itself lives here
too: it moved from the fork (ORC-101), which keeps only a stub pointing
here.

Create the app repository once `@pubdoor/dmv@0.1.x` exists with `evaluate`,
the mutations, `importCharacter`, and `parseOrcbrew`, that is, after M1 and
the engine half of M3. Its initial contents:

```
orc-alchemy/
  package.json             ; private root; workspaces: packages/*, tools/*
  tsconfig.base.json       ; shared compiler options that each package extends
  CLAUDE.md                ; see below
  docs/plan/               ; this plan set; Plan Set 1 under docs/plan/plan-set-1/
  fixtures/                ; snapshot from the fork, with the source commit recorded
  packages/app/            ; Alchemy 5e: Vite + React + TypeScript (Plan Set 1 doc 04 scaffold)
  packages/backend/        ; later (doc 05)
  tools/exporter-bookmarklet/  ; doc 03, M5
```

Each workspace package owns its dependencies and scripts; the root holds
only what every package shares. `bun install` runs once from the root.

`CLAUDE.md` in the monorepo states five things:

- The plan is `docs/plan/`, and Plan Set 2 is active.
- The engine comes from `@pubdoor/dmv`, built in the `ecfidler/orcpub` fork
  under `engine-js/`, which is also the test oracle.
- The current milestone.
- The app never imports Clojure or the engine source.
- Linear project Alchemy 5e is the tracker.

Update the current-milestone line as work progresses. "Implement the plan"
is too large a prompt for one session. "We're on M2" is the right size.

## Working with agents across the two repos

- The repo an agent edits must contain the spec it is implementing. That is
  why the plan lives in the monorepo's `docs/plan/` rather than behind a
  link to the fork.
- When a golden value is in doubt, regenerate it in the fork with the Phase
  A tooling and copy the fixture across. Do not hand-edit expected outputs
  in the app repo.
- A session can attach a second repository when it needs both, for example
  to add a facade function and use it. Most sessions need only one.
- Once Projects are available, one project that spans both repositories,
  with the plan in its instructions, fits this split: engine threads in the
  fork, app threads in `orc-alchemy`.

## Alternatives considered

- **A new repo from day one that vendors the engine source** (the original
  doc 02 text). This forces a Clojure toolchain into the app repo for the
  lifetime of the project and reimplements what this fork's build already
  does.
- **A monorepo inside this fork** (Plan Set 1's `web-ts/` layout). This is
  the least setup to start and a reasonable fallback, but it ties the new
  app's history to a Clojure project it will outgrow and makes upstream
  merges from `orcpub/orcpub` noisier. If Phase B ever seems premature,
  start the app under `web-ts/` here and extract it later. The engine
  package boundary makes that extraction mechanical.
