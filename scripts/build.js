import { join } from "node:path";
import { passthroughDirs } from "./consts.js";
import { fixWpPaths } from "./fix-wp-paths.js";
import { prep } from "./prepare-dev.js";
import { bun, copyDir, fs, path } from "./utils.js";

const dev = path(".build", "dev");
const output = path("_site");

prep();

console.log("Building site...");

fs.rm(output);
const result = bun.run("build", dev);

if (result.exitCode !== 0) {
  console.error(`\n${"=".repeat(60)}`);
  console.error("BUILD FAILED");
  console.error("=".repeat(60));
  console.error("\nFix the error above and rebuild.\n");
  process.exit(result.exitCode);
}

fs.mv(join(dev, "_site"), output);

for (const dir of passthroughDirs) {
  const src = path(dir);
  if (!fs.exists(src)) continue;
  copyDir(src, join(output, dir));
}

fixWpPaths(output);

console.log("Built to _site/");
