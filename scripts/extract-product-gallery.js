#!/usr/bin/env bun
/**
 * One-shot migration: replaces inline <div class="grid-6-12 product-gallery">
 * blocks in product pages with `{%- include "product-gallery.html" -%}` and
 * lifts the image list into frontmatter (galleryImages, galleryAlt).
 *
 * Delete this script after the migration commit lands.
 */
import { readdirSync } from "node:fs";
import { path, read, write } from "./utils.js";

const DRY_RUN = process.argv.includes("--dry-run");
const FILE_ARG = process.argv.find((a) => a.startsWith("--file="));
const ONLY_FILE = FILE_ARG ? FILE_ARG.slice("--file=".length) : null;

const PRODUCTS_DIR = path("products");
const GALLERY_RE =
  /( *)<div class="grid-6-12 product-gallery">\s*<ul>([\s\S]*?)<\/ul>\s*<\/div>/;
const LI_RE =
  /<li\s+data-thumb="([^"]+)">\s*<img\b[^>]*\balt="([^"]*)"[^>]*>\s*<\/li>/g;
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

const findProductFiles = () => {
  if (ONLY_FILE) return [path(ONLY_FILE)];
  const results = [];
  for (const name of readdirSync(PRODUCTS_DIR)) {
    if (name === "index.html") continue;
    if (name.endsWith(".html")) results.push(path("products", name));
  }
  return results;
};

const parseGallery = (block) => {
  const images = [];
  const alts = [];
  LI_RE.lastIndex = 0;
  let m;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((m = LI_RE.exec(block)) !== null) {
    images.push(m[1]);
    alts.push(m[2]);
  }
  return { images, alt: alts[0] || "" };
};

const yamlEscape = (s) => {
  if (/[:#&*!|>'"%@`\n]/.test(s) || s.startsWith("-") || s.includes("  ")) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
};

const buildFrontmatterInsert = (alt, images) => {
  const lines = [`galleryAlt: ${yamlEscape(alt)}`, "galleryImages:"];
  for (const img of images) lines.push(`  - ${img}`);
  return lines.join("\n");
};

const rewriteFrontmatter = (content, alt, images) => {
  const m = content.match(FRONTMATTER_RE);
  const insert = buildFrontmatterInsert(alt, images);
  if (!m) return `---\n${insert}\n---\n${content}`;
  const existing = m[1];
  return content.replace(FRONTMATTER_RE, `---\n${existing}\n${insert}\n---\n`);
};

const processFile = async (filepath) => {
  const content = await read(filepath);
  const match = content.match(GALLERY_RE);
  if (!match) return { status: "no-gallery" };

  const [fullMatch, indent, innerUl] = match;
  const { images, alt } = parseGallery(innerUl);
  if (images.length === 0) return { status: "empty-gallery" };

  const replacement = `${indent}{%- include "product-gallery.html" -%}`;
  let next = content.replace(fullMatch, replacement);
  next = rewriteFrontmatter(next, alt, images);

  if (!DRY_RUN) await write(filepath, next);
  return { status: "migrated", count: images.length };
};

const logResult = (file, { status, count }) => {
  const rel = file.replace(`${path()}/`, "");
  if (status === "migrated") console.log(`  ✓ ${rel} (${count} images)`);
  else if (status !== "no-gallery") console.log(`  ⚠ ${rel}: ${status}`);
};

const run = async () => {
  const files = findProductFiles();
  const stats = { migrated: 0, "no-gallery": 0, "empty-gallery": 0 };
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Scanning ${files.length} files\n`);

  for (const file of files) {
    const result = await processFile(file);
    stats[result.status] = (stats[result.status] || 0) + 1;
    logResult(file, result);
  }

  console.log("\nSummary:");
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
};

run();
