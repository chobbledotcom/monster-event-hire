#!/usr/bin/env bun
// One-off script: adds page/2, page/3, page/4 redirect_from entries to all category files.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CATEGORIES_DIR = join(import.meta.dir, "../categories");

const files = (await readdir(CATEGORIES_DIR)).filter((f) => f.endsWith(".md"));

for (const file of files) {
	const filePath = join(CATEGORIES_DIR, file);
	const content = await readFile(filePath, "utf-8");

	const permalinkMatch = content.match(/^permalink:\s*(.+)$/m);
	if (!permalinkMatch) continue;

	const permalink = permalinkMatch[1].trim();
	if (!permalink.startsWith("/categories/")) continue;

	// Strip trailing slash to get slug
	const base = permalink.replace(/\/$/, "");
	const newRedirects = [
		`  - ${base}/page/2`,
		`  - ${base}/page/3`,
		`  - ${base}/page/4`,
	].join("\n");

	let updated;
	if (content.includes("redirect_from:")) {
		// Find end of redirect_from block (next key at column 0 after the list)
		updated = content.replace(
			/(redirect_from:[\s\S]*?)(\n[a-zA-Z_])/,
			(_, block, nextKey) => `${block}\n${newRedirects}${nextKey}`,
		);
	} else {
		// Insert redirect_from block after permalink line
		updated = content.replace(
			/(permalink:.+\n)/,
			`$1redirect_from:\n${newRedirects}\n`,
		);
	}

	if (updated !== content) {
		await writeFile(filePath, updated);
		process.stdout.write(`Updated: ${file}\n`);
	} else {
		process.stdout.write(`Skipped (no change): ${file}\n`);
	}
}
