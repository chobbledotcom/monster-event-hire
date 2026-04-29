#!/usr/bin/env bun
// One-shot migration: strip noise frontmatter fields from products/*.html and
// categories/*.html where the layout can derive them, and rename to .md.
//
// Each field is dropped only when its explicit value matches the layout's
// fallback default (the next non-null value in the layout's `| default:` chain).
// This guarantees the rendered HTML is byte-identical.

import { readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");

const splitFrontmatter = (raw) => {
  if (!raw.startsWith("---\n")) throw new Error("no frontmatter");
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("unterminated frontmatter");
  return { fm: raw.slice(4, end), body: raw.slice(end + 5) };
};

const parseEntries = (fm) => {
  const lines = fm.split("\n");
  const entries = [];
  let cur = null;
  for (const line of lines) {
    const isTopLevel = /^[A-Za-z_][A-Za-z0-9_]*:/.test(line);
    if (isTopLevel) {
      if (cur) entries.push(cur);
      const colon = line.indexOf(":");
      const key = line.slice(0, colon);
      cur = { key, lines: [line] };
    } else if (cur) {
      cur.lines.push(line);
    } else if (line === "") {
      entries.push({ key: null, lines: [line] });
    }
  }
  if (cur) entries.push(cur);
  return entries;
};

const scalarOf = (entry) => {
  if (!entry || entry.lines.length !== 1) return null;
  const line = entry.lines[0];
  const colon = line.indexOf(":");
  const raw = line.slice(colon + 1).trim();
  if (raw === "") return null;
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
};

const firstListItem = (entry) => {
  if (!entry) return null;
  for (let i = 1; i < entry.lines.length; i++) {
    const m = entry.lines[i].match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
    if (m) return m[1];
  }
  return null;
};

// Returns the first non-null value from a list of candidates.
const firstNonNull = (...vals) => vals.find((v) => v != null) ?? null;

const buildScalarMap = (entries) => {
  const map = new Map();
  for (const e of entries) {
    if (!e.key) continue;
    map.set(e.key, scalarOf(e));
  }
  return map;
};

const dropProductRules = (entries, byKey) => {
  const s = buildScalarMap(entries);
  const drop = new Set();
  const galleryFirst = firstListItem(byKey.get("galleryImages"));

  // primary_image | default: galleryImages[0]
  if (s.get("primary_image") === galleryFirst) drop.add("primary_image");

  // primary_image_caption | default: galleryAlt
  if (s.get("primary_image_caption") === s.get("galleryAlt"))
    drop.add("primary_image_caption");

  // og_image | default: (primary_image we just considered) | default: galleryFirst
  const effectivePrimary = s.get("primary_image") || galleryFirst;
  if (s.get("og_image") === effectivePrimary) drop.add("og_image");
  if (s.get("og_image_width") === s.get("primary_image_width"))
    drop.add("og_image_width");
  if (s.get("og_image_height") === s.get("primary_image_height"))
    drop.add("og_image_height");

  // og_image_type derivable from extension of effective image.
  const effectiveOgImage = s.get("og_image") || effectivePrimary;
  if (s.get("og_image_type") && effectiveOgImage) {
    const ext = effectiveOgImage.split(".").pop().toLowerCase();
    const derived = ext === "png" ? "image/png" : "image/jpeg";
    if (s.get("og_image_type") === derived) drop.add("og_image_type");
  }

  // breadcrumb_name | default: title
  if (s.get("breadcrumb_name") === s.get("title")) drop.add("breadcrumb_name");

  // jsonld_name | default: meta_title | default: title
  const jsonldNameDefault = firstNonNull(s.get("meta_title"), s.get("title"));
  if (s.get("jsonld_name") === jsonldNameDefault) drop.add("jsonld_name");

  // jsonld_breadcrumb_name | default: title
  if (s.get("jsonld_breadcrumb_name") === s.get("title"))
    drop.add("jsonld_breadcrumb_name");

  // date_modified | default: article_modified_time
  if (s.get("date_modified") === s.get("article_modified_time"))
    drop.add("date_modified");

  // twitter_label1 default 'Est. reading time' (always when twitter_data1 set)
  if (s.get("twitter_label1") === "Est. reading time")
    drop.add("twitter_label1");

  // og_type default 'article'; og_title default title; og_description default description.
  if (s.get("og_type") === "article") drop.add("og_type");
  if (s.get("og_title") === s.get("title")) drop.add("og_title");
  if (s.get("og_description") === s.get("description"))
    drop.add("og_description");

  return drop;
};

const dropCategoryRules = (entries, byKey) => {
  const s = buildScalarMap(entries);
  const drop = new Set();

  const title = s.get("title");
  const cat_head_title = s.get("cat_head_title");
  const breadcrumb_name = s.get("breadcrumb_name");

  // breadcrumb_name | default: cat_head_title | default: title
  const breadcrumbDefault = firstNonNull(cat_head_title, title);
  if (breadcrumb_name === breadcrumbDefault) drop.add("breadcrumb_name");

  // jsonld_breadcrumb_name | default: breadcrumb_name | default: cat_head_title | default: title
  const jsonldBreadcrumbDefault = firstNonNull(
    drop.has("breadcrumb_name") ? null : breadcrumb_name,
    cat_head_title,
    title,
  );
  if (s.get("jsonld_breadcrumb_name") === jsonldBreadcrumbDefault)
    drop.add("jsonld_breadcrumb_name");

  // og_title default: (cat_head_title || title) + " Archives"
  const ogTitleDefault = `${cat_head_title || title} Archives`;
  if (s.get("og_title") === ogTitleDefault) drop.add("og_title");

  // og_description | default: description
  if (s.get("og_description") === s.get("description"))
    drop.add("og_description");

  // jsonld_name | default: meta_title | default: title
  const jsonldNameDefault = firstNonNull(s.get("meta_title"), title);
  if (s.get("jsonld_name") === jsonldNameDefault) drop.add("jsonld_name");

  // og_type default 'article'
  if (s.get("og_type") === "article") drop.add("og_type");

  // og_image_type derivable from extension when og_image set.
  const ogImage = s.get("og_image") || s.get("primary_image");
  if (s.get("og_image_type") && ogImage) {
    const ext = ogImage.split(".").pop().toLowerCase();
    const derived = ext === "png" ? "image/png" : "image/jpeg";
    if (s.get("og_image_type") === derived) drop.add("og_image_type");
  }

  return drop;
};

const slimFile = (path, ruleFn) => {
  const raw = readFileSync(path, "utf8");
  const { fm, body } = splitFrontmatter(raw);
  const entries = parseEntries(fm);
  const byKey = new Map();
  for (const e of entries) if (e.key) byKey.set(e.key, e);
  const drop = ruleFn(entries, byKey);
  if (drop.size === 0) return { dropped: 0 };

  const kept = entries.filter((e) => !drop.has(e.key));
  const newFm = kept.map((e) => e.lines.join("\n")).join("\n");
  const out = `---\n${newFm}\n---\n${body}`;
  writeFileSync(path, out);
  return { dropped: drop.size };
};

const renameToMd = (path) => {
  const newPath = path.replace(/\.html$/, ".md");
  renameSync(path, newPath);
  return newPath;
};

const run = () => {
  const stats = { products: 0, categories: 0, dropped: 0 };

  for (const f of readdirSync(join(ROOT, "products"))) {
    if (!f.endsWith(".html") || f === "index.html") continue;
    const path = join(ROOT, "products", f);
    const r = slimFile(path, dropProductRules);
    stats.products += 1;
    stats.dropped += r.dropped;
    renameToMd(path);
  }

  for (const f of readdirSync(join(ROOT, "categories"))) {
    if (!f.endsWith(".html")) continue;
    const path = join(ROOT, "categories", f);
    const r = slimFile(path, dropCategoryRules);
    stats.categories += 1;
    stats.dropped += r.dropped;
    renameToMd(path);
  }

  console.log(stats);
};

run();
