# @orc-alchemy/engine

The 2024 rules engine (Linear project _2024 engine build_). The spec is
[`docs/design/2024-engine.md`](../../docs/design/2024-engine.md). The
package is a workspace dependency of `packages/app`. It is not published to
npm.

```bash
bun run typecheck
bun run test       # vitest
```

Use `bun run test`, not `bun test`, which runs Bun's own test runner.

`src/` layout:

- `core/` is the generic core. It has no rules content.
  - `entity.ts`, `template.ts`, `modifiers.ts` and `build.ts` port the
    semantics of `entity.cljc`, `template.cljc`, `modifiers.cljc` and
    `entity_spec.cljc` in `ecfidler/orcpub`, with the changes of the spec:
    declared dependencies with guards, two meanings of a prerequisite
    (`canChoose` and `stillValid`), one selection for each `ref` pool,
    problems, and contributions.
  - `mutations.ts` has the changes that a builder makes, and `autofill.ts`
    fills the open selections from a seed.
  - `core.test.ts` tests the core on a template that is not D&D.
- `format/` is the content format: `schema.ts` (Zod 4) gives the pack and
  record types, `load.ts` is the loader with the version upgrade and the
  reference check, and `keys.ts` is the key scheme. The spec is
  [`docs/design/2024-content-format.md`](../../docs/design/2024-content-format.md).
- `rules2024/` is the 2024 rules.
  - `built.ts` is the built character (`Built2024`). `base-rules.ts` has
    its base and the rules that every character has (`RULES`).
  - `template.ts` makes the template from the content. `built-in.ts`
    loads the pack `srd52`.
  - `evaluate.ts` is the facade: `evaluate`, the mutations and
    `autofill`.
  - `content.ts` finds the loaded records by type and reference.
    `records.ts` converts records of the content format to core options,
    and `record-values.ts` compiles their values and conditions.
    `equipment.ts` makes the armor, Shield, weapon, item, Weapon Mastery
    and starting equipment choices from the equipment records.
    `class-frame.ts` has the class levels and their Hit Points.
  - `hooks/` is the hook registry, with one file for each hook.
  - `packs.ts` loads a pack for the engine. It checks the hooks, then
    converts each record and drops the rules that do not convert.
  - `fighter-levels.test.ts` has the hand-checked values of the Fighter
    from the spike (ORC-95), and each level from 1 to 20 of the
    `srd52:fighter` record with Champion (ORC-230). `fighter-choices.test.ts`
    has the choices, the facade and the mutations of the Fighter. `base-rules.test.ts` has the rules of every character
    on test classes (ORC-225). `species.test.ts` has the 9 species of the
    pack at levels 1, 5 and 11 (ORC-226). `feats.test.ts` and
    `backgrounds.test.ts` have the 17 feats and the 4 backgrounds
    (ORC-227). `equipment.test.ts` has the attack lines, the armor and the
    starting equipment of each class and background (ORC-228).
- `golden/` holds the golden characters: characters with sheet values
  computed by hand from SRD 5.2.1, and the suite that checks them
  (ORC-237). Its README has the rules and the plan of the 14 characters.
- `srd52/srd52.test.ts` compares the built-in pack with the text of the SRD
  5.2.1 PDF, in `srd52/fixtures/`.

`content/` holds the built-in pack `srd52.json`, its provenance file, and
the MIT notice of 5e-bits. `scripts/` makes them (ORC-224):

```bash
bun run import-srd <5e-srd-api checkout>          # writes content/
bun run import-srd <5e-srd-api checkout> --check  # compares a new run with content/
bun run extract-srd-text <SRD_CC_v5.2.1.pdf>      # writes src/srd52/fixtures/
```

The content format spec, section _The source data_, gives the steps. The
import runs one time. After that, `content/srd52.json` is the source: the
rules tickets add the effects to it, and correct it, by hand.

This work includes material from the System Reference Document 5.2.1
("SRD 5.2.1") by Wizards of the Coast LLC, available at
https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.
