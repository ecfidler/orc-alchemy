// @orc-alchemy/engine: the 2024 rules engine. The spec is
// docs/design/2024-engine.md.

export { type AutofillOptions, seededRandom, shuffled } from "./core/autofill.ts";
export * from "./core/build.ts";
export * from "./core/entity.ts";
export * from "./core/modifiers.ts";
export { MutationError } from "./core/mutations.ts";
export * from "./core/template.ts";
export * from "./format/keys.ts";
export { checkReferences, type IssuePath, type LoadIssue, type LoadOptions, type LoadResult, loadPack, type Upgrade } from "./format/load.ts";
export * from "./format/schema.ts";
export type { Built2024 } from "./rules2024/built.ts";
export {
  type AutofillOptions2024,
  type AvailableSelection,
  addLevel,
  autofill,
  buildCharacter,
  type ContentPack,
  deselect,
  type Entity2024,
  type EvaluateOptions2024,
  type Evaluation2024,
  evaluate,
  type MutationOptions2024,
  removeLevel,
  select,
  setOptionValue,
  setValue,
} from "./rules2024/evaluate.ts";
export { defineHook, HOOKS, type Hook, type HookRegistry } from "./rules2024/hooks/index.ts";
export { type ContentPackOptions, loadContentPack } from "./rules2024/packs.ts";
export { backgroundOption, type Content, featOption, findRecord, RecordError, speciesOption, subclassOption } from "./rules2024/records.ts";
export { template2024 } from "./rules2024/template.ts";
