#!/usr/bin/env bun
// One-shot: replace `json_ld:` literal frontmatter on areas with structured
// per-page fields (primary_image, primary_image_width/height/caption). The
// new _includes/wp-area-jsonld.html include rebuilds the JSON-LD at render
// time, so we no longer need the literal blob.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const AREAS = join(ROOT, "areas-covered");

const yamlQuote = (s) => {
  if (s == null) return "null";
  return `'${String(s).replace(/'/g, "''")}'`;
};

// Find the JSON value for `json_ld:` in YAML frontmatter and return the
// JSON.parse-able string plus its line range. The YAML uses single-quoted
// scalar where embedded single quotes are escaped as ''.
const extractJsonLdLine = (fm) => {
  const m = fm.match(/^json_ld:\s*'((?:''|[^'])*)'\s*$/m);
  if (!m) return null;
  const json = m[1].replace(/''/g, "'");
  return { json, raw: m[0] };
};

const findImageNode = (graph) =>
  graph.find(
    (n) => n["@type"] === "ImageObject" && n["@id"]?.endsWith("#primaryimage"),
  );

const dejsonOne = (path) => {
  const raw = readFileSync(path, "utf8");
  if (!raw.startsWith("---\n")) return { path, skipped: "no-frontmatter" };
  const end = raw.indexOf("\n---\n", 4);
  if (end < 0) return { path, skipped: "no-frontmatter" };
  const fm = raw.slice(4, end);
  const body = raw.slice(end + 5);

  const ld = extractJsonLdLine(fm);
  if (!ld) return { path, skipped: "no-json-ld" };

  let parsed;
  try {
    parsed = JSON.parse(ld.json);
  } catch {
    return { path, skipped: "json-parse-failed" };
  }
  const graph = parsed["@graph"];
  if (!Array.isArray(graph)) return { path, skipped: "no-graph" };

  const img = findImageNode(graph);
  const additions = [];
  if (img) {
    additions.push(`primary_image: ${yamlQuote(img.url)}`);
    additions.push(`primary_image_width: ${img.width}`);
    additions.push(`primary_image_height: ${img.height}`);
    if (img.caption)
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
    return dejsonOne(p);
  });
  const ok = results.filter((r) => r.ok);
  const skipped = results.filter((r) => r.skipped);
  console.log(`De-jsonified ${ok.length}/${dirs.length} areas`);
  if (skipped.length) console.log("Skipped:", skipped);
  console.log(`With primary image: ${ok.filter((r) => r.hasImage).length}`);
};

main();
