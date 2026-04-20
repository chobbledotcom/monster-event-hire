import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { path } from "./utils.js";

const ASSET_EXT =
  /\.(css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|mp4|webm|pdf|json|xml|txt|map|woff)$/i;

const walk = (dir) => {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".html")) out.push(p);
  }
  return out;
};

const fileToPagePath = (siteDir, filePath) => {
  const rel = relative(siteDir, filePath);
  const dir = dirname(rel);
  return dir === "." ? "/" : `/${dir}/`;
};

const isExternal = (u) =>
  /^(https?:)?\/\//i.test(u) ||
  u.startsWith("mailto:") ||
  u.startsWith("tel:") ||
  u.startsWith("data:") ||
  u.startsWith("javascript:") ||
  u.startsWith("about:");

const splitSuffix = (url) => {
  const idx = url.search(/[#?]/);
  return idx === -1 ? [url, ""] : [url.slice(0, idx), url.slice(idx)];
};

const stripDotDots = (p) => {
  let rest = p;
  while (rest.startsWith("../")) rest = rest.slice(3);
  return rest;
};

const toAbsolute = (pagePath, pathPart) => {
  if (pathPart.startsWith("/")) return pathPart;
  if (pathPart.startsWith("../")) {
    // e.g. ../..//foo/ — stripping ../ reveals an absolute path
    const rest = stripDotDots(pathPart);
    if (rest.startsWith("/")) return rest;
    return posix.resolve(pagePath, pathPart);
  }
  const clean = pathPart.startsWith("./") ? pathPart.slice(2) : pathPart;
  return `/${clean}`;
};

const ensureTrailingSlash = (pathPart) => {
  if (!pathPart || pathPart.endsWith("/") || ASSET_EXT.test(pathPart))
    return pathPart;
  return `${pathPart}/`;
};

const fixHref = (pagePath, url) => {
  if (!url || isExternal(url) || url.startsWith("#")) return url;
  const [pathPart, suffix] = splitSuffix(url);
  const resolved = ensureTrailingSlash(toAbsolute(pagePath, pathPart));
  return `${resolved}${suffix}`;
};

const hrefRe = /(\shref\s*=\s*["'])([^"']+)(["'])/gi;

export const fixLinks = (siteDir) => {
  const files = walk(siteDir);
  let changed = 0;
  for (const f of files) {
    const pagePath = fileToPagePath(siteDir, f);
    const before = readFileSync(f, "utf8");
    const after = before.replace(hrefRe, (_, head, url, tail) => {
      const fixed = fixHref(pagePath, url);
      return `${head}${fixed}${tail}`;
    });
    if (after !== before) {
      writeFileSync(f, after);
      changed++;
    }
  }
  console.log(`Fixed links in ${changed} files.`);
};

if (import.meta.main) {
  const target = process.argv[2] ? resolve(process.argv[2]) : path("_site");
  fixLinks(target);
}
