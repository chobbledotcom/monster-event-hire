export const templateRepo = "https://github.com/chobbledotcom/chobble-template";
export const buildDir = ".build";

export const templateExcludes = [
  ".git",
  ".direnv",
  "node_modules",
  "*.md",
  "test",
  "test-*",
  ".image-cache",
  "images",
  "landing-pages",
  "instagram-posts",
];

export const sourceExcludes = [
  ".*",
  "_site",
  "*.nix",
  "README.md",
  "CLAUDE.md",
  "scripts",
  "node_modules",
  "package*.json",
  "bun.lock",
  "old_site",
  "chobble-template",
  ...(process.env.PLACEHOLDER_IMAGES === "1" ? ["images"] : []),
];

export const mirrorPassthroughDirs = [
  "wp-content",
  "wp-includes",
  "theme",
  "images",
];
