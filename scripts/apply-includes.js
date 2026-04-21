#!/usr/bin/env bun
/**
 * Replace repeated inline HTML blocks with _include tags across all page files.
 * Patterns are extracted from reference files so they match exactly.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

const ROOT = resolve(import.meta.dir, "..");
const DRY_RUN = process.argv.includes("--dry-run");

// ── reference files ────────────────────────────────────────────────────────

const refProduct = readFileSync(
  join(ROOT, "electronic-games/cash-grabber/index.html"),
  "utf8"
);
const refArea = readFileSync(
  join(ROOT, "areas-covered/west-sussex/index.html"),
  "utf8"
);

// ── helpers ────────────────────────────────────────────────────────────────

const extractBlock = (src, startStr, endStr) => {
  const s = src.indexOf(startStr);
  if (s === -1) return null;
  const e = src.indexOf(endStr, s);
  if (e === -1) return null;
  return src.slice(s, e + endStr.length);
};

const extractRegex = (src, pattern) => {
  const m = src.match(pattern);
  return m ? m[0] : null;
};

// ── extract exact patterns ─────────────────────────────────────────────────

const HEADER_BLOCK = extractBlock(refProduct, "    <header>\n", "    </header>");
const OPENING_HOURS_BLOCK = extractRegex(
  refProduct,
  /          <div class="opening-hours">[\s\S]*?          <\/div>/
);
const SIDEBAR_BLOCK = extractRegex(
  refArea,
  /          <aside class="grid-4-12 sidebar">[\s\S]*?          <\/aside>/
);
const AREA_TESTIMONIAL_BLOCK = extractRegex(
  refArea,
  /            <div class="testimonial-item">\n              <div class="testimonial-body">\n                <p>Dear Joanne[\s\S]*?            <\/div>/
);
const WP_STYLES_BLOCK = extractBlock(
  refProduct,
  "<link rel='stylesheet' id='wp-block-library-css'",
  '<link rel="https://api.w.org/" href="/wp-json/">'
);
const HEAD_END_BLOCK = extractBlock(
  refProduct,
  "  <style type=\"text/css\">\n  .recentcomments",
  "  <meta name=\"robots\" content=\"index, follow\">"
);

// Regex-based patterns (content varies slightly per page)
const AREA_LINKS_PATTERN =
  /            <div class="areas" style="display:none;">[\s\S]*?<\/ul>\n            <\/div>/;

// Sidebar: span id="eNNNNNNNNN" is an obfuscated email id that differs per page
const SIDEBAR_PATTERN =
  /          <aside class="grid-4-12 sidebar">[\s\S]*?          <\/aside>/;

// Header: some pages have current-menu-item on their active nav link.
// We only exact-match the product-page header; pages with active states are skipped.
const patterns = {
  "site-header": [HEADER_BLOCK, '    {%- include "site-header.html" -%}'],
  "opening-hours": [
    OPENING_HOURS_BLOCK,
    '          {%- include "opening-hours.html" -%}',
  ],
  "area-testimonial": [
    AREA_TESTIMONIAL_BLOCK,
    '            {%- include "area-testimonial.html" -%}',
  ],
  "wp-block-styles": [
    WP_STYLES_BLOCK,
    '{%- include "wp-block-styles.html" -%}',
  ],
  "head-end": [HEAD_END_BLOCK, '  {%- include "head-end.html" -%}'],
};

// Report extraction status
for (const [name, [block]] of Object.entries(patterns)) {
  const lines = block ? block.split("\n").length : 0;
  console.log(`  ${block ? "✓" : "✗"} ${name}: ${lines} lines`);
}

// ── file discovery ─────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  "node_modules",
  "_site",
  ".build",
  "packages",
  "chobble-template",
  "scripts",
  "_includes",
  "_data",
  "css",
  "images",
  "assets",
  ".git",
  ".jscpd-report",
]);

const findHtmlFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...findHtmlFiles(full));
    } else if (entry.endsWith(".html")) {
      results.push(full);
    }
  }
  return results;
};

// ── apply replacements ─────────────────────────────────────────────────────

const applyToFile = (filepath) => {
  let content = readFileSync(filepath, "utf8");
  const original = content;
  const applied = [];

  for (const [name, [block, replacement]] of Object.entries(patterns)) {
    if (!block) continue;
    if (content.includes(block)) {
      content = content.split(block).join(replacement);
      applied.push(name);
    }
  }

  // Sidebar: regex replacement (span id differs per page)
  if (SIDEBAR_PATTERN.test(content)) {
    content = content.replace(
      SIDEBAR_PATTERN,
      '          {%- include "sidebar.html" -%}'
    );
    applied.push("sidebar");
  }

  // Area links: regex replacement (heading varies by page)
  if (AREA_LINKS_PATTERN.test(content)) {
    content = content.replace(
      AREA_LINKS_PATTERN,
      '            {%- include "area-links.html" -%}'
    );
    applied.push("area-links");
  }

  if (content !== original) {
    if (!DRY_RUN) writeFileSync(filepath, content, "utf8");
    return applied;
  }
  return [];
};

// ── run ────────────────────────────────────────────────────────────────────

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Scanning HTML files...\n`);

const files = findHtmlFiles(ROOT);
const stats = {};

for (const file of files) {
  const applied = applyToFile(file);
  const rel = file.replace(ROOT + "/", "");
  if (applied.length > 0) {
    console.log(`  ${rel}: ${applied.join(", ")}`);
    for (const name of applied) {
      stats[name] = (stats[name] || 0) + 1;
    }
  }
}

console.log("\nSummary:");
for (const [name, count] of Object.entries(stats)) {
  console.log(`  ${name}: ${count} files`);
}
console.log(`\nTotal files scanned: ${files.length}`);
