// Where the query model files come from: the directory setting, files that are already there (as in the Docker
// image), and the download when they aren't. Small stand-in files and a stubbed fetch: nothing is downloaded.
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import {
	QUERY_MODELS,
	type QueryModelSpec,
	ensureModelFiles,
	queryModelDir,
} from "./query-models.server.ts"

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex")
const file = (path: string, content: string) => ({
	path,
	sha256: sha256(content),
	bytes: Buffer.byteLength(content),
})

const CONTENT = {
	"onnx/model.onnx": "model weights",
	"tokenizer.json": '{"tokens":[]}',
	"tokenizer_config.json": "{}",
}
const spec: QueryModelSpec = {
	...QUERY_MODELS.english,
	repo: "Stub/model",
	revision: "abc123",
	files: {
		model: file("onnx/model.onnx", CONTENT["onnx/model.onnx"]),
		tokenizer: file("tokenizer.json", CONTENT["tokenizer.json"]),
		tokenizerConfig: file(
			"tokenizer_config.json",
			CONTENT["tokenizer_config.json"],
		),
	},
}
const models = { stub: spec }

let dir = ""
let requests: string[] = []
let logs: string[] = []
const original = {
	fetch: globalThis.fetch,
	warn: console.warn,
	info: console.info,
	env: process.env.SEARCH_MODEL_DIR,
}

function serve(content: Record<string, string>) {
	globalThis.fetch = (async (input: string | URL | Request) => {
		const url = String(input)
		requests.push(url)
		const path = Object.keys(content).find((p) => url.endsWith(`/${p}`))
		return path
			? new Response(content[path])
			: new Response("missing", { status: 404 })
	}) as typeof fetch
}

const pathOf = (path: string) => join(dir, spec.repo, spec.revision, path)

async function place(path: string, content: string, marker: boolean) {
	await mkdir(dirname(pathOf(path)), { recursive: true })
	await writeFile(pathOf(path), content)
	if (marker) await writeFile(`${pathOf(path)}.sha256`, sha256(content))
}

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "gw-query-models-"))
	requests = []
	logs = []
	console.warn = (line: string) => logs.push(line)
	console.info = (line: string) => logs.push(line)
})

afterEach(async () => {
	globalThis.fetch = original.fetch
	console.warn = original.warn
	console.info = original.info
	if (original.env === undefined)
		Reflect.deleteProperty(process.env, "SEARCH_MODEL_DIR")
	else process.env.SEARCH_MODEL_DIR = original.env
	await rm(dir, { recursive: true, force: true })
})

test("the directory comes from SEARCH_MODEL_DIR, with a temp directory as the default", () => {
	process.env.SEARCH_MODEL_DIR = "/data/gw-search-models"
	assert.equal(queryModelDir(), "/data/gw-search-models")
	process.env.SEARCH_MODEL_DIR = ""
	assert.equal(queryModelDir(), join(tmpdir(), "goodwatch-search-models"))
})

test("files that are present with their markers are used without a request", async () => {
	serve({})
	for (const [path, content] of Object.entries(CONTENT))
		await place(path, content, true)
	const local = await ensureModelFiles(dir, models)
	assert.equal(local.stub.modelPath, pathOf("onnx/model.onnx"))
	assert.equal(local.stub.tokenizerPath, pathOf("tokenizer.json"))
	assert.deepEqual(requests, [])
	assert.deepEqual(logs, [
		`Search models: 3 files verified in ${dir}, 0 downloaded now`,
	])
})

test("a file without a marker is kept when its hash matches", async () => {
	serve({})
	for (const [path, content] of Object.entries(CONTENT))
		await place(path, content, false)
	await ensureModelFiles(dir, models)
	assert.deepEqual(requests, [])
	assert.equal(
		await readFile(`${pathOf("tokenizer.json")}.sha256`, "utf8"),
		spec.files.tokenizer.sha256,
	)
})

test("an empty directory downloads the pinned revision and says so", async () => {
	serve(CONTENT)
	await ensureModelFiles(dir, models)
	assert.deepEqual(requests.sort(), [
		"https://huggingface.co/Stub/model/resolve/abc123/onnx/model.onnx",
		"https://huggingface.co/Stub/model/resolve/abc123/tokenizer.json",
		"https://huggingface.co/Stub/model/resolve/abc123/tokenizer_config.json",
	])
	assert.equal(
		await readFile(pathOf("onnx/model.onnx"), "utf8"),
		CONTENT["onnx/model.onnx"],
	)
	assert.equal(logs.filter((line) => line.includes("downloading")).length, 3)
	assert.equal(
		logs.at(-1),
		`Search models: 3 files verified in ${dir}, 3 downloaded now`,
	)
	// A second run finds them.
	requests = []
	await ensureModelFiles(dir, models)
	assert.deepEqual(requests, [])
})

test("a damaged file is replaced, and only that file", async () => {
	serve(CONTENT)
	for (const [path, content] of Object.entries(CONTENT))
		await place(path, content, true)
	await writeFile(pathOf("tokenizer.json"), "truncated")
	await ensureModelFiles(dir, models)
	assert.equal(requests.length, 1)
	assert.equal(
		await readFile(pathOf("tokenizer.json"), "utf8"),
		CONTENT["tokenizer.json"],
	)
})

test("a download with the wrong hash fails and leaves no file behind", async () => {
	serve({ ...CONTENT, "tokenizer.json": "something else" })
	await assert.rejects(ensureModelFiles(dir, models), /expected [0-9a-f]{64}/)
	assert.deepEqual(
		await readdir(dirname(pathOf("tokenizer.json"))).then((names) =>
			names.filter((name) => name.startsWith("tokenizer.json")),
		),
		[],
	)
})

test("a failed download fails with the file's name and status", async () => {
	serve({})
	await assert.rejects(
		ensureModelFiles(dir, models),
		/Downloading Stub\/model\/.* failed: HTTP 404/,
	)
})
