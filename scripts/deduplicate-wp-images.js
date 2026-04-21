#!/usr/bin/env bun

/**
 * One-time migration: deduplicates WordPress upload images.
 *
 * WordPress generates multiple size variants for every uploaded image
 * (e.g. rodeo-bull-150x150.jpg, rodeo-bull-500x500.jpg, rodeo-bull.jpg).
 * This script:
 *   1. Copies original images to images/uploads/ so Eleventy's {% image %}
 *      transform processes them into responsive picture elements.
 *   2. Deletes the WordPress-generated resize variants (the duplicates).
 *   3. Updates <img src> in Eleventy-processed HTML to /images/uploads/ paths.
 *   4. Strips srcset attributes (Eleventy generates proper responsive srcsets).
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, extname, join, relative } from "node:path";
import { path, read, write } from "./utils.js";

const UPLOADS_DIR = path("wp-content", "uploads");
const IMAGES_DIR = path("images", "uploads");

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);

// Directories copied as Eleventy passthrough — transforms don't run on them
const PASSTHROUGH_DIRS = new Set([
  "wp-content",
  "wp-includes",
  "theme",
]);

// WordPress appends -WxH before the extension for resized variants
const RESIZE_RE = /-\d+x\d+$/;

const isImageFile = (name) => IMAGE_EXTS.has(extname(name).toLowerCase());

const isResizeVariant = (name) => RESIZE_RE.test(basename(name, extname(name)));

const walkFiles = (dir) => {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(p));
    else results.push(p);
  }
  return results;
};

const getEleventyHtmlFiles = (rootDir) => {
  const results = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (PASSTHROUGH_DIRS.has(entry.name)) continue;
    const p = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(p).filter((f) => f.endsWith(".html")));
    } else if (entry.name.endsWith(".html")) {
      results.push(p);
    }
  }
  return results;
};

// Match any wp-content/uploads URL token ending in YYYY/MM/filename.
// A URL token runs up to the next quote, whitespace, angle bracket, or paren —
// so this matches src/href attributes, JSON-LD strings, CSS url(), and raw
// text URLs (e.g. inside <div itemprop="image">URL</div>) alike. The greedy
// prefix also collapses the nested wp-content/themes/.../wp-content/uploads/
// case into a single clean /images/uploads/ path.
const UPLOAD_URL_RE =
  /[^\s"'<>()]*wp-content\/uploads\/(\d{4}\/\d{2}\/)([^\s"'<>?#()]+)/g;

const rewriteUploadUrls = (html) =>
  html.replace(UPLOAD_URL_RE, (_, yearMonth, fileWithExt) => {
    const ext = extname(fileWithExt);
    const base = basename(fileWithExt, ext).replace(RESIZE_RE, "");
    return `/images/uploads/${yearMonth}${base}${ext}`;
  });

// Strip srcset (Eleventy generates its own) then rewrite every upload URL.
const updateHtml = (html) => {
  const noSrcset = html.replace(
    /\s+srcset=(["'])[^"']*wp-content\/uploads[^"']*\1/gi,
    "",
  );
  return rewriteUploadUrls(noSrcset);
};

const main = async () => {
  // Step 1: categorise upload images
  const allFiles = walkFiles(UPLOADS_DIR);
  const images = allFiles.filter((f) => isImageFile(basename(f)));
  const originals = images.filter((f) => !isResizeVariant(basename(f)));
  const resizeVariants = images.filter((f) => isResizeVariant(basename(f)));

  console.log(
    `Found ${originals.length} originals and ${resizeVariants.length} resize variants`,
  );

  // Step 2: copy originals to images/uploads/ (maintaining YYYY/MM structure)
  console.log("\nCopying originals to images/uploads/...");
  let copied = 0;
  for (const file of originals) {
    const rel = relative(UPLOADS_DIR, file);
    const dest = join(IMAGES_DIR, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (!existsSync(dest)) {
      cpSync(file, dest);
      copied++;
    }
  }
  console.log(
    `Copied ${copied} files (${originals.length - copied} already existed)`,
  );

  // Step 3: delete resize variants (they are now redundant)
  console.log("\nDeleting resize variants...");
  for (const file of resizeVariants) rmSync(file);
  console.log(`Deleted ${resizeVariants.length} files`);

  // Step 4: update <img src>, data-img, and background-image in Eleventy HTML
  console.log("\nUpdating HTML img references...");
  const htmlFiles = getEleventyHtmlFiles(path());
  let updatedCount = 0;
  for (const htmlFile of htmlFiles) {
    const before = await read(htmlFile);
    const after = updateHtml(before);
    if (before !== after) {
      await write(htmlFile, after);
      updatedCount++;
    }
  }
  console.log(`Updated ${updatedCount} HTML files`);
  console.log("\nDone!");
};

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
