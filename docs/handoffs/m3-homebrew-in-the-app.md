---
type: Handoff
title: "M3 handoff: homebrew in the app"
description: "The starting point to finish M3 on Alchemy 5e: what is merged, the one open issue (ORC-54), the decisions so far, and the traps found on the way."
tags: [handoff, homebrew, milestones]
status: stable
generated: { by: claude-code/agent, at: 2026-10-06T03:55:00Z }
---

# M3 handoff: homebrew in the app

You are picking up M3 of project Alchemy 5e, *Homebrew in the app*. Four
of the five M3 issues are merged. One issue is open: ORC-54. After ORC-54
merges, open the milestone PR into `main`. This document gives the state of
the work, the next steps, the decisions so far, and the traps that cost
time in the last session.

## 1. Read these first

1. `CLAUDE.md` at the repository root. The current milestone line says M3.
2. Linear issue ORC-54, with its comments. One comment has notes from
   ORC-52 and ORC-106 for this issue.
3. [Doc 04, Homebrew](../plan/04-homebrew.md), §What the new app builds.
4. [Doc 03, Character import and storage](../plan/03-character-import-and-storage.md),
   for the `dmv-export` bundle.
5. `.claude/skills/linear-issue-workflow/SKILL.md`. The last session ran
   every issue through this skill.

## 2. State on 2026-10-06

**The engine.** The app pins `@pubdoor/dmv@0.2.0` exactly. `fixtures/` is a
snapshot of the fork at tag `pubdoor-v0.2.0`. The engine half of M3 is done
on project PubDoor.

**The branches.** The milestone branch is `m3-homebrew-in-the-app`, cut
from `main` after ORC-112. Each issue branch is cut from it, and each issue
PR targets it. The main checkout is on `m3-homebrew-in-the-app` at
`35a4c31`, with no local issue branches or worktrees.

| Issue | PR | Base | What it added |
|---|---|---|---|
| ORC-112 | #15 | `main` | The pin to 0.2.0, the fixture snapshot, and the M3 milestone line in `CLAUDE.md` |
| ORC-106 | #16 | milestone | The unresolved-key warnings on character import (`reconcileMissingContent`) |
| ORC-52 | #17 | milestone | The `.orcbrew` file picker (`LoadHomebrew`), the `useHomebrew` store, and the homebrew passed to `evaluate` |
| ORC-53 | #18 | milestone | The IndexedDB `packs` store (database version 2), the enabled and item flags, and quarantine |
| ORC-54 | none | milestone | Open. See §3 |

Linear sets an issue to Done when its PR merges into the milestone branch.
Check the status after each merge.

**The code map for homebrew.** All paths are under `packages/app/src/`.

| File | Job |
|---|---|
| `engine/engine.ts` | The only place that loads `@pubdoor/dmv`. `useEvaluation(entity, homebrew)` |
| `engine/import.ts` | `readCharacterFile(text, homebrew?)`. Each entry has `unresolved`. `exportBundle` writes `magicItems: []` and no homebrew yet |
| `state/homebrew.ts` | `useHomebrew`: `packs`, `quarantined`, `homebrew`, `lastImport`, and the actions. `restorePacks()` |
| `storage/packs.ts` | `PackRecord`, `savePacks`, `deletePack`, `listPacks` |
| `storage/characters.ts` | The database. Version 2. `useStorage` has `inMemory`, `failed`, and `outdated` |
| `components/LoadHomebrew.tsx` | The pack picker, the pack list with checkboxes, and the quarantine warning |
| `components/ImportCharacter.tsx` | Waits for `restorePacks()`. Calls `readCharacterFile(text)` with no homebrew |
| `components/Export.tsx` | `ExportEverything` writes `dmv-export.json` with characters only |

## 3. Next: ORC-54

ORC-54 is the proof of the milestone. Its done-when needs these parts:

1. **Pass the loaded packs to character import.** In `ImportCharacter.tsx`,
   call `readCharacterFile(text, useHomebrew.getState().homebrew)` after
   `restorePacks()`. Then a character imported after its pack shows no
   unresolved-key warning.
2. **Render the homebrew golden characters.** Import
   `duplicate-external-b.orcbrew`, then `ironwrought-artificer-3.strict.json`.
   Import `warlock-test-content.orcbrew`, then `warlock-10-drow.strict.json`.
   Each sheet must show the values in its `expected.json`, with no warning.
   Cover one of the two with a Playwright test, from the pack to the sheet
   values.
3. **Put homebrew in the export bundle.** "Export everything" adds the
   packs to the `dmv-export` bundle as `homebrew`, the multi-plugin map.
   It also writes a separate `all-content.orcbrew` through `orcbrewToEdn`.
4. **Restore packs from the bundle.** Importing the bundle restores the
   packs. Test that a bundle round-trips its packs and characters together.

Decide these points before you write the plan comment:

- **What the bundle holds.** Choose the full stored packs, or only the
  enabled packs without their disabled items. The flags (`enabled`,
  `disabledItems`) exist only in this app. If the bundle drops them, a
  round-trip turns disabled content on again.
- **The order on bundle import.** Restore the packs first, then import the
  characters against them, so that they show no false warnings. Read
  `readCharacterFile`: it reads characters only, so the packs need a new
  path, probably through `useHomebrew.load` or a new action.
- **Quarantine on bundle import.** A bundle pack with the name of a
  quarantined record must be refused, as `load` refuses it now.
- **`validateForExport` before `orcbrewToEdn`.** The engine docs say to run
  it first. Decide what the UI does when a pack is not valid. The full
  export UI is ORC-73 (M5), so keep this minimal.

## 4. After ORC-54: close M3

1. Open the milestone PR from `m3-homebrew-in-the-app` into `main`. CI runs
   only on PRs into `main` and on pushes to `main`, so this PR is the first
   CI run for M3.
2. Check the milestone proof in Linear: both `duplicate-external` packs and
   the community packs import, and the two homebrew golden characters
   render identically.
3. After the merge, set the `CLAUDE.md` milestone line to M4, in a change on
   `main`.

## 5. Decisions made in M3

- **The quarantine check is `buildTemplate`, not `validateForExport`.** The
  old export spec can fail packs that the progressive import accepted.
  `restorePacks` builds all packs at once. If that build throws, it adds the
  packs one at a time in name order and quarantines each pack that breaks
  the build.
- **No packs is `undefined`, never `{}`.** The engine caches its last
  evaluation and its template on the JSON text of the homebrew. A change
  between `{}` and no homebrew builds the template again.
- **Packs are sorted by name.** The homebrew is then the same before and
  after a reload.
- **The store actions run one at a time** on one promise chain in
  `useHomebrew`. A change that changes nothing keeps the same `homebrew`
  object.
- **A single imported character with unresolved keys does not open its
  sheet at once.** It stays on the import list, with its keys and a button
  to open the sheet. The label "Option" marks the entries from
  `unresolvedOptions`.
- **There is no UI for item flags.** `setItemEnabled` exists and has tests.
  The UI is the My Content page, ORC-72 (M5).
- **Stored summaries are not rebuilt when packs change.** This is ORC-115,
  which needs triage.

## 6. Traps

- **Parallel workers and Playwright.** `playwright.config.ts` uses port
  4173 with `reuseExistingServer`. Two workers that run e2e at the same time
  test each other's build. Give each worker an untracked
  `playwright.port.config.ts` with its own port, and delete it before the
  commit.
- **`gh pr edit` fails** with a "Projects (classic)" GraphQL error. Set the
  PR body with `gh api -X PATCH repos/ecfidler/orc-alchemy/pulls/<n> -F body=@<file>`.
- **A pipe hides a failed check.** `bun run e2e | tail` returns the exit
  code of `tail`. Use `set -o pipefail`, or read the full output, before you
  commit.
- **Controlled checkboxes in Playwright.** The pack checkbox changes only
  after the IndexedDB write. `uncheck()` can fail. Use `click()`, then
  `expect(...).not.toBeChecked()`.
- **Tests that check `useStorage` with `toEqual`** must list all three
  fields: `inMemory`, `failed`, and `outdated`.
- **Fixture meta files assume the packs are loaded.** With no packs,
  `ironwrought-artificer-3` and `warlock-10-drow` report more unresolved
  keys than their `.meta.json` lists. The meta key order also differs from
  the engine order (ORC-114). Compare keys after a sort by path.
- **Console noise.** With `duplicate-external-b` loaded, the engine logs
  `Unknown level-modifier type: null for class: artificer`. The sheet is
  still correct (ORC-113).
- **The database is version 2.** A build older than ORC-53 cannot open it.
  A tab of the v1 build blocks the upgrade, and the new tab then uses
  memory with a warning.

## 7. Open issues from this session

| Issue | Project | State | Subject |
|---|---|---|---|
| ORC-113 | PubDoor | Backlog, needs triage | The engine logs about the artificer level-modifier |
| ORC-114 | PubDoor | Backlog, needs triage | The fixture meta key order, and a note that meta keys assume loaded packs |
| ORC-115 | Alchemy 5e | Backlog, needs triage | Rebuild stored summaries when packs change |
| ORC-105 | Alchemy 5e | Backlog | Sheet display names. A comment says that the 0.2.0 content lists give the SRD names |
| ORC-109 | Alchemy 5e | Backlog | Always-prepared spells. Still blocked: 0.2.0 has no marker for them |
