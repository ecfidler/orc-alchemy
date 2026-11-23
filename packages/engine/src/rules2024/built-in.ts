// The built-in content: the pack `srd52`, loaded for the engine one time.
// The test in srd52/srd52.test.ts checks that it loads with no issue.

import pack from "../../content/srd52.json" with { type: "json" };
import type { Content } from "./content.ts";
import { loadContentPack } from "./packs.ts";

const loaded = loadContentPack(pack);
if (!loaded.pack) throw new Error(`The built-in pack srd52 does not load: ${loaded.issues.map((issue) => issue.message).join("; ")}`);

export const SRD52 = loaded.pack;

/** The content that every character can use. */
export const BUILT_IN: Content = { packs: [SRD52] };
