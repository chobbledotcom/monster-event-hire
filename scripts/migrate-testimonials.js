#!/usr/bin/env bun
// One-shot testimonial migration. Reads every legacy
// testimonials/index.html and testimonials/page/N/index.html, extracts each
// .testimonial-item block, and writes one markdown file per testimonial into
// reviews/. Sequential dates are written into frontmatter so the reviews
// collection (sorted by date desc) preserves the original on-page order.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { path } from "./utils.js";

const TESTIMONIALS_DIR = path("testimonials");
const REVIEWS_DIR = path("reviews");
const PAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const PAGE_SIZE = 4;

const ENTITIES = {
  "&#8216;": "‘",
  "&#8217;": "’",
  "&#8220;": "“",
  "&#8221;": "”",
  "&#8211;": "–",
  "&#8212;": "—",
  "&#8230;": "…",
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const decodeEntities = (s) => {
  let out = s;
  for (const [code, ch] of Object.entries(ENTITIES))
    out = out.split(code).join(ch);
  return out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
};

const stripAllTags = (html) => html.replace(/<[^>]+>/g, "");

const htmlToMarkdown = (html) => {
  // Treat </p>, </div>, and <br> as paragraph breaks so text inside <div>s and
  // bare text is preserved alongside <p> content.
  const withBreaks = html
    .replace(/<\/(?:p|div)>/gi, "\n\n")
    .replace(/<(?:p|div)(?:\s[^>]*)?>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n\n");
  const text = decodeEntities(stripAllTags(withBreaks));
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0)
    .join("\n\n");
};

const splitAuthor = (rawHtml) => {
  const emMatch = rawHtml.match(/<em[^>]*>([\s\S]*?)<\/em>/);
  const role = emMatch
    ? decodeEntities(stripAllTags(emMatch[1])).replace(/\s+/g, " ").trim()
    : "";
  const withoutEm = rawHtml.replace(/<em[^>]*>[\s\S]*?<\/em>/g, "");
  const name = decodeEntities(stripAllTags(withoutEm))
    .replace(/\s+/g, " ")
    .replace(/[,\s]+$/g, "")
    .trim();
  return { name, role };
};

const TAG_RE = /<(\/?)div\b[^>]*>/gi;

// Returns the slice of html that lies between the opening div whose tag starts
// at openIndex (the position of "<") and its matching </div>.
const extractBalancedDiv = (html, openIndex) => {
  TAG_RE.lastIndex = openIndex;
  const open = TAG_RE.exec(html);
  if (!open || open.index !== openIndex) return null;
  let depth = 1;
  const innerStart = TAG_RE.lastIndex;
  let m = TAG_RE.exec(html);
  while (m !== null) {
    depth += m[1] === "/" ? -1 : 1;
    if (depth === 0) {
      return {
        inner: html.slice(innerStart, m.index),
        end: TAG_RE.lastIndex,
      };
    }
    m = TAG_RE.exec(html);
  }
  return null;
};

const findOpeningDiv = (html, classMarker, fromIndex) => {
  const re = new RegExp(`<div class="${classMarker}"[^>]*>`, "g");
  re.lastIndex = fromIndex;
  const m = re.exec(html);
  return m ? m.index : -1;
};

const extractItems = (html) => {
  const items = [];
  let cursor = 0;
  while (true) {
    const openIdx = findOpeningDiv(html, "testimonial-item", cursor);
    if (openIdx < 0) break;
    const block = extractBalancedDiv(html, openIdx);
    if (!block) break;
    cursor = block.end;
    const bodyOpen = findOpeningDiv(block.inner, "testimonial-body", 0);
    const authorOpen = findOpeningDiv(block.inner, "testimonial-client-name", 0);
    const bodyHtml =
      bodyOpen >= 0
        ? extractBalancedDiv(block.inner, bodyOpen)?.inner ?? ""
        : "";
    const authorHtml =
      authorOpen >= 0
        ? extractBalancedDiv(block.inner, authorOpen)?.inner ?? ""
        : "";
    const { name, role } = splitAuthor(authorHtml);
    items.push({ name, role, body: htmlToMarkdown(bodyHtml) });
  }
  return items;
};

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

const padNumber = (n) => String(n).padStart(2, "0");

const dateForIndex = (index) => {
  const start = new Date("2017-08-23T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - index);
  return start.toISOString().slice(0, 10);
};

const yamlString = (s) =>
  `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const formatFrontmatter = ({ name, role, date }) => {
  const lines = ["---"];
  if (name) lines.push(`name: ${yamlString(name)}`);
  if (role) lines.push(`role: ${yamlString(role)}`);
  lines.push(`date: ${date}`);
  lines.push("legacy: true");
  lines.push("---");
  return lines.join("\n");
};

const collectAllItems = () => {
  const all = [];
  for (const page of PAGES) {
    const filePath =
      page === 1
        ? join(TESTIMONIALS_DIR, "index.html")
        : join(TESTIMONIALS_DIR, "page", String(page), "index.html");
    const html = readFileSync(filePath, "utf8");
    const items = extractItems(html);
    if (items.length === 0) {
      console.warn(`No testimonials extracted from page ${page}`);
    }
    if (page < 9 && items.length !== PAGE_SIZE) {
      console.warn(
        `Page ${page} has ${items.length} items (expected ${PAGE_SIZE})`,
      );
    }
    for (const it of items) all.push({ ...it, sourcePage: page });
  }
  return all;
};

const main = () => {
  rmSync(REVIEWS_DIR, { recursive: true, force: true });
  mkdirSync(REVIEWS_DIR, { recursive: true });

  const items = collectAllItems();
  console.log(`Extracted ${items.length} testimonials`);

  const usedSlugs = new Set();
  let written = 0;
  items.forEach((item, index) => {
    const date = dateForIndex(index);
    const authorSlug = slugify(item.name) || "anonymous";
    const baseSlug = `${date}-${padNumber(index + 1)}-${authorSlug}`;
    let slug = baseSlug;
    let counter = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
    usedSlugs.add(slug);

    const fm = formatFrontmatter({ name: item.name, role: item.role, date });
    const content = `${fm}\n\n${item.body}\n`;
    writeFileSync(join(REVIEWS_DIR, `${slug}.md`), content);
    written += 1;
  });

  console.log(`Wrote ${written} review files to reviews/`);
};

main();
