#!/usr/bin/env bun
// One-shot extraction: scan all .html in this repo for product card occurrences,
// build _data/wpCards.json mapping slug -> {id, image, description, sku, productID, title}.
// Used by the layout/include refactor to render product cards from data instead of inline HTML.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const SCAN_DIRS = ["products", "categories", "areas-covered", "_includes", "."];

const findHtmlFiles = (dir, files = []) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (
      e.name.startsWith(".") ||
      e.name === "node_modules" ||
      e.name === "_site" ||
      e.name === ".build" ||
      e.name === "chobble-template"
    )
      continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) findHtmlFiles(p, files);
    else if (e.name.endsWith(".html")) files.push(p);
  }
  return files;
};

const extractFrom = (html) => {
  const cards = {};
  // Match grid-3-12 style cards: <div class="grid-3-12" itemscope ... <div id="ID" class="product" data-img="IMG"> ... <h3 itemprop="name">TITLE</h3> ... <span itemprop="image">IMG</span> ... <span itemprop="sku">SKU</span> <span itemprop="productID">PID</span> ... <a itemprop="url" href="/products/SLUG/">
  const cardRe =
    /<div\s+id="([^"]+)"\s+class="product"\s+data-img="([^"]+)"[\s\S]*?<a itemprop="url" href="\/products\/([^"/]+)\/?">[\s\S]*?<h3 itemprop="name">([^<]+)<\/h3>[\s\S]*?<span class="item-data"><span itemprop="description">[^<]*<\/span><\/span>\s*<p>\s*<span class="item-data">([\s\S]*?)<\/span>\s*<\/p>\s*<span itemprop="image">([^<]*)<\/span>\s*<span itemprop="sku">([^<]*)<\/span>\s*<span itemprop="productID">([^<]*)<\/span>/g;
  let m;
  while ((m = cardRe.exec(html))) {
    const [, cardId, dataImg, slug, title, description, image, sku, productID] =
      m;
    if (!cards[slug]) {
      cards[slug] = {
        id: cardId,
        image: dataImg,
        title,
        description,
        productImage: image,
        sku,
        productID,
      };
    }
  }
  // Also match featured/area-style cards (different structure) — not implemented
  return cards;
};

const main = () => {
  const allCards = {};
  let totalOccurrences = 0;
  for (const dir of SCAN_DIRS) {
    const target = join(ROOT, dir);
    try {
      statSync(target);
    } catch {
      continue;
    }
    const files =
      dir === "."
        ? findHtmlFiles(target).filter(
            (f) =>
              !f.includes("/_") &&
              !f.includes("/products/") &&
              !f.includes("/categories/") &&
              !f.includes("/areas-covered/") &&
              !f.includes("/_site/") &&
              !f.includes("/.build/") &&
              !f.includes("/chobble-template/") &&
              !f.includes("/node_modules/"),
          )
        : findHtmlFiles(target);
    for (const f of files) {
      const html = readFileSync(f, "utf8");
      const cards = extractFrom(html);
      for (const [slug, card] of Object.entries(cards)) {
        totalOccurrences++;
        if (!allCards[slug]) allCards[slug] = card;
      }
    }
  }
  const out = join(ROOT, "_data/wpCards.json");
  writeFileSync(out, `${JSON.stringify(allCards, null, 2)}\n`);
  console.log(
    `Wrote ${Object.keys(allCards).length} unique product cards (${totalOccurrences} occurrences) to ${out}`,
  );
};

main();
