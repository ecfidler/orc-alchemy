---
type: Handoff
title: "M5 handoff: import tooling and homebrew UI"
description: "The starting point to continue M5 on Alchemy 5e: what is merged, the engine 0.3.0 work that must come first, the run plan for the open issues, the decisions so far, and the traps found on the way."
tags: [handoff, homebrew, import, milestones]
status: stable
generated: { by: claude-code/agent, at: 2026-10-09T04:00:00Z }
---

# M5 handoff: import tooling and homebrew UI

You are picking up M5 of project Alchemy 5e, *Import tooling & homebrew
UI*. Five of the thirteen M5 issues are done. The next work is in the
engine, not in the app: engine 0.3.0 must ship before most of the open
issues can start. This document gives the state of the work, the run plan,
the decisions so far, and the traps that cost time in the last session.

## 1. Read these first

1. `CLAUDE.md` at the repository root. The current milestone line says M5.
2. `.claude/skills/milestone-workflow/SKILL.md`. The last session ran the
   milestone with this skill, and each issue with `linear-issue-workflow`.
3. [Doc 04, Homebrew](../plan/04-homebrew.md) and
   [Doc 03, Character import and storage](../plan/03-character-import-and-storage.md).
4. The Linear issues for the next step: ORC-107, ORC-126 and ORC-41 (project
   PubDoor), then ORC-66 and ORC-77.
5. In the fork `ecfidler/orcpub`: `fixtures/README.md`, finding 10. The old
   server sends EDN, not Transit-JSON.

## 2. State on 2026-10-09

**The engine.** The app pins `@pubdoor/dmv@0.2.0` exactly. `fixtures/` is a
snapshot of the fork at tag `pubdoor-v0.2.0`.

**The branches.** M5 has no milestone branch. Each issue PR targets `main`,
so CI runs on each one, as in M4. The last session used the branch
`claude/alchemy-m5-cldeym` in both repositories. Ethan merges each PR
himself.

| Issue | PR | State | What it added |
|---|---|---|---|
| ORC-69 | #34 | Merged | The Import page at `/import`: homebrew, bundle and one-character steps, the import log, progressive and strict modes |
| ORC-70 | #36 | Merged | The conflict step: rename, skip, replace, rename all |
| ORC-71 | #37 | Merged | Missing-content reconciliation: remap a key, or import the pack first |
| ORC-72, ORC-73 | #38 | Merged | The My Content page at `/content`, and `.orcbrew` export per pack and for all content |
| ORC-107 | orcpub #36 | Merged into `pubdoor` | `importCharacter` reads EDN, and the new `readServerEdn` |

ORC-73 shows Done in Linear, but one acceptance step is still open. Ethan
must export a file from My Content and run the fork's
`scripts/check-orcbrew-exports.clj` on it on his machine. The cloud
environment cannot run it.

**The code map for M5.** All paths are under `packages/app/src/`.

| File | Job |
|---|---|
| `components/ImportPage.tsx` | The Import page and its steps. The pack list here is read-only |
| `components/ImportLog.tsx` | The import log panel |
| `components/ConflictResolution.tsx` | The conflict step (ORC-70) |
| `components/UnresolvedContent.tsx` | The remap step after a character import (ORC-71) |
| `components/MyContent.tsx` | The My Content page: pack and item toggles, delete, export |
| `engine/conflicts.ts` | The conflict model and the rename plan |
| `engine/reconcile.ts` | `remapOption`, which keeps sub-choices |
| `engine/content.ts` | Transit helpers for pack data: `tag`, `itemsAt`, `withItem`, the `:disabled?` flag, `packItems` |
| `engine/orcbrew-export.ts` | `exportOrcbrew`: validate, then write EDN |
| `state/homebrew.ts` | `useHomebrew`, `packOn`, `itemOn`, `orcbrewHomebrew()` |

## 3. Next: engine 0.3.0

Three PubDoor issues go into one engine version, 0.3.0. Ethan publishes it
from his machine, because the cloud environment cannot build the engine.

1. **ORC-107** (orcpub PR #36, merged). Linear set ORC-107 to Done on the
   merge, but two changes in this repository are still to do, with the
   0.3.0 bump. Track them in the bump issue, or reopen ORC-107:
   - Let EDN text through `readCharacterFile` in `engine/import.ts`. Today it
     refuses text that is not JSON before the engine sees it.
   - Correct the plan docs that say the server sends Transit: doc 01 §C2 and
     R10, doc 03 Path A, and Plan Set 1 doc 02.
2. **ORC-126**, custom magic items. Engine 0.2.0 always gives the template
   an empty `custom-items` list. The planned change: `buildTemplate` and
   `evaluate` take the `/dnd/5e/items` response, read with `readServerEdn`,
   and pass it into `custom-items` in place of `[]`. The old app used that
   response directly in its subscriptions. Its `to-internal-item` and
   `from-internal-item` exist only for the item builder UI.
3. **ORC-41**, the per-type homebrew validators for the builders.

After the publish: bump the pin to 0.3.0, re-copy `fixtures/` from tag
`pubdoor-v0.3.0`, and record the source in `fixtures/README.md`. The same
copy closes ORC-114's last step.

## 4. After 0.3.0: the run plan

| Order | Issue | Notes |
|---|---|---|
| 1 | ORC-66 | The exporter bookmarklet, in `tools/exporter-bookmarklet/` (not created yet). See below |
| 2 | ORC-67 | The Docker test of the bookmarklet against the old app. See below |
| 3 | ORC-77 | Magic items as homebrew. Needs ORC-126 |
| 4 | ORC-74, ORC-75, ORC-76 | The homebrew builders. Need ORC-41 |
| 5 | ORC-68 | The migration guide |
| 6 | ORC-78 | Real-user acceptance. Needs Ethan's real export |

**ORC-66, the bookmarklet.** It runs on a page of the old app. It reads the
token from the localStorage key `"user"` and sends
`Authorization: Token <jwt>`. It gets `GET /dnd/5e/characters`, then each
`/dnd/5e/characters/<id>`, then `/dnd/5e/items`. The bundle carries the raw
EDN text of each response. The app reads it with `importCharacter` and
`readServerEdn`. The bookmarklet does not parse EDN.

**ORC-67, the Docker test.** The cloud environment has no Docker daemon and
cannot reach clojars, so the test cannot run there. Two ways to run it:

- In the fork, `docker-integration.yml` already builds the old app and
  creates a user. Add a `workflow_dispatch` job that runs the bookmarklet
  against it.
- One command on Ethan's machine.

In the cloud, test the bookmarklet against a fake old server that sends the
EDN shapes in §6.

## 5. Decisions made in M5

- **One PR into `main` for each issue**, with no milestone branch. ORC-72
  and ORC-73 shared one PR.
- **The Import page is the one place to import.** The bundle step skips the
  conflict step and keeps a read-only conflict list in the log.
- **Internal conflicts with three or more packs** rename or drop every copy
  but the last. Internal choices apply first. An external conflict on a copy
  that an internal choice changed is settled by that choice.
- **Remap is only on the Import page**, right after the import. The
  character sheet shows a read-only "Unresolved content" notice. Remap on
  the sheet could be a follow-up issue.
- **Remap suggestions come only from the loaded packs.** The fixtures give
  no suggestions, so the tests rename a key in `duplicate-external-b` to get
  one.
- **The in-file `:disabled?` flag is honoured.** The old app writes it on
  packs and items, and the engine drops flagged items. Turning a pack or an
  item on in My Content clears the flag. The `.orcbrew` export writes the
  flag for each pack or item that is off, so a round trip keeps it off.
- **Pretty-print is on by default** for `.orcbrew` export.
- **Magic items are not in the `.orcbrew` export.** "Export everything"
  shows a note that says so. This is the recommended option on an open
  decision card (§7).
- **Accepted limits.** `renameKey` rewrites references only in the renamed
  pack. Skip and Replace are not written to the import log.

## 6. The old server, as the engine sees it

- Every response is EDN, not Transit-JSON.
- `GET /dnd/5e/characters` is a vector, from `d/pull-many`.
  `/dnd/5e/items` is a list, from `(map first items)`.
- Every map has a `:db/id`. Each character also has `owner`, `type`,
  `game`, `game-version` and `summary`. The engine's import strips them.
- Cardinality-many values, such as prepared spells, come back as vectors.
  `from-strict` turns them back into sets.
- `engine-js/test/fixtures/fighter-1.server.edn` in the fork is a real
  capture (ORC-11), with the owner renamed to `example-user`.

## 7. Open questions for Ethan

Two decision cards in the M5 thread have no answer yet. Work went on with
the recommended option of each.

- **Magic items in the `.orcbrew` export.** Recommended: omit them. In
  effect now.
- **Engine first.** Recommended: ship engine 0.3.0 (ORC-107, ORC-126,
  ORC-41) before ORC-66 and ORC-77. This handoff follows it.

## 8. Traps

- **The cloud environment.** repo.clojars.org is blocked, so the engine
  cannot build there. The fork's Engine CI is the only build and test run,
  and one loop takes about 3 minutes. There is no Docker daemon.
  uploads.linear.app is blocked, so read attachments from the comment text
  where you can. Ethan can allow clojars in a custom cloud environment under
  Project settings.
- **Never commit the private export.** Ethan's `all-content3.orcbrew` goes
  in `fixtures/orcbrew/private/`, which is git-ignored in both repositories.
  Keep personal names out of committed fixtures and comments.
- **Prettier.** The repository has no prettier config. Running prettier on a
  file reformats all of it. Do not run it.
- **A pipe hides a failed check.** Use `set -o pipefail` with `| tail`.
- **`pkill -f`** with a broad pattern can kill your own shell.
- **`engine/import.test.ts`** failed once at file level in a full run, then
  passed alone and in a rerun. If it fails again, find the cause. Do not
  call it a flake.
- **Transit in pack data.** Keywords are `"~:k"`, sets are
  `{"~#set": [...]}`, and integer map keys are `"~i1"`. Use the helpers in
  `engine/content.ts`. Do not build Transit strings in components.

## 9. Open issues from this session

| Issue | Project | State | Subject |
|---|---|---|---|
| ORC-107 | PubDoor | Done | EDN import. The app and docs follow-ups in §3 are not done |
| ORC-126 | PubDoor | Backlog | Custom magic items in `buildTemplate` and `evaluate` |
| ORC-125 | PubDoor | Backlog | No line numbers for EDN parse errors in `parseOrcbrew` |
| ORC-41 | Alchemy 5e | Backlog | Per-type validators through the facade |
