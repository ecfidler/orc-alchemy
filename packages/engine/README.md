# @orc-alchemy/engine

The spike of the 2024 TypeScript engine (ORC-95). It is not the engine: the
build starts in the Linear project _2024 engine build_ (E1), after the
decisions ORC-220 and ORC-96. The report is
[`docs/reports/2024-engine-spike.md`](../../docs/reports/2024-engine-spike.md).

```bash
bun run typecheck
bun run test       # vitest
```

Use `bun run test`, not `bun test`, which runs Bun's own test runner.

`src/` layout:

- `core/` is the generic core, a port of the semantics of `entity.cljc`,
  `template.cljc`, `modifiers.cljc` and `entity_spec.cljc` in
  `ecfidler/orcpub`. It has no rules content. `core.test.ts` tests it on a
  template that is not D&D.
- `rules2024/` is the 2024 slice: a Fighter from level 1 to level 5, the
  Champion, the Dwarf, the Soldier, and 8 feats. `sheet.ts` is the built
  character, `content/` holds the rules content, and `evaluate.ts` is the
  facade. `fighter.test.ts` has the hand-checked values.

The package imports `@pubdoor/dmv` for its types only. The 2014 rules stay
in that package.

This work includes material from the System Reference Document 5.2.1
("SRD 5.2.1") by Wizards of the Coast LLC, available at
https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative
Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.
