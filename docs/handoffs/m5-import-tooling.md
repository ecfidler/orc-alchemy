---
type: Handoff
title: "M5 handoff: import tooling and homebrew UI"
description: "The starting point to finish M5 on Alchemy 5e: what is merged, the one open issue (ORC-78), the decisions so far, the follow-ups, and the traps."
tags: [handoff, homebrew, import, milestones]
status: stable
generated: { by: claude-code/agent, at: 2026-10-10T04:57:51Z }
---

# M5 handoff: import tooling and homebrew UI

You are picking up M5 of project Alchemy 5e, *Import tooling & homebrew
UI*. Every M5 issue is merged except ORC-78, the real-user acceptance.
ORC-78 needs a file from Ethan. This document gives the state, the
decisions, the follow-ups and the traps.

## 1. Read these first

1. `CLAUDE.md` at the repository root. The current milestone line says M5.
2. `.claude/skills/milestone-workflow/SKILL.md` and
   `.claude/skills/linear-issue-workflow/SKILL.md`.
3. [Moving from Dungeon Master's Vault](../guides/moving-from-dungeon-masters-vault.md).
   ORC-78 follows this guide.
4. Linear ORC-78, and the M5 proof in
   [doc 06](../plan/06-milestones-and-risks.md).

## 2. State on 2026-10-10

The app pins `@pubdoor/dmv@0.3.0`. `fixtures/` is a snapshot of the
fork at tag `pubdoor-v0.3.0` (57fcce84). Each issue went as one PR into
`main`, and Ethan squash-merged each one.

| Issue | PR | What it added |
|---|---|---|
| ORC-107 (app part), ORC-114 | #39 | Engine 0.3.0 pin, fixtures copy, the old server's EDN in `readCharacterFile`, plan docs corrected to EDN |
| ORC-66, ORC-67 | #40 | The exporter bookmarklet (`tools/exporter-bookmarklet/`), and the Docker test in `.github/workflows/bookmarklet-docker.yml` |
| ORC-77 | #41 | Custom magic items: a `magicItems` IndexedDB store (database version 3), bundle import, My Content section, `Content` = `{ homebrew, magicItems }` passed to every engine call |
| ORC-74, ORC-128 | #42 | The builder frame (`HomebrewBuilder.tsx`), spell, monster and magic item forms |
| ORC-75 | #43 | Race, subrace, class and subclass forms; one toolkit in `builders/fields.tsx`; `engine/builder-choices.ts` |
| ORC-76 | #44 | Background, feat, language, invocation, boon and selection forms |
| ORC-68 | #45 | The guide at `/import/dmv` and `docs/guides/` |

Earlier M5 work (ORC-69 to ORC-73, ORC-41, ORC-126) was merged before
this session; see the PRs #34 to #38.

## 3. Next: ORC-78

ORC-78 is the M5 proof: Ethan's real data imports cleanly, and every
character matches the old app.

**Inputs.**
- `all-content3.orcbrew`: at `/home/ethan/orcpub/fixtures/orcbrew/private/`
  (29 packs, 1412 items, a BOM, 86 internal conflicts). Never commit it.
- `dmv-export.json`: **not there yet.** Ethan runs the bookmarklet on his
  real Dungeon Master's Vault account. He gets the bookmark link from
  `bun run dev` in `packages/app`, page `/import/dmv`. Ask where he
  saved it. Keep it out of both repositories.

**Steps.** Follow the guide. Import the homebrew first, then the bundle.
Record on ORC-78: import time, conflicts and how they were resolved,
unresolved keys per character, and each sheet value that differs from the
old app. Each difference becomes a fixture and an issue. The homebrew
half can start without the bundle.

**Then close M5** with the milestone-workflow skill, section 4: check the
proof claim by claim, move the `CLAUDE.md` milestone line, and update
project memory.

## 4. Decisions made in M5

- **One PR into `main` for each issue**, no milestone branch.
- **The old server sends EDN.** The bookmarklet does not parse it. A
  `dmv-export` entry in `characters` or `magicItems` can be the raw
  EDN text of one server response. `GET /dnd/5e/characters` holds every
  character in full, so the bookmarklet makes no per-id calls.
- **Magic items are not in `.orcbrew` export.** They go in the
  `dmv-export` bundle as item maps, without their on/off flags.
- **Magic items are stored apart from packs**, keyed from the name with
  the old `name-to-kw` rule. A new or renamed item cannot take another
  item's key.
- **The builders keep a stored key on rename**, because the engine's
  validators do so on purpose. A background whose key differs from its
  name shows a warning; characters always take the name's key.
- **No encounter builder** until the combat tracker decision (ORC-90).
- **`:plugin?`** is set only by the old built-in supplement classes, so
  homebrew classes keep their ASI and HP. No change.
- **No monster browse page** yet (ORC-87, M7). A saved monster shows in
  My Content.

## 5. Follow-ups filed in this session

| Issue | What |
|---|---|
| ORC-127 | Golden `fighter-20` holds `attuned-magic-items`, which the old server cannot store. The Docker test leaves it out |
| ORC-129 | Builder lists offer SRD values only (languages, weapons, class attunement, spell lists); the Custom base weapon is missing |
| ORC-130 | No import warning for a background key that differs from `name-to-kw(name)` |

Older open items: ORC-73's export check passed (84 exports). ORC-125 (no
line numbers in EDN parse errors) is still in the backlog.

## 6. Traps

- **This machine has no Docker.** The Docker test runs only in GitHub
  Actions. It triggers on PRs that touch `tools/exporter-bookmarklet/**`,
  or on demand with `gh workflow run bookmarklet-docker.yml --ref <branch>`.
  One run takes about 9 minutes.
- **The old public character link downloads a file** (`application/edn`
  with nosniff). It does not show text in the browser.
- **bun 1.0.14 lockfile bug.** Adding a new workspace and depending on it
  in one install fails. Install twice: first without the dependency.
- **`Content.homebrew` is required** (`Homebrew | undefined`), so a bare
  homebrew map does not type-check as `Content`.
- **No Transit strings in components.** Use `tag`, `untag`, `intKey`,
  `intKeyValue`, `asSet` and `setItems` in `engine/content.ts`.
- **Parallel workers on builder forms** each wrote their own toolkit in
  ORC-75. Give each worker the shared `builders/fields.tsx` up front.
- **Prettier.** The repository has no prettier config. Do not run it.
