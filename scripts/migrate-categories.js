#!/usr/bin/env bun
// One-shot category migration. For each categories/*.html (except categories.json):
// extract per-page metadata (head, body class, JSON-LD, banner image, intro html,
// product slug list) into frontmatter, then truncate inline body so the new
// _layouts/wp-category.html can reconstruct the page.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const CATEGORIES = join(ROOT, "categories");
const SKIP = new Set(["categories.json"]);

const splitFrontmatter = (raw) => {
  if (!raw.startsWith("---\n")) throw new Error("no frontmatter");
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("unterminated frontmatter");
  return { fm: raw.slice(4, end), body: raw.slice(end + 5) };
};

const cleanLiquid = (v) => (v?.includes("{{") ? null : v);
const metaContent = (html, attr, value) => {
  const re = new RegExp(
    `<meta\\s+${attr}=['"]${value}['"]\\s+content=['"]([^'"]*)['"]`,
    "i",
  );
  const m = html.match(re);
  return m ? cleanLiquid(m[1]) : null;
};

const extractTitle = (html) => {
  const m = html.match(/<title>([^<]+)<\/title>/);
  return m ? m[1] : null;
};

const extractBodyClass = (html) => {
  const m = html.match(/<body\s+([^>]*)class="([^"]*)"/);
  return m ? m[2] : null;
};

const extractHtmlItemtype = (html) => {
  const m = html.match(/<html[^>]*itemtype="([^"]*)"/);
  return m ? m[1] : null;
};

const extractMetaItemtype = (html) => {
  const m = html.match(/<section[^>]*itemtype="([^"]*)"/);
  return m ? m[1] : null;
};

const extractJsonLd = (html) => {
  const m = html.match(
    /<script type="application\/ld\+json" class="yoast-schema-graph">\s*([\s\S]*?)\s*<\/script>/,
  );
  return m ? m[1].trim() : null;
};

const extractBreadcrumbName = (html, fileSlug) => {
  const re = new RegExp(
    `<span class="breadcrumb-${fileSlug}"[^>]*>[\\s\\S]*?<span itemprop="name">([^<]+)<\\/span>`,
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

const extractCatHead = (html) => {
  const m = html.match(
    /<div class="cat-head" style="([^"]*)">\s*<div class="wrapper editable-area">\s*<h1 class="title" itemprop="name">([^<]+)<\/h1>\s*<p itemprop="text"><\/p>\s*([\s\S]*?)\s*<\/div>\s*<\/div>/,
  );
  if (!m) return null;
  return { style: m[1], title: m[2], intro: m[3].trim() };
};

const extractLoopClass = (html) => {
  const m = html.match(/<div class="loop-holder products wrapper([^"]*)">/);
  return m ? m[1].trim() : "";
};

const extractDuplicateIntro = (html) => {
  // The cat-body has a duplicated intro: <div class="loop-holder products wrapper {classes}"> ... <h1>...</h1>...intro html.... </div>
  const m = html.match(
    /<div class="cat-body[^"]*">\s*<div class="cat-body[^"]*">\s*<div class="loop-holder products wrapper[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<\/div>\s*<\/div>/,
  );
  return m ? m[1].trim() : null;
};

const dedupePreserveOrder = (arr) => {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
};

const extractProductSlugs = (html) => {
  // Find the product cards loop section, extract slugs in order
  const sec = html.match(
    /<div class="loop gutters row clearfix">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/,
  );
  if (!sec) return [];
  const slugs = [
    ...sec[1].matchAll(/<a itemprop="url" href="\/products\/([^"/]+)\/?">/g),
  ].map((r) => r[1]);
  return dedupePreserveOrder(slugs);
};

const yamlQuote = (s) => {
  if (s == null) return "null";
  return `'${String(s).replace(/'/g, "''")}'`;
};

const yamlBlock = (s, indent = "  ") => {
  const lines = String(s).split("\n");
  return `|-\n${lines.map((l) => `${indent}${l}`).join("\n")}`;
};

const yamlList = (arr, indent = "  ") => {
  if (!arr?.length) return "[]";
  return `\n${arr.map((s) => `${indent}- ${yamlQuote(s)}`).join("\n")}`;
};

const appendFrontmatter = (fm, additions) => {
  let out = fm;
  for (const { key, valueYaml } of additions) {
    const has = new RegExp(`(^|\\n)${key}\\s*:`).test(fm);
    if (has) continue;
    if (!out.endsWith("\n")) out += "\n";
    out += `${key}: ${valueYaml}\n`;
  }
  return out;
};

const migrateOne = (filename) => {
  const path = join(CATEGORIES, filename);
  const raw = readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = splitFrontmatter(raw);
  } catch {
    return { filename, skipped: "no-frontmatter" };
  }
  if (/\nlayout:\s*wp-category\.html/.test(parsed.fm)) {
    return { filename, skipped: "already-migrated" };
  }
  const html = parsed.body;
  const additions = [];
  additions.push({ key: "layout", valueYaml: "wp-category.html" });

  const title = extractTitle(html);
  if (title) additions.push({ key: "title", valueYaml: yamlQuote(title) });
  const description = metaContent(html, "name", "description");
  if (description)
    additions.push({ key: "description", valueYaml: yamlQuote(description) });

  const bodyClass = extractBodyClass(html);
  if (bodyClass)
    additions.push({ key: "body_class", valueYaml: yamlQuote(bodyClass) });

  const itemtype = extractHtmlItemtype(html);
  if (itemtype && itemtype !== "https://schema.org/CollectionPage") {
    additions.push({ key: "schema_type", valueYaml: yamlQuote(itemtype) });
  }
  const sectionItemtype = extractMetaItemtype(html);
  if (
    sectionItemtype &&
    sectionItemtype !== "https://schema.org/WebPageElement"
  ) {
    additions.push({
      key: "section_type",
      valueYaml: yamlQuote(sectionItemtype),
    });
  }

  // OG and Twitter meta tags
  const og = (k) => metaContent(html, "property", k);
  const tw = (k) => metaContent(html, "name", k);
  const fields = [
    ["og_type", og("og:type")],
    ["og_title", og("og:title")],
    ["og_description", og("og:description")],
    ["og_image", og("og:image")],
    ["og_image_width", og("og:image:width")],
    ["og_image_height", og("og:image:height")],
    ["og_image_type", og("og:image:type")],
    ["twitter_title", tw("twitter:title")],
    ["twitter_label1", tw("twitter:label1")],
    ["twitter_data1", tw("twitter:data1")],
  ];
  for (const [key, val] of fields) {
    if (val)
      additions.push({
        key,
        valueYaml: /^\d+$/.test(val) ? val : yamlQuote(val),
      });
  }

  const jsonLd = extractJsonLd(html);
  if (jsonLd) additions.push({ key: "json_ld", valueYaml: yamlQuote(jsonLd) });

  const fileSlug = filename.replace(/\.html$/, "");
  const bcName = extractBreadcrumbName(html, fileSlug);
  if (bcName)
    additions.push({ key: "breadcrumb_name", valueYaml: yamlQuote(bcName) });

  const head = extractCatHead(html);
  if (head) {
    additions.push({ key: "cat_head_style", valueYaml: yamlQuote(head.style) });
    additions.push({ key: "cat_head_title", valueYaml: yamlQuote(head.title) });
    additions.push({
      key: "cat_head_intro_html",
      valueYaml: yamlBlock(head.intro),
    });
  }

  const dupIntro = extractDuplicateIntro(html);
  if (dupIntro && (!head || dupIntro !== head.intro)) {
    additions.push({
      key: "cat_body_intro_html",
      valueYaml: yamlBlock(dupIntro),
    });
  }

  const loopClass = extractLoopClass(html);
  if (loopClass)
    additions.push({ key: "loop_class", valueYaml: yamlQuote(loopClass) });

  const slugs = extractProductSlugs(html);
  if (slugs.length)
    additions.push({ key: "product_slugs", valueYaml: yamlList(slugs) });

  const newFm = appendFrontmatter(parsed.fm, additions);
  writeFileSync(path, `---\n${newFm}---\n`);
  return { filename, ok: true, slugCount: slugs.length };
};

const main = () => {
  const files = readdirSync(CATEGORIES).filter(
    (f) => f.endsWith(".html") && !SKIP.has(f),
  );
  const results = files.map(migrateOne);
  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`Migrated ${ok.length}/${files.length} categories`);
  if (skipped.length) console.log("Skipped:", skipped);
  const noSlugs = ok.filter((r) => r.slugCount === 0).map((r) => r.filename);
  if (noSlugs.length) console.log("No product slugs in:", noSlugs);
};

main();
