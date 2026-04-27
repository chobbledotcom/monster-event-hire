#!/usr/bin/env bun
// One-shot area migration. For each areas-covered/*/index.html:
// extract per-page metadata into frontmatter, replace body with just the inner
// loc-content text block (which itself is HTML+Liquid). The new wp-area layout
// wraps it back up in head/breadcrumbs/sidebar/footer.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AREAS = join(ROOT, "areas-covered");

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
const extractPageTitle = (html) => {
  const m = html.match(/<h1 class="page-title title">([^<]+)<\/h1>/);
  return m ? m[1].trim() : null;
};
const extractInnerText = (html) => {
  // <div itemprop="text"> .... </div>  inside loc-content. We capture inner.
  const m = html.match(
    /<div itemprop="text">([\s\S]*?)<\/div>\s*<\/div>\s*<div class="divider">/,
  );
  return m ? m[1] : null;
};

const yamlQuote = (s) => {
  if (s == null) return "null";
  return `'${String(s).replace(/'/g, "''")}'`;
};
const appendFrontmatter = (fm, additions) => {
  let out = fm;
  for (const { key, valueYaml } of additions) {
    if (new RegExp(`(^|\\n)${key}\\s*:`).test(fm)) continue;
    if (!out.endsWith("\n")) out += "\n";
    out += `${key}: ${valueYaml}\n`;
  }
  return out;
};

const migrateOne = (path, fileSlug) => {
  const raw = readFileSync(path, "utf8");
  let parsed;
  try {
    parsed = splitFrontmatter(raw);
  } catch {
    return { path, skipped: "no-frontmatter" };
  }
  if (/\nlayout:\s*wp-area\.html/.test(parsed.fm)) {
    return { path, skipped: "already-migrated" };
  }
  const html = parsed.body;
  const additions = [];
  additions.push({ key: "layout", valueYaml: "wp-area.html" });

  const title = extractTitle(html);
  if (title) additions.push({ key: "meta_title", valueYaml: yamlQuote(title) });
  const description = metaContent(html, "name", "description");
  if (description)
    additions.push({ key: "description", valueYaml: yamlQuote(description) });
  const bc = extractBreadcrumbName(html, fileSlug);
  if (bc) additions.push({ key: "breadcrumb_name", valueYaml: yamlQuote(bc) });
  const pt = extractPageTitle(html);
  if (pt) additions.push({ key: "page_title", valueYaml: yamlQuote(pt) });

  const bodyClass = extractBodyClass(html);
  if (bodyClass)
    additions.push({ key: "body_class", valueYaml: yamlQuote(bodyClass) });

  const itemtype = extractHtmlItemtype(html);
  if (itemtype && itemtype !== "https://schema.org/CollectionPage") {
    additions.push({ key: "schema_type", valueYaml: yamlQuote(itemtype) });
  }

  const og = (k) => metaContent(html, "property", k);
  const fields = [
    ["og_type", og("og:type")],
    ["og_title", og("og:title")],
    ["og_description", og("og:description")],
    ["og_image", og("og:image")],
  ];
  for (const [key, val] of fields) {
    if (val) additions.push({ key, valueYaml: yamlQuote(val) });
  }

  const jsonLd = extractJsonLd(html);
  if (jsonLd) additions.push({ key: "json_ld", valueYaml: yamlQuote(jsonLd) });

  const inner = extractInnerText(html);
  const newFm = appendFrontmatter(parsed.fm, additions);
  const newBody = inner ?? "";
  writeFileSync(path, `---\n${newFm}---\n${newBody.trim()}\n`);
  return { path, ok: true, hasInner: !!inner };
};

const main = () => {
  const dirs = readdirSync(AREAS, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  );
  const results = dirs.map((d) => {
    const p = join(AREAS, d.name, "index.html");
    try {
      statSync(p);
    } catch {
      return { path: p, skipped: "no-index" };
    }
    return migrateOne(p, d.name);
  });
  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`Migrated ${ok.length}/${dirs.length} areas`);
  if (skipped.length) console.log("Skipped:", skipped);
  const noInner = ok.filter((r) => !r.hasInner).map((r) => r.path);
  if (noInner.length) console.log("No inner text in:", noInner);
};

main();
