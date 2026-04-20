import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { path } from "./utils.js";

const SKIP_DIRS = new Set([
  ".build",
  ".direnv",
  ".git",
  "_data",
  "_site",
  "chobble-template",
  "node_modules",
  "scripts",
]);

const WALK_SKIP = new Set([...SKIP_DIRS, ".image-cache"]);

const listTopDirs = (dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter(
      (e) =>
        e.isDirectory() && !e.name.startsWith(".") && !SKIP_DIRS.has(e.name),
    )
    .map((e) => e.name);

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (WALK_SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildRewriter = (topDirs) => {
  const group = topDirs.map(escapeRe).join("|");
  const re = new RegExp(
    `(\\s(?:href|src|action|poster|data-src)\\s*=\\s*["'])(?:\\.\\./)+(${group})(/|["'#?])`,
    "gi",
  );
  return (content) =>
    content.replace(
      re,
      (_, head, prefix, after) => `${head}/${prefix}${after}`,
    );
};

export const fixRelativePaths = (siteDir) => {
  const topDirs = listTopDirs(siteDir);
  if (topDirs.length === 0) {
    console.log("No top-level directories found; skipping relative-path fix.");
    return;
  }
  const rewrite = buildRewriter(topDirs);
  const files = walk(siteDir);
  let changed = 0;
  for (const f of files) {
    const before = readFileSync(f, "utf8");
    const after = rewrite(before);
    if (after !== before) {
      writeFileSync(f, after);
      changed++;
    }
  }
  console.log(`Normalized relative-path references in ${changed} files.`);
};

if (import.meta.main) {
  const target = process.argv[2] ? resolve(process.argv[2]) : path("_site");
  fixRelativePaths(target);
}
