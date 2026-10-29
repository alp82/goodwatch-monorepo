// Verify only the intended stats loader projection changes; leave the strict HTML gate intact.
// node compare.mjs <html-equivalence-run-directory>
// node compare.mjs --project <captured-stats.html> <output.json>
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { contexts, normalize } from "../html-equivalence/core.mjs";
import "../../goodwatch-webapp/app/server/title-filter/test-alias.ts";
const { statsPayload, statsTastePayload } = await import(
	"../../goodwatch-webapp/app/server/profile/stats-payload.ts"
);
const routeKey = "routes/u.$handle.stats.($view)";
const serialize = (value) =>
	JSON.stringify(value).replace(
		/[<>&\u2028\u2029]/g,
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	);
function project(html) {
	const context = contexts(html)[0];
	const route = context?.state?.loaderData?.[routeKey];
	if (!route) return html;
	const original = serialize(context);
	assert.ok(
		html.includes(original),
		"Serialization must match the captured response exactly",
	);
	if (route.stats) route.stats = statsPayload(route.stats);
	if (route.taste) route.taste = statsTastePayload(route.taste);
	return html.replace(original, serialize(context));
}
const metrics = (html) => ({
	raw: Buffer.byteLength(html),
	gzip9: gzipSync(html, { level: 9 }).length,
	br11: brotliCompressSync(html, {
		params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
	}).length,
});
if (process.argv[2] === "--project") {
	const html = readFileSync(process.argv[3], "utf8");
	const projected = project(html);
	const result = { before: metrics(html), after: metrics(projected) };
	writeFileSync(process.argv[4], JSON.stringify(result, null, 2));
	console.log(JSON.stringify(result));
} else {
	const dir = process.argv[2];
	const left = JSON.parse(readFileSync(path.join(dir, "base-2/snapshot.json")));
	const right = JSON.parse(
		readFileSync(path.join(dir, "candidate-2/snapshot.json")),
	);
	assert.equal(left.complete, true);
	assert.equal(right.complete, true);
	assert.equal(left.entries.length, right.entries.length);
	let projected = 0;
	for (let i = 0; i < left.entries.length; i++) {
		const a = left.entries[i],
			b = right.entries[i];
		assert.deepEqual(
			a,
			b,
			"Statuses, redirects, cache policies and URL/client sets must match",
		);
		const raw = (side, entry) =>
			readFileSync(
				path.join(dir, side, entry.file.replace(/\.html$/, ".raw.html")),
				"utf8",
			);
		const before = raw("base-2", a),
			after = raw("candidate-2", b);
		assert.equal(
			normalize(project(before)),
			normalize(after),
			`${a.client} ${a.path}: unexpected HTML or loader difference`,
		);
		if (normalize(before) !== normalize(after)) projected++;
	}
	console.log(
		`${left.entries.length} documents match exactly after the stats-only projection; ${projected} intended loader differences`,
	);
}
