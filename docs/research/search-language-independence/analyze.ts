// Reads results.json and prints the comparison tables for issue #106.
import { readFileSync } from "node:fs"

const data = JSON.parse(readFileSync(new URL("./results.json", import.meta.url), "utf8"))
const IDS = ["en2", "de", "es", "fr", "tr"]

const used = (weights: Record<string, number>) => {
	const kept = Object.entries(weights).filter(([, w]) => w >= 0.6 || w <= -1.2)
	if (kept.length) return new Set(kept.map(([k, w]) => `${w > 0 ? "+" : "-"}${k}`))
	const [k, w] = Object.entries(weights).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0]
	return new Set([`${w > 0 ? "+" : "-"}${k}`])
}
const jaccard = (a: Set<string>, b: Set<string>) => {
	const inter = [...a].filter((x) => b.has(x)).length
	return inter / (a.size + b.size - inter)
}
const pearson = (a: number[], b: number[]) => {
	const ma = a.reduce((s, x) => s + x, 0) / a.length
	const mb = b.reduce((s, x) => s + x, 0) / b.length
	let num = 0, da = 0, db = 0
	a.forEach((x, i) => { num += (x - ma) * (b[i] - mb); da += (x - ma) ** 2; db += (b[i] - mb) ** 2 })
	return num / Math.sqrt(da * db)
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const f = (x: number) => x.toFixed(2)

const sums: Record<string, Record<string, number[]>> = {}
const add = (id: string, metric: string, v: number) => { ((sums[id] ??= {})[metric] ??= []).push(v) }

console.log("## Dimensions per request: Jaccard of used dimensions / Pearson of all 74 weights, versus English run 1\n")
console.log(`| Request | ${IDS.join(" | ")} |\n|---|${IDS.map(() => "---").join("|")}|`)
for (const r of data.requests) {
	const en = r.runs.en
	const keys = Object.keys(en.dims.weights)
	const cells = IDS.map((id) => {
		const run = r.runs[id]
		const j = jaccard(used(en.dims.weights), used(run.dims.weights))
		const p = pearson(keys.map((k) => en.dims.weights[k]), keys.map((k) => run.dims.weights[k]))
		add(id, "jaccard", j); add(id, "pearson", p)
		return `${f(j)} / ${f(p)}`
	})
	console.log(`| ${r.english} | ${cells.join(" | ")} |`)
}

console.log("\n## Used dimensions per run\n")
for (const r of data.requests) {
	console.log(`- **${r.english}**`)
	for (const id of ["en", ...IDS]) console.log(`  - ${id}: ${[...used(r.runs[id].dims.weights)].join(" ")}`)
}

console.log("\n## Attribute decisions that differ from English run 1 (threshold 0.6)\n")
for (const r of data.requests) {
	const en = r.runs.en.attrs.flags
	for (const id of IDS) {
		const run = r.runs[id].attrs.flags
		const diff = Object.keys(en).filter((k) => en[k] !== run[k])
		add(id, "flagAgree", (22 - diff.length) / 22)
		const decided = Object.keys(en).filter((k) => en[k] !== "none" || run[k] !== "none")
		add(id, "decidedTotal", decided.length); add(id, "decidedSame", decided.filter((k) => en[k] === run[k]).length)
		for (const k of diff) {
			const p = r.runs[id].attrs.flagProbs[k], q = r.runs.en.attrs.flagProbs[k]
			console.log(`- ${r.english} / ${id} / ${k}: en ${en[k]} (req ${f(q.required)}, exc ${f(q.excluded)}) vs ${run[k]} (req ${f(p.required)}, exc ${f(p.excluded)})`)
		}
	}
}

console.log("\n## Concrete words (noul >= 0.6 marked with *)\n")
for (const r of data.requests) {
	console.log(`- **${r.english}**`)
	for (const id of ["en", ...IDS]) console.log(`  - ${id}: ${r.runs[id].attrs.split.map((w: any) => `${w.concrete >= 0.6 ? "*" : ""}${w.word} ${f(w.concrete)}`).join(", ")}`)
}

console.log("\n## Phrase choice\n")
console.log("| Request | Run | (a) English candidates | conf | pooled English vocabulary | conf | native candidates |\n|---|---|---|---|---|---|---|")
for (const r of data.requests) {
	for (const id of ["en", ...IDS]) {
		const run = r.runs[id]
		const a = run.attrs.phrase
		if (id !== "en" && a) {
			add(id, "phraseSame", a.choice === r.runs.en.attrs.phrase.choice ? 1 : 0)
			add(id, "pooledSame", run.phrasePooled.choice === r.runs.en.phrasePooled.choice ? 1 : 0)
			add(id, "pooledInOwn", r.englishCandidates.includes(run.phrasePooled.choice) ? 1 : 0)
			// probability mass on the English run's top phrase
			add(id, "phraseMass", a.probabilities[r.runs.en.attrs.phrase.choice] ?? 0)
		}
		console.log(`| ${r.english} | ${id} | ${a?.choice ?? "(one candidate)"} | ${a ? f(a.confidence) : ""} | ${run.phrasePooled.choice} | ${f(run.phrasePooled.confidence)} | ${run.phraseNative?.choice ?? "(one candidate)"} |`)
	}
}

console.log("\n## What the English-only code produces from each request\n")
for (const r of data.requests) {
	console.log(`- **${r.english}**`)
	for (const id of ["en", "de", "es", "fr", "tr"]) console.log(`  - ${id}: terms [${r.runs[id].englishCodeTerms.join(" ")}]`)
}

console.log("\n## Tokens and latency per search (both production calls)\n")
console.log("| Run | tokens dims | tokens attrs | tokens total | wall ms mean | wall ms max |\n|---|---|---|---|---|---|")
for (const id of ["en", ...IDS]) {
	const runs = data.requests.map((r: any) => r.runs[id])
	const d = mean(runs.map((x: any) => x.dims.tokens)), a = mean(runs.map((x: any) => x.attrs.tokens))
	console.log(`| ${id} | ${d.toFixed(0)} | ${a.toFixed(0)} | ${(d + a).toFixed(0)} | ${mean(runs.map((x: any) => x.wallMs)).toFixed(0)} | ${Math.max(...runs.map((x: any) => x.wallMs))} |`)
}

console.log("\n## Summary (means over 8 requests, versus English run 1)\n")
console.log("| Run | Jaccard | Pearson | flags equal of 22 | decided flags equal | same phrase (a) | prob. on English phrase | pooled: same as English | pooled: from own request |\n|---|---|---|---|---|---|---|---|---|")
for (const id of IDS) {
	const s = sums[id]
	const sum = (k: string) => s[k].reduce((x, y) => x + y, 0)
	console.log(`| ${id} | ${f(mean(s.jaccard))} | ${f(mean(s.pearson))} | ${(mean(s.flagAgree) * 22).toFixed(1)} | ${sum("decidedSame")}/${sum("decidedTotal")} | ${sum("phraseSame")}/${s.phraseSame.length} | ${f(mean(s.phraseMass))} | ${sum("pooledSame")}/${s.pooledSame.length} | ${sum("pooledInOwn")}/${s.pooledInOwn.length} |`)
}
console.log(`\nTotal: ${data.totalTokens} tokens, $${data.usd.toFixed(4)}`)
