import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

const rendered = JSON.parse(
	execFileSync(
		"node_modules/.bin/vite-node",
		[
			"--config",
			"app/ui/imports/source-import-test-vite.config.ts",
			"app/ui/taste/hooks/title-queue-render.test-support.tsx",
		],
		{ encoding: "utf8" },
	)
		.split("__TITLE_QUEUE__")
		.at(-1) ?? "",
) as Record<string, string>;
const read = (key: string) =>
	JSON.parse(rendered[key].replace(/<\/?output>/g, "").replace(/&quot;/g, '"'));

test("the server renders the first title and next title without waiting for an effect", () => {
	assert.deepEqual(read("first"), {
		current: 1,
		next: 2,
		count: 3,
		loading: false,
	});
});
test("the initial queue excludes account answers, interactions and duplicates", () => {
	assert.deepEqual(read("answered"), {
		current: 3,
		next: null,
		count: 1,
		loading: false,
	});
});
test("an empty or different-language queue waits for titles", () => {
	for (const key of ["empty", "language"])
		assert.deepEqual(read(key), {
			current: null,
			next: null,
			count: 0,
			loading: true,
		});
});
test("browser-only resume data does not hide the server's first title", () => {
	assert.equal(rendered.resume, rendered.first);
});
