#!/usr/bin/env bun
// Build _data/wpCards.json mapping slug -> {id, image, title, description, productImage, sku, productID}
// from the product .md frontmatter (the source of truth).
//
// The card slug (and JSON key) is the product filename without .md, matching the URL the layout links to.
// `id` and the `<original-id>-<sku>` productID preserve the original WordPress div id so the rendered
// HTML (id="..." on the product card) keeps matching the legacy markup.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PRODUCTS_DIR = join(ROOT, "products");
const OUT = join(ROOT, "_data/wpCards.json");

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

const matchField = (fm, name) => {
  const re = new RegExp(`^${name}:\\s*(.+?)\\s*$`, "m");
  const m = fm.match(re);
  if (!m) return null;
  return m[1].replace(/^['"]|['"]$/g, "");
};

const matchListFirst = (fm, name) => {
  const re = new RegExp(`^${name}:\\s*\\n((?:\\s+-\\s+.+\\n?)+)`, "m");
  const m = fm.match(re);
  if (!m) return null;
  const first = m[1].split("\n")[0];
  const item = first.match(/^\s+-\s+(.+?)\s*$/);
  if (!item) return null;
  return item[1].replace(/^['"]|['"]$/g, "");
};

const parseBodyClass = (bodyClass) => {
  if (!bodyClass) return { originalId: null, sku: null };
  const sku = bodyClass.match(/postid-(\d+)/)?.[1] ?? null;
  // The original WP body slug is the last token after "wp-theme-littlemonsters".
  const tail =
    bodyClass.match(/wp-theme-littlemonsters\s+([\w-]+)/)?.[1] ?? null;
  return { originalId: tail, sku };
};

const buildDescription = (shareDescription) => {
  if (!shareDescription) return "";
  // Match the legacy WP excerpt convention: append &hellip; unless the source
  // already ends with sentence-ending punctuation.
  if (/[.!?]$/.test(shareDescription)) return shareDescription;
  return `${shareDescription}&hellip;`;
};

const buildCard = (slug, fm) => {
  const name = matchField(fm, "name") ?? matchField(fm, "title");
  const image = matchListFirst(fm, "galleryImages");
  const bodyClass = matchField(fm, "body_class");
  const shareDescription = matchField(fm, "share_description");
  const { originalId, sku } = parseBodyClass(bodyClass);

  if (!name || !image) {
    console.warn(`SKIP ${slug}: missing name or galleryImages`);
    return null;
  }

  const id = originalId ?? slug;
  const productID = sku ? `${id}-${sku}` : id;

  return {
    id,
    image,
    title: name,
    description: buildDescription(shareDescription),
    productImage: image,
    sku: sku ?? "",
    productID,
  };
};

const main = () => {
  const cards = {};
  const files = readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const slug = file.slice(0, -3);
    const text = readFileSync(join(PRODUCTS_DIR, file), "utf8");
    const m = text.match(FRONTMATTER_RE);
    if (!m) {
      console.warn(`SKIP ${slug}: no frontmatter`);
      continue;
    }
    const card = buildCard(slug, m[1]);
    if (card) cards[slug] = card;
  }

  // Sort keys for stable output.
  const sorted = Object.fromEntries(
    Object.keys(cards)
      .sort()
      .map((k) => [k, cards[k]]),
  );

  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Wrote ${Object.keys(sorted).length} product cards to ${OUT}`);
};

main();
