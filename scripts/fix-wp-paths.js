import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { path } from "./utils.js";

const ROOTS = ["wp-content", "wp-includes"];
const prefixGroup = ROOTS.join("|");
const relativeWpRe = new RegExp(`(?:\\.\\./)+(${prefixGroup})/`, "gi");
const attrBareRe = new RegExp(
  `(\\s(?:href|src|action|poster|data-src)\\s*=\\s*["'])(${prefixGroup})/`,
  "gi",
);
const srcsetRe = /\ssrcset\s*=\s*(["'])([^"']+)\1/gi;
const srcsetUrlRe = new RegExp(`(^|,\\s*)(${prefixGroup})/`, "gi");
const cssBareRe = new RegExp(`(url\\(\\s*['"]?)(${prefixGroup})/`, "gi");

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html") || p.endsWith(".css")) out.push(p);
  }
  return out;
};

const rewriteSrcset = (value) =>
  value.replace(srcsetUrlRe, (_, sep, prefix) => `${sep}/${prefix}/`);

const rewrite = (content) =>
  content
    .replace(relativeWpRe, (_, prefix) => `/${prefix}/`)
    .replace(attrBareRe, (_, head, prefix) => `${head}/${prefix}/`)
    .replace(
      srcsetRe,
      (_, quote, value) => ` srcset=${quote}${rewriteSrcset(value)}${quote}`,
    )
    .replace(cssBareRe, (_, head, prefix) => `${head}/${prefix}/`);

export const fixWpPaths = (siteDir) => {
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
  console.log(`Normalized wp-path references in ${changed} files.`);
};

if (import.meta.main) {
  const target = process.argv[2] ? resolve(process.argv[2]) : path("_site");
  fixWpPaths(target);
}
