import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { path } from "./utils.js";

const root = path("_site");

const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};

const attrRe =
  /\s(href|src|srcset|poster|action|data-src)\s*=\s*["']([^"']+)["']/gi;
const cssUrlRe = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;

const isExternal = (u) =>
  /^(https?:)?\/\//i.test(u) ||
  u.startsWith("mailto:") ||
  u.startsWith("tel:") ||
  u.startsWith("data:") ||
  u.startsWith("javascript:") ||
  u.startsWith("#") ||
  u.startsWith("about:");

const strip = (u) => u.split("#")[0].split("?")[0];

const resolveUrl = (base, u) => {
  if (u.startsWith("/")) return join(root, u);
  return resolve(dirname(base), u);
};

const existsOnDisk = (p) => {
  if (!existsSync(p)) return false;
  const s = statSync(p);
  if (s.isDirectory()) return existsSync(join(p, "index.html"));
  return true;
};

const ASSET_EXT =
  /\.(css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm|pdf|json|xml)$/i;

const categorize = (url) => {
  const clean = strip(url);
  if (ASSET_EXT.test(clean)) return "asset";
  return "link";
};

const htmlFiles = walk(root).filter((f) => f.endsWith(".html"));
const cssFiles = walk(root).filter((f) => f.endsWith(".css"));

const missing = new Map();

const record = (file, url, target) => {
  const key = target;
  if (!missing.has(key)) {
    missing.set(key, {
      url,
      target,
      category: categorize(url),
      refs: 0,
      example: file,
    });
  }
  missing.get(key).refs++;
};

const checkValue = (file, val) => {
  if (!val || isExternal(val)) return;
  const clean = strip(val);
  if (!clean) return;
  const target = resolveUrl(file, clean);
  if (!target.startsWith(root)) return;
  if (!existsOnDisk(target)) record(file, val, target);
};

for (const file of htmlFiles) {
  const content = readFileSync(file, "utf8");
  for (const m of content.matchAll(attrRe)) {
    const attr = m[1].toLowerCase();
    const raw = m[2];
    const vals =
      attr === "srcset"
        ? raw.split(/\s*,\s*/).map((x) => x.trim().split(/\s+/)[0])
        : [raw];
    for (const v of vals) checkValue(file, v);
  }
}

for (const file of cssFiles) {
  const content = readFileSync(file, "utf8");
  for (const m of content.matchAll(cssUrlRe)) checkValue(file, m[1]);
}

const entries = [...missing.values()];
const assets = entries.filter((e) => e.category === "asset");
const links = entries.filter((e) => e.category === "link");

console.log(
  `Scanned ${htmlFiles.length} HTML and ${cssFiles.length} CSS files.`,
);
console.log(`Missing unique URLs: ${entries.length}`);
console.log(`  assets (img/css/js/etc): ${assets.length}`);
console.log(`  links (page navigation):  ${links.length}`);

const failOnAssets = !process.argv.includes("--links");

if (assets.length) {
  console.log("\nMissing asset URLs:");
  for (const e of assets.slice(0, 50)) {
    console.log(
      `  ${e.refs.toString().padStart(4)}  ${e.target.replace(root, "")}`,
    );
    console.log(`        e.g. ${e.url} in ${e.example.replace(root, "")}`);
  }
  if (assets.length > 50) console.log(`  ... (${assets.length - 50} more)`);
}

if (process.argv.includes("--links") && links.length) {
  console.log("\nMissing page links:");
  for (const e of links.slice(0, 50)) {
    console.log(
      `  ${e.refs.toString().padStart(4)}  ${e.target.replace(root, "")}`,
    );
    console.log(`        e.g. ${e.url} in ${e.example.replace(root, "")}`);
  }
  if (links.length > 50) console.log(`  ... (${links.length - 50} more)`);
}

if (failOnAssets && assets.length) {
  console.error(`\nFAIL: ${assets.length} missing asset URLs.`);
  process.exit(1);
}

if (!failOnAssets && entries.length) {
  console.error(`\nFAIL: ${entries.length} missing internal URLs.`);
  process.exit(1);
}

console.log(
  failOnAssets ? "\nOK: no missing assets." : "\nOK: no missing internal URLs.",
);
