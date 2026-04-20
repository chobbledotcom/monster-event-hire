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

const replaceHtmlEmojis = (content) => {
  return content.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    const codePoint = parseInt(hex, 16);
    // Only replace emoji codepoints (typically in the 1Fxxx range)
    if (codePoint >= 0x1F300 && codePoint <= 0x1FFFF) {
      return String.fromCodePoint(codePoint);
    }
    // Keep other entities as-is
    return match;
  });
};

export const replaceEmojiEntities = (sourceDir) => {
  const files = walk(sourceDir);
  let changed = 0;
  for (const f of files) {
    const before = readFileSync(f, "utf8");
    const after = replaceHtmlEmojis(before);
    if (after !== before) {
      writeFileSync(f, after, "utf8");
      changed++;
    }
  }
  console.log(`Replaced emoji entities in ${changed} files.`);
};

if (import.meta.main) {
  // Default to products directory where the source HTML is
  const target = process.argv[2] || process.cwd();
  replaceEmojiEntities(target);
}
