// PROTOTYPE - replay search history queries through retrieveD4 and print ranking + timings.
// Usage: npx vite-node -r dotenv/config scripts/range-count-replay.ts [list | "query" ...]
import "dotenv/config";
import { searchQuery } from "../app/server/combined-search/catalog.server";
import { getSearchStore, runJevStage } from "../app/server/search-runtime/runtime.server";
import { prepareLanguage } from "../app/server/combined-search/language.server";
import {
	attributeRequest,
	fingerprintRequest,
	retrieveD4,
	summarizeReading,
} from "../app/server/combined-search/d4.server";

const args = process.argv.slice(2);
const store = getSearchStore();
const visitor = { accountId: null, networkIdentity: "127.0.0.1" };

if (args[0] === "list") {
	const rows = await searchQuery<{ ciphertext: string; outcome: string; elapsed_ms: number; created_at: string }>(
		"SELECT ciphertext, outcome, elapsed_ms, created_at FROM doc.search_history ORDER BY created_at DESC LIMIT 400",
	);
	for (const r of rows) {
		let text: string;
		try {
			({ text } = store.unseal<{ text: string }>(r.ciphertext));
		} catch {
			continue;
		}
		console.log(`${r.outcome.padEnd(7)} ${String(r.elapsed_ms).padStart(6)} ms  ${text}`);
	}
	process.exit(0);
}

const top = Number(process.env.TOP ?? 12);
for (const q of args) {
	const signal = new AbortController().signal;
	const language = await prepareLanguage(q, visitor, signal);
	const outcome = await runJevStage({
		requestText: q,
		questionVersion: "accepted-d4-corrected-v1",
		language: language.policy,
		requests: [attributeRequest(language.text), fingerprintRequest(language.text)],
		visitor,
		signal,
	});
	console.log(`\n=== ${q}  [jev: ${outcome.kind}${"reason" in outcome ? " " + outcome.reason : ""}, charged ${outcome.chargedNano} nano, language ${language.policy.mode}]`);
	if (outcome.kind === "basic") continue;
	const nativeOnly = language.policy.mode === "native-vector-only";
	const reading = summarizeReading(language.text, outcome.readings, nativeOnly);
	console.log("reading: " + reading.map((c) => `${c.kind}:${c.text}`).join(" | "));
	const started = Date.now();
	const out = await retrieveD4(language.text, outcome.readings, { includeAdult: false, lesserKnown: false }, nativeOnly);
	const wall = Date.now() - started;
	const results = "results" in out ? out.results : (out as never as any[]);
	const { results: _r, ...timing } = out as any;
	console.log(`timing: wall ${wall} ms ${JSON.stringify(timing)}`);
	for (const r of results.slice(0, top)) {
		const dims = r.scores.map((s: any) => `${s.weight > 0 ? "+" : "-"}${s.key.slice(0, 10)}=${s.value}`).join(" ");
		console.log(
			`${String(r.rank).padStart(3)} ${(r.title ?? "").slice(0, 34).padEnd(34)} ${String(r.release_year).padEnd(5)} hits=${r.hits ?? "-"} ws=${r.weightedSum.toFixed(1).padStart(6)} comb=${r.combined.toFixed(3).padStart(7)} ev=${(r.tropes[0]?.score ?? 0).toFixed(2)} ${dims}`,
		);
	}
}
process.exit(0);
