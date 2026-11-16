// The spike of the 2024 engine (ORC-95). The report is
// docs/reports/2024-engine-spike.md.

export * from "./core/build.ts";
export * from "./core/entity.ts";
export * from "./core/modifiers.ts";
export * from "./core/template.ts";
export {
  type Built2024,
  type Entity2024,
  type EvaluateOptions2024,
  type Evaluation2024,
  type Extension2024,
  evaluate,
  NOT_SHARED,
  type SharedKey,
} from "./rules2024/evaluate.ts";
export type { Sheet } from "./rules2024/sheet.ts";
export { template2024 } from "./rules2024/template.ts";
