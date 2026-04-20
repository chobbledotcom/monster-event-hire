import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDir,
  mirrorPassthroughDirs,
  sourceExcludes,
  templateExcludes,
  templateRepo,
} from "./consts.js";
import {
  bun,
  copyDir,
  find,
  fs,
  git,
  mergeTemplateAndSource,
  path,
  root,
} from "./utils.js";

const build = path(buildDir);
const template = path(buildDir, "template");
const dev = path(buildDir, "dev");
const localTemplate = join(root, "..", "chobble-template");

export const prep = () => {
  console.log("Preparing build...");
  fs.mkdir(build);

  if (fs.exists(localTemplate)) {
    console.log("Using local template from ../chobble-template...");
    copyDir(localTemplate, template, {
      delete: true,
      exclude: templateExcludes,
    });
  } else if (!fs.exists(join(template, ".git"))) {
    console.log("Cloning template...");
    fs.rm(template);
    git.clone(templateRepo, template);
  } else {
    console.log("Updating template...");
    git.reset(template, { hard: true });
    git.pull(template);
  }

  find.deleteByExt(dev, ".md");
  mergeTemplateAndSource(template, root, dev, {
    delete: true,
    templateExcludes,
    sourceExcludes,
  });

  addMirrorPassthroughCopy(join(dev, ".eleventy.js"));

  sync();

  if (!fs.exists(join(dev, "node_modules"))) {
    console.log("Installing dependencies...");
    bun.install(dev);
  }

  fs.rm(join(dev, "_site"));
  console.log("Build ready.");
};

const MIRROR_PASSTHROUGH_MARKER = "// chobble-client: wp mirror passthrough";

export const addMirrorPassthroughCopy = (configPath) => {
  const source = readFileSync(configPath, "utf8");
  if (source.includes(MIRROR_PASSTHROUGH_MARKER)) return;
  const target = '.addPassthroughCopy("src/assets")';
  if (!source.includes(target)) {
    throw new Error(
      `Could not find passthrough anchor in ${configPath}; wp mirror assets will not be copied`,
    );
  }
  const replacement = [
    target,
    `    ${MIRROR_PASSTHROUGH_MARKER}`,
    ...mirrorPassthroughDirs.map((dir) => `.addPassthroughCopy("src/${dir}")`),
  ].join("\n    ");
  writeFileSync(configPath, source.replace(target, replacement));
};

export const sync = () => {
  copyDir(root, join(dev, "src"), {
    update: true,
    exclude: sourceExcludes,
  });
};

if (import.meta.main) prep();
