import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { bun, fs, path } from "./utils.js";

const SUFFIX = "-eleventied";
const siteDir = path("_site");
const root = path();

const walkHtml = (dir) => {
  const out = [];
  if (!fs.exists(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walkHtml(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
};

const findPairs = (site) => {
  const pairs = [];
  for (const p of walkHtml(site)) {
    const rel = relative(site, p);
    if (!rel.includes(SUFFIX)) continue;
    pairs.push({
      eleventied: p,
      original: join(site, rel.replaceAll(SUFFIX, "")),
      rel,
    });
  }
  return pairs;
};

const normalize = (html) =>
  html.replace(/\s+</g, "<").replace(/>\s+/g, ">").replace(/\s+/g, " ").trim();

const firstDiff = (a, b) => {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const start = Math.max(0, i - 40);
  return {
    at: i,
    expected: a.slice(start, i + 120),
    actual: b.slice(start, i + 120),
  };
};

const compare = ({ eleventied, original, rel }) => {
  if (!fs.exists(original)) return { rel, status: "missing", original };
  const expected = normalize(readFileSync(original, "utf8"));
  const actual = normalize(readFileSync(eleventied, "utf8"));
  if (expected === actual) return { rel, status: "match" };
  return { rel, status: "diff", diff: firstDiff(expected, actual) };
};

const printDiff = (r) => {
  console.log(`  FAIL ${r.rel}`);
  console.log(`       differs at char ${r.diff.at}`);
  console.log(`       expected: ...${r.diff.expected}...`);
  console.log(`       actual:   ...${r.diff.actual}...`);
};

const printMissing = (r) => {
  console.log(`  MISS ${r.rel}`);
  console.log(`       no original at ${relative(siteDir, r.original)}`);
};

const runBuild = () => {
  console.log("Building site...");
  const result = bun.run("build", root);
  if (result.exitCode !== 0) process.exit(result.exitCode);
};

if (!process.argv.includes("--no-build")) runBuild();

const pairs = findPairs(siteDir);

if (pairs.length === 0) {
  console.log(`No ${SUFFIX} pages found in _site/.`);
  process.exit(0);
}

console.log(`\nComparing ${pairs.length} eleventied page(s):\n`);

const results = pairs.map(compare);
const matched = results.filter((r) => r.status === "match");
const diffs = results.filter((r) => r.status === "diff");
const missing = results.filter((r) => r.status === "missing");

for (const r of matched) console.log(`  OK   ${r.rel}`);
for (const r of missing) printMissing(r);
for (const r of diffs) printDiff(r);

console.log(
  `\n${matched.length} match, ${diffs.length} differ, ${missing.length} missing original`,
);

if (diffs.length || missing.length) process.exit(1);
