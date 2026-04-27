#!/usr/bin/env bun
// One-shot: replace `json_ld:` literal frontmatter on products with structured
// per-page fields. The new _includes/wp-product-jsonld.html include rebuilds
// the JSON-LD at render time from these fields.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PRODUCTS = join(ROOT, "products");
const SKIP = new Set(["index.html", "products.json"]);

const yamlQuote = (s) => {
  if (s == null) return "null";
  return `'${String(s).replace(/'/g, "''")}'`;
};

const extractJsonLdLine = (fm) => {
  const m = fm.match(/^json_ld:\s*'((?:''|[^'])*)'\s*$/m);
  if (!m) return null;
  return m[1].replace(/''/g, "'");
};

const findFirst = (graph, type) => graph.find((n) => n["@type"] === type);

const findImageNode = (graph) =>
  graph.find(
    (n) =>
      n["@type"] === "ImageObject" && n["@id"]?.endsWith("#primaryimage"),
  );

const lastBreadcrumb = (graph) => {
  const bc = findFirst(graph, "BreadcrumbList");
  if (!bc?.itemListElement?.length) return null;
  const last = bc.itemListElement[bc.itemListElement.length - 1];
  return last?.name ?? null;
};

const splitFrontmatter = (raw) => {
  if (!raw.startsWith("---\n")) return null;
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return null;
  return { fm: raw.slice(4, end), body: raw.slice(end + 5) };
};

const fmHas = (fm, key) => new RegExp(`(^|\\n)${key}\\s*:`).test(fm);

const dejsonOne = (path) => {
  const raw = readFileSync(path, "utf8");
  const split = splitFrontmatter(raw);
  if (!split) return { path, skipped: "no-frontmatter" };
  const { fm, body } = split;

  const ldStr = extractJsonLdLine(fm);
  if (!ldStr) return { path, skipped: "no-json-ld" };

  let parsed;
  try {
    parsed = JSON.parse(ldStr);
  } catch {
    return { path, skipped: "json-parse-failed" };
  }
  const graph = parsed["@graph"];
  if (!Array.isArray(graph)) return { path, skipped: "no-graph" };

  const page = findFirst(graph, "WebPage") ?? findFirst(graph, "ItemPage");
  const img = findImageNode(graph);
  const crumb = lastBreadcrumb(graph);

  const additions = [];
  if (page?.datePublished && !fmHas(fm, "date_published")) {
    additions.push(`date_published: ${yamlQuote(page.datePublished)}`);
  }
  if (page?.dateModified && !fmHas(fm, "date_modified")) {
    additions.push(`date_modified: ${yamlQuote(page.dateModified)}`);
  }
  if (page?.name && !fmHas(fm, "jsonld_name")) {
    additions.push(`jsonld_name: ${yamlQuote(page.name)}`);
  }
  if (crumb && !fmHas(fm, "jsonld_breadcrumb_name")) {
    additions.push(`jsonld_breadcrumb_name: ${yamlQuote(crumb)}`);
  }
  if (img) {
    if (!fmHas(fm, "primary_image"))
      additions.push(`primary_image: ${yamlQuote(img.url)}`);
    if (!fmHas(fm, "primary_image_width"))
      additions.push(`primary_image_width: ${img.width}`);
    if (!fmHas(fm, "primary_image_height"))
      additions.push(`primary_image_height: ${img.height}`);
    if (img.caption && !fmHas(fm, "primary_image_caption"))
      additions.push(`primary_image_caption: ${yamlQuote(img.caption)}`);
  }

  const newFm = fm
    .split("\n")
    .filter((l) => !l.startsWith("json_ld:"))
    .concat(additions)
    .filter((l) => l !== "")
    .join("\n");
  writeFileSync(path, `---\n${newFm}\n---\n${body}`);
  return { path, ok: true, hasImage: !!img };
};

const main = () => {
  const files = readdirSync(PRODUCTS).filter(
    (f) => f.endsWith(".html") && !SKIP.has(f),
  );
  const results = files.map((f) => dejsonOne(join(PRODUCTS, f)));
  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`De-jsonified ${ok.length}/${files.length} products`);
  if (skipped.length) console.log("Skipped:", skipped.length, skipped.slice(0, 5));
  console.log(`With primary image: ${ok.filter((r) => r.hasImage).length}`);
};

main();
