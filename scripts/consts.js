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

export const passthroughDirs = ["wp-content", "wp-includes", "wp-json"];

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
  ...passthroughDirs,
  ...(process.env.PLACEHOLDER_IMAGES === "1" ? ["images"] : []),
];
