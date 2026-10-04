// Per-component memory and load time of the query encoder, measured in a bare Node process with the same session
// options as app/server/search-ranking/query-encoder.worker.js. Run inside the measurement image:
//   node mem-probe.mjs <model dir> [threads]
import { readFileSync } from "node:fs"
import { join } from "node:path"
const dir = process.argv[2], threads = Number(process.argv[3] ?? 4)
const smaps = () => {
	const text = readFileSync("/proc/self/smaps_rollup", "utf8")
	const kb = (name) => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, "m"))?.[1] ?? 0)
	const u = process.memoryUsage()
	return { rssMb: +(kb("Rss") / 1024).toFixed(1), anonMb: +(kb("Anonymous") / 1024).toFixed(1), fileMb: +((kb("Rss") - kb("Anonymous")) / 1024).toFixed(1), heapUsedMb: +(u.heapUsed / 1048576).toFixed(1), externalMb: +(u.external / 1048576).toFixed(1), arrayBuffersMb: +(u.arrayBuffers / 1048576).toFixed(1) }
}
const steps = []
const step = async (name, fn) => { const t = performance.now(); const out = await fn(); global.gc?.(); steps.push({ step: name, ms: Math.round(performance.now() - t), ...smaps() }); return out }
await step("bare node", async () => {})
const ort = await step("import onnxruntime-node", () => import("onnxruntime-node"))
const { Tokenizer } = await step("import @huggingface/tokenizers", () => import("@huggingface/tokenizers"))
const MODELS = { english: "Xenova/bge-base-en-v1.5/4d6cd88e18e51a5e020c2c305726d76ada9c03cf", multilingual: "Xenova/multilingual-e5-small/761b726dd34fb83930e26aab4e9ac3899aa1fa78" }
const order = (process.argv[4] ?? "english,multilingual").split(",")
const sessions = {}
for (const name of order) {
	const base = join(dir, MODELS[name])
	const tok = await step(`${name}: tokenizer`, async () => new Tokenizer(JSON.parse(readFileSync(join(base, "tokenizer.json"), "utf8")), JSON.parse(readFileSync(join(base, "tokenizer_config.json"), "utf8"))))
	const session = await step(`${name}: InferenceSession.create`, () => ort.InferenceSession.create(join(base, "onnx/model.onnx"), { intraOpNumThreads: threads, interOpNumThreads: 1, executionMode: "sequential", graphOptimizationLevel: "all", enableCpuMemArena: false, enableMemPattern: false }))
	sessions[name] = { tok, session }
	await step(`${name}: 3 warm-up runs`, async () => {
		for (let i = 0; i < 3; i++) {
			const ids = tok.encode("warm up the query encoder").ids
			const feeds = {}
			for (const input of session.inputNames) feeds[input] = new ort.Tensor("int64", input === "input_ids" ? BigInt64Array.from(ids.map(BigInt)) : input === "attention_mask" ? new BigInt64Array(ids.length).fill(1n) : new BigInt64Array(ids.length), [1, ids.length])
			await session.run(feeds)
		}
	})
}
console.log(JSON.stringify({ threads, order, steps }, null, 1))
