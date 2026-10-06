// Checks that a directory is an Open Knowledge Format v0.2 bundle that
// follows this project's profile, docs/conventions/okf-profile.md.
//
//   bun scripts/okf-check.ts [bundle-root]   (default: docs)
//
// No dependencies: the profile keeps frontmatter flat, with `generated`
// on one line, so the script reads top-level keys line by line instead of
// parsing YAML.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "docs");
const errors: string[] = [];
const fail = (file: string, msg: string) =>
  errors.push(`${relative(process.cwd(), file)}: ${msg}`);

const INDEX = "index.md";
const LOG = "log.md";
const RESERVED = new Set([INDEX, LOG]);
const REQUIRED = ["type", "title", "description", "status", "generated"];
const STATUSES = new Set(["draft", "stable", "deprecated"]);
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const ACTOR = /^(human:\S+|process:\S+|[\w.-]+\/[\w.-]+)$/;
const GENERATED = /^\{\s*by:\s*([^,}]+?)\s*,\s*at:\s*([^,}]+?)\s*\}$/;

function frontmatter(text: string): Map<string, string> | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 3);
  if (end === -1) return null;
  const keys = new Map<string, string>();
  for (const line of text.slice(4, end).split("\n")) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) keys.set(m[1], m[2].trim());
  }
  return keys;
}

function unquote(value: string): string {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

function checkConcept(file: string, text: string) {
  const fm = frontmatter(text);
  if (!fm) return fail(file, "no frontmatter block");
  for (const key of REQUIRED) {
    if (!unquote(fm.get(key) ?? "")) fail(file, `missing required key \`${key}\``);
  }

  const status = fm.get("status");
  if (status && !STATUSES.has(status)) {
    fail(file, `status \`${status}\` is not draft, stable, or deprecated`);
  }

  const generated = fm.get("generated");
  if (generated) {
    const parts = GENERATED.exec(generated);
    if (!parts) {
      fail(file, "write `generated` on one line as `{ by: <actor>, at: <timestamp> }`");
    } else {
      const [, by, at] = parts;
      if (!ACTOR.test(by)) fail(file, `generated.by \`${by}\` is not an actor`);
      if (!TIMESTAMP.test(at)) fail(file, `generated.at \`${at}\` is not a UTC timestamp`);
    }
  }

  const stale = fm.get("stale_after");
  if (stale && !TIMESTAMP.test(unquote(stale))) {
    fail(file, `stale_after \`${stale}\` is not a UTC timestamp`);
  }
}

function checkIndex(file: string, text: string, dir: string, items: string[]) {
  const fm = frontmatter(text);
  if (fm) {
    const extra = [...fm.keys()].filter((k) => k !== "okf_version");
    if (dir !== root) {
      fail(file, "index.md has frontmatter; only the bundle root index may");
    } else if (extra.length) {
      fail(file, `root index.md may carry only okf_version, found ${extra.join(", ")}`);
    }
  }
  const linked = new Set(
    links(text).map((l) => resolve(dir, l).replace(/\/(index\.md)?$/, "")),
  );
  for (const name of items) {
    if (!RESERVED.has(name) && !linked.has(join(dir, name))) {
      fail(file, `does not link to ${name}`);
    }
  }
}

function checkLog(file: string, text: string) {
  for (const line of text.split("\n")) {
    const m = /^## (.*)$/.exec(line);
    if (m && !/^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
      fail(file, `log heading \`${m[1]}\` is not YYYY-MM-DD`);
    }
  }
}

// Relative link targets, outside code. URLs and bundle-absolute paths are
// skipped: the profile uses relative links only.
function links(text: string): string[] {
  const body = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  const out: string[] = [];
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split("#")[0];
    if (!target || /^[a-z]+:/i.test(target) || target.startsWith("/")) continue;
    out.push(decodeURIComponent(target));
  }
  return out;
}

function walk(dir: string) {
  const entries = readdirSync(dir).filter((n) => !n.startsWith("."));
  const items = entries.filter(
    (n) => n.endsWith(".md") || statSync(join(dir, n)).isDirectory(),
  );
  const hasConcepts = items.some((n) => n.endsWith(".md") && !RESERVED.has(n));
  if (hasConcepts && !items.includes(INDEX)) fail(join(dir, INDEX), "missing");

  for (const name of items) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const text = readFileSync(path, "utf8");
    if (name === INDEX) checkIndex(path, text, dir, items);
    else if (name === LOG) checkLog(path, text);
    else checkConcept(path, text);
    for (const target of links(text)) {
      if (!existsSync(resolve(dirname(path), target))) {
        fail(path, `broken link to ${target}`);
      }
    }
  }
}

const rootIndex = join(root, INDEX);
if (!existsSync(rootIndex) || !frontmatter(readFileSync(rootIndex, "utf8"))?.get("okf_version")) {
  fail(rootIndex, "bundle root index.md must declare okf_version");
}
walk(root);

if (errors.length) {
  console.error(errors.join("\n"));
  console.error(`\n${errors.length} problem(s). See docs/conventions/okf-profile.md.`);
  process.exit(1);
}
console.log(`${relative(process.cwd(), root) || "."}: OKF bundle OK`);
