import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fs, path } from "./utils.js";

const SKIP_DIRS = new Set([
  ".build",
  ".direnv",
  ".git",
  ".image-cache",
  "_data",
  "_site",
  "chobble-template",
  "node_modules",
  "scripts",
  "theme",
  "wp-json",
]);

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
};

const STYLE_BLOCK_RE = /\n {2}<style>\n {2}([^\n]{50000,})\n {2}<\/style>\n/;

const LINK_TAG =
  '  <link rel="stylesheet" href="{{ \'/theme/theme.css\' | cacheBust }}">';

const WP_PREFIXES = "wp-content|wp-includes|wp-json";
const relativeWpUrlRe = new RegExp(
  `url\\((['"]?)(?:\\.\\./)+(${WP_PREFIXES})/`,
  "gi",
);
const bareWpUrlRe = new RegExp(`url\\((['"]?)(${WP_PREFIXES})/`, "gi");

const SITE = "https://www\\.monstereventhire\\.co\\.uk";
const MIRROR_URL_FIXES = [
  [
    new RegExp(`${SITE}/[^)'" ]*?opensans-regular-webfont\\.eot`, "gi"),
    "/wp-content/themes/littlemonsters/fonts/open-sans/regular/opensans-regular-webfont.eot",
  ],
  [
    new RegExp(`${SITE}/[^)'" ]*?images/areas-icon\\.png`, "gi"),
    "/wp-content/themes/littlemonsters/images/areas-icon.png",
  ],
  [
    new RegExp(`${SITE}/[^)'" ]*?images/areas-we-cover-banner\\.png`, "gi"),
    "/assets/areas-we-cover-banner.png",
  ],
];

const normalize = (css) => {
  let out = css
    .replace(relativeWpUrlRe, (_, q, prefix) => `url(${q}/${prefix}/`)
    .replace(bareWpUrlRe, (_, q, prefix) => `url(${q}/${prefix}/`);
  for (const [re, replacement] of MIRROR_URL_FIXES) {
    out = out.replace(re, replacement);
  }
  return out;
};

const extractBlob = (html) => {
  const match = html.match(STYLE_BLOCK_RE);
  return match ? match[1] : null;
};

const root = path();
const files = walk(root);
console.log(`Scanning ${files.length} HTML files...`);

let canonical = null;
let canonicalSource = null;
const mismatches = [];
const blobless = [];

for (const f of files) {
  const html = readFileSync(f, "utf8");
  const blob = extractBlob(html);
  if (!blob) {
    blobless.push(f);
    continue;
  }
  const normalized = normalize(blob);
  if (canonical === null) {
    canonical = normalized;
    canonicalSource = f;
  } else if (normalized !== canonical) {
    mismatches.push(f);
  }
}

if (canonical === null) {
  console.log("No inline CSS blob found; nothing to do.");
  process.exit(0);
}

console.log(`Canonical CSS derived from ${canonicalSource}`);
console.log(`Blob size: ${canonical.length} chars`);
if (blobless.length) {
  console.log(`Files without a style blob (skipped): ${blobless.length}`);
  for (const f of blobless) console.log(`  ${f}`);
}
if (mismatches.length) {
  console.warn(
    `WARNING: ${mismatches.length} files normalize to a different blob:`,
  );
  for (const f of mismatches.slice(0, 10)) console.warn(`  ${f}`);
}

const themeDir = path("theme");
fs.mkdir(themeDir);
const themeCssPath = join(themeDir, "theme.css");
writeFileSync(themeCssPath, `${canonical}\n`);
console.log(`Wrote ${themeCssPath}`);

let rewritten = 0;
for (const f of files) {
  const html = readFileSync(f, "utf8");
  if (!STYLE_BLOCK_RE.test(html)) continue;
  const next = html.replace(STYLE_BLOCK_RE, `\n${LINK_TAG}\n`);
  if (next !== html) {
    writeFileSync(f, next);
    rewritten++;
  }
}
console.log(`Rewrote ${rewritten} HTML files to link /theme/theme.css`);
