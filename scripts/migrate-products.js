#!/usr/bin/env bun
// One-shot product migration. For each products/*.html (except index.html):
// 1. Parse frontmatter + body
// 2. Extract per-page metadata from the inline HTML body (og:*, body class, json-ld,
//    testimonial, upsells, item_data, share_description, etc.)
// 3. Write back: frontmatter (existing + extracted) + body markdown only.
//    The new frontmatter sets `layout: wp-product.html` so the new layout reconstructs the page.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const PRODUCTS = join(ROOT, "products");

const SKIP = new Set(["index.html", "products.json"]);

// Parse YAML-ish frontmatter manually (avoid pulling in deps). The body field
// is a multiline `body: |-` block; we capture it verbatim.
const splitFrontmatter = (raw) => {
  if (!raw.startsWith("---\n")) throw new Error("no frontmatter");
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("unterminated frontmatter");
  return { fm: raw.slice(4, end), body: raw.slice(end + 5) };
};

// Trailing whitespace-trimmed string
const trim = (s) => (s ?? "").trim();

// Captures `<meta name="..." content="VAL">` or `<meta property="..." content="VAL">`.
// Returns null if VAL contains a Liquid expression (already templated; layout handles default).
const cleanLiquid = (v) => (v?.includes("{{") ? null : v);
const metaContent = (html, attr, value) => {
  const re = new RegExp(
    `<meta\\s+${attr}=['"]${value}['"]\\s+content=['"]([^'"]*)['"]`,
    "i",
  );
  const m = html.match(re);
  return m ? cleanLiquid(m[1]) : null;
};

// Match in either order (content before name/property)
const metaContentEither = (html, attr, value) => {
  const a = metaContent(html, attr, value);
  if (a) return a;
  const re = new RegExp(
    `<meta\\s+content=['"]([^'"]*)['"]\\s+${attr}=['"]${value}['"]`,
    "i",
  );
  const m = html.match(re);
  return m ? cleanLiquid(m[1]) : null;
};

const extractBodyClass = (html) => {
  const m = html.match(/<body\s+([^>]*)class="([^"]*)"/);
  return m ? m[2] : null;
};

const extractHtmlItemtype = (html) => {
  const m = html.match(/<html[^>]*itemtype="([^"]*)"/);
  return m ? m[1] : null;
};

const extractJsonLd = (html) => {
  const m = html.match(
    /<script type="application\/ld\+json" class="yoast-schema-graph">\s*([\s\S]*?)\s*<\/script>/,
  );
  return m ? trim(m[1]) : null;
};

const extractShareDescription = (html) => {
  const m = html.match(/\{%\s*assign\s+shareDescription\s*=\s*"([^"]*)"\s*%\}/);
  return m ? m[1] : null;
};

const extractItemData = (html) => {
  // <ul class="item-data">...<li>X</li>...</ul>
  const m = html.match(/<ul class="item-data">([\s\S]*?)<\/ul>/);
  if (!m) return [];
  return [...m[1].matchAll(/<li>([^<]*)<\/li>/g)].map((r) => r[1]);
};

const extractTestimonial = (html) => {
  const m = html.match(
    /<div class="testimonial">\s*<div class="wrapper">\s*<div class="testimonial-body">([\s\S]*?)<\/div>\s*<div class="testimonial-client-name">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/,
  );
  if (!m) return null;
  const body = trim(m[1]);
  const nameBlock = trim(m[2]);
  // Expected forms:
  //   "Name & Surname, <em class="orange">Role</em>"
  //   "Francesca Olle <em class="orange">Highfield School</em>"
  const em = nameBlock.match(
    /^([\s\S]*?)\s*<em class="orange">([\s\S]*?)<\/em>\s*$/,
  );
  if (em) {
    return {
      body,
      attribution: trim(em[1]).replace(/,\s*$/, ""),
      attribution_role: trim(em[2]),
    };
  }
  return { body, attribution: nameBlock, attribution_role: "" };
};

const extractUpsells = (html) => {
  // Find the upsell section, then 4 product hrefs
  const sec = html.match(
    /<div class="upsell light-grey-bg">([\s\S]*?)<\/section>/,
  );
  if (!sec) return [];
  return [
    ...sec[1].matchAll(/<a itemprop="url" href="\/products\/([^"/]+)\/?">/g),
  ]
    .map((r) => r[1])
    .slice(0, 4);
};

// Extract the self-breadcrumb name (the last crumb's <span itemprop="name"> text).
// Most products have title == breadcrumb-name, but some products with `title: "X hire"`
// use `breadcrumb-name: X` (without "hire").
const extractBreadcrumbSelfName = (html, fileSlug) => {
  const re = new RegExp(
    `<span class="breadcrumb-${fileSlug}"[^>]*>[\\s\\S]*?<span itemprop="name">([^<]+)<\\/span>`,
  );
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

// Replace `body: |-` (or |+) frontmatter block — must preserve indentation and content
// We don't try to parse YAML; instead we treat frontmatter as raw text, append new keys.
const appendFrontmatter = (fm, additions) => {
  let out = fm;
  // Each addition is { key, valueYaml } — appended unless key already present
  for (const { key, valueYaml } of additions) {
    const has = new RegExp(`(^|\\n)${key}\\s*:`).test(fm);
    if (has) continue;
    if (!out.endsWith("\n")) out += "\n";
    out += `${key}: ${valueYaml}\n`;
  }
  return out;
};

// YAML-quote a string. Always use single-quoted style (escape '' inside).
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

const migrateOne = (filename) => {
  const path = join(PRODUCTS, filename);
  const raw = readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = splitFrontmatter(raw);
  } catch {
    return { filename, skipped: "no-frontmatter" };
  }

  // If already migrated (has layout: wp-product.html), skip
  if (
    /\nlayout:\s*wp-product\.html/.test(parsed.fm) ||
    /^layout:\s*wp-product\.html/.test(parsed.fm)
  ) {
    return { filename, skipped: "already-migrated" };
  }

  const html = parsed.body;

  const bodyClass = extractBodyClass(html);
  const itemtype = extractHtmlItemtype(html);
  const ogImage = metaContentEither(html, "property", "og:image");
  const ogImageWidth = metaContentEither(html, "property", "og:image:width");
  const ogImageHeight = metaContentEither(html, "property", "og:image:height");
  const ogImageType = metaContentEither(html, "property", "og:image:type");
  const ogType = metaContentEither(html, "property", "og:type");
  const ogTitle = metaContentEither(html, "property", "og:title");
  const ogDescription = metaContentEither(html, "property", "og:description");
  const articleModified = metaContentEither(
    html,
    "property",
    "article:modified_time",
  );
  const twitterLabel1 = metaContentEither(html, "name", "twitter:label1");
  const twitterData1 = metaContentEither(html, "name", "twitter:data1");
  const twitterTitle = metaContentEither(html, "name", "twitter:title");
  const jsonLd = extractJsonLd(html);
  const shareDescription = extractShareDescription(html);
  const itemData = extractItemData(html);
  const testimonial = extractTestimonial(html);
  const upsells = extractUpsells(html);
  const fileSlug = filename.replace(/\.html$/, "");
  const bcSelfName = extractBreadcrumbSelfName(html, fileSlug);

  const additions = [];
  additions.push({ key: "layout", valueYaml: "wp-product.html" });
  if (itemtype && itemtype !== "http://schema.org/ItemPage") {
    additions.push({ key: "schema_type", valueYaml: yamlQuote(itemtype) });
  }
  if (bodyClass)
    additions.push({ key: "body_class", valueYaml: yamlQuote(bodyClass) });
  if (ogType && ogType !== "article")
    additions.push({ key: "og_type", valueYaml: yamlQuote(ogType) });
  if (ogTitle)
    additions.push({ key: "og_title", valueYaml: yamlQuote(ogTitle) });
  if (ogDescription)
    additions.push({
      key: "og_description",
      valueYaml: yamlQuote(ogDescription),
    });
  if (ogImage)
    additions.push({ key: "og_image", valueYaml: yamlQuote(ogImage) });
  if (ogImageWidth)
    additions.push({ key: "og_image_width", valueYaml: ogImageWidth });
  if (ogImageHeight)
    additions.push({ key: "og_image_height", valueYaml: ogImageHeight });
  if (ogImageType)
    additions.push({ key: "og_image_type", valueYaml: yamlQuote(ogImageType) });
  if (articleModified)
    additions.push({
      key: "article_modified_time",
      valueYaml: yamlQuote(articleModified),
    });
  if (twitterLabel1)
    additions.push({
      key: "twitter_label1",
      valueYaml: yamlQuote(twitterLabel1),
    });
  if (twitterData1)
    additions.push({
      key: "twitter_data1",
      valueYaml: yamlQuote(twitterData1),
    });
  if (twitterTitle)
    additions.push({
      key: "twitter_title",
      valueYaml: yamlQuote(twitterTitle),
    });
  if (shareDescription)
    additions.push({
      key: "share_description",
      valueYaml: yamlQuote(shareDescription),
    });
  if (itemData.length)
    additions.push({ key: "item_data", valueYaml: yamlList(itemData) });
  if (upsells.length)
    additions.push({ key: "upsells", valueYaml: yamlList(upsells) });
  if (jsonLd) {
    // Single-line JSON; quote it. JSON-LD already has no single quotes typically.
    additions.push({ key: "json_ld", valueYaml: yamlQuote(jsonLd) });
  }
  if (testimonial) {
    additions.push({
      key: "testimonial_body",
      valueYaml: yamlBlock(testimonial.body, "  "),
    });
    additions.push({
      key: "testimonial_attribution",
      valueYaml: yamlQuote(testimonial.attribution),
    });
    if (testimonial.attribution_role) {
      additions.push({
        key: "testimonial_role",
        valueYaml: yamlQuote(testimonial.attribution_role),
      });
    }
  }
  // Only emit breadcrumb_name if it differs from title (saves frontmatter size)
  if (bcSelfName) {
    additions.push({
      key: "breadcrumb_name",
      valueYaml: yamlQuote(bcSelfName),
    });
  }

  const newFm = appendFrontmatter(parsed.fm, additions);
  const newRaw = `---\n${newFm}---\n`;
  writeFileSync(path, newRaw);
  return { filename, ok: true };
};

const main = () => {
  const files = readdirSync(PRODUCTS).filter(
    (f) => f.endsWith(".html") && !SKIP.has(f),
  );
  const results = files.map(migrateOne);
  const ok = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped);
  console.log(`Migrated ${ok}/${files.length} products`);
  if (skipped.length) console.log("Skipped:", skipped);
};

main();
