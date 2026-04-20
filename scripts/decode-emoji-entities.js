import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { path } from "./utils.js";

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
};

const decodeHtmlEntity = (match) => {
  const hex = match.slice(3, -1);
  const codePoint = parseInt(hex, 16);
  return String.fromCodePoint(codePoint);
};

const fixMalformedEmojis = (content) => {
  // Handle malformed emoji sequences from entity decoding issues
  // The HTML entities &#x1f9d1;&#x200d;&#x1f3eb; get corrupted to
  // U+F9D1 (六), U+200D (ZWJ), U+F3EB (private use)
  // Replace with correct emoji: 🧑‍🏫 (person-school)
  const malformedPattern = /\uF9D1\u200D\uF3EB/g;
  let result = content.replace(malformedPattern, "🧑‍🏫");

  // Also try to decode any remaining HTML entities
  result = result.replace(/&#x[0-9a-f]+;/gi, decodeHtmlEntity);

  return result;
};

export const decodeEmojis = (siteDir) => {
  const files = walk(siteDir);
  let changed = 0;
  for (const f of files) {
    const before = readFileSync(f, "utf8");
    const after = fixMalformedEmojis(before);
    if (after !== before) {
      writeFileSync(f, after, "utf8");
      changed++;
    }
  }
  console.log(`Fixed emoji rendering in ${changed} files.`);
};

if (import.meta.main) {
  const target = process.argv[2] ? resolve(process.argv[2]) : path("_site");
  decodeEmojis(target);
}
