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
- `rules2024/` is the 2024 rules. `built.ts` is the built character
  (`Built2024`) and its base, `content/` holds the rules content,
  `template.ts` is the template, and `evaluate.ts` is the facade:
  `evaluate`, the mutations and `autofill`. `records.ts` converts records of
  the content format to core options, `hooks/` is the hook registry, and
  `packs.ts` loads a pack for the engine: it checks the hooks, then converts
  each record and drops the rules that do not convert. `fighter.test.ts`
  has the hand-checked values of the Fighter from the spike (ORC-95).
- `srd52/srd52.test.ts` compares the built-in pack with the text of the SRD
  5.2.1 PDF, in `srd52/fixtures/`.

`content/` holds the built-in pack `srd52.json`, its provenance file, and
the MIT notice of 5e-bits. `scripts/` makes them (ORC-224):

```bash
bun run import-srd <5e-srd-api checkout>          # writes content/
bun run import-srd <5e-srd-api checkout> --check  # compares a new run with content/
bun run extract-srd-text <SRD_CC_v5.2.1.pdf>      # writes src/srd52/fixtures/
```

The content format spec, section _The source data_, gives the steps. Do not
edit the files in `content/` or `src/srd52/fixtures/` by hand. Put a
correction in `scripts/srd-corrections.ts` and run the script again.

This work includes material from the System Reference Document 5.2.1
("SRD 5.2.1") by Wizards of the Coast LLC, available at
https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.
