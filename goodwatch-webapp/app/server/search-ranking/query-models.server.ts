// The two query models and their files, from Hugging Face at a pinned revision, checked against pinned SHA-256 hashes,
// and kept in SEARCH_MODEL_DIR.
//
// The Docker image holds the files: the Dockerfile's `models` stage runs scripts/fetch-search-models.mjs, which calls
// ensureQueryModelFiles() below, so the build and the app check the same list and hashes. That stage's only inputs are
// this file and the script: a change here, even to a comment, makes the next build download the files again (882 MB).
// A process that doesn't find the files (a dev machine, or a directory that a volume hides) downloads them when the
// encoder starts, and logs it.
//
// The query side must match how the titles were embedded (ADR 0002, f/search/text_encoder in Windmill):
// - english (text_en_v1): bge-base-en-v1.5, CLS pooling, the bge query instruction as prefix.
// - multilingual (text_multi_v1): multilingual-e5-small, mean pooling, "query: " as prefix.
// Both: at most 512 tokens, L2-normalized. The ONNX files are the fp32 Xenova exports; their vectors match the
// Python models (see results/bench/encoders.json in the ranking benchmark).
import { timeoutSetting } from "../../utils/backend-timeout.ts"
import { createHash } from "node:crypto"
import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"

export type QueryModelName = "english" | "multilingual"

export interface QueryModelFile {
	path: string
	sha256: string
	bytes: number
}

export interface QueryModelSpec {
	repo: string
	revision: string
	vector: string
	dim: number
	pooling: "cls" | "mean"
	queryPrefix: string
	maxTokens: number
	files: {
		model: QueryModelFile
		tokenizer: QueryModelFile
		tokenizerConfig: QueryModelFile
	}
}

export const QUERY_MODELS: Record<QueryModelName, QueryModelSpec> = {
	english: {
		repo: "Xenova/bge-base-en-v1.5",
		revision: "4d6cd88e18e51a5e020c2c305726d76ada9c03cf",
		vector: "text_en_v1",
		dim: 768,
		pooling: "cls",
		queryPrefix: "Represent this sentence for searching relevant passages: ",
		maxTokens: 512,
		files: {
			model: {
				path: "onnx/model.onnx",
				sha256:
					"9bc579acdba21c253c62a9bf866891355a63ffa3442b52c8a37d75b2ccb91848",
				bytes: 435_811_539,
			},
			tokenizer: {
				path: "tokenizer.json",
				sha256:
					"d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66",
				bytes: 711_396,
			},
			tokenizerConfig: {
				path: "tokenizer_config.json",
				sha256:
					"9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3",
				bytes: 366,
			},
		},
	},
	multilingual: {
		repo: "Xenova/multilingual-e5-small",
		revision: "761b726dd34fb83930e26aab4e9ac3899aa1fa78",
		vector: "text_multi_v1",
		dim: 384,
		pooling: "mean",
		queryPrefix: "query: ",
		maxTokens: 512,
		files: {
			model: {
				path: "onnx/model.onnx",
				sha256:
					"4aa845c27760e06e9a686b9d8b5d440eae4b6612cd09e5b522b716d3941f77ff",
				bytes: 470_268_533,
			},
			tokenizer: {
				path: "tokenizer.json",
				sha256:
					"0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39",
				bytes: 17_082_730,
			},
			tokenizerConfig: {
				path: "tokenizer_config.json",
				sha256:
					"a1d6bc8734a6f635dc158508bef000f8e2e5a759c7d92f984b2c86e5ff53425b",
				bytes: 443,
			},
		},
	},
}

export interface LocalQueryModel {
	spec: QueryModelSpec
	modelPath: string
	tokenizerPath: string
	tokenizerConfigPath: string
}

export type LocalQueryModels = Record<QueryModelName, LocalQueryModel>

export function queryModelDir(): string {
	return (
		process.env.SEARCH_MODEL_DIR || join(tmpdir(), "goodwatch-search-models")
	)
}

const localPath = (dir: string, spec: QueryModelSpec, file: QueryModelFile) =>
	join(dir, spec.repo, spec.revision, file.path)

// A file counts as verified when it has the pinned size and a marker written after its hash matched. Hashing the
// 900 MB again on every start would cost a few seconds of CPU on the shared host.
async function isVerified(path: string, file: QueryModelFile) {
	try {
		const [info, marker] = await Promise.all([
			stat(path),
			readFile(`${path}.sha256`, "utf8"),
		])
		return info.size === file.bytes && marker.trim() === file.sha256
	} catch {
		return false
	}
}

async function sha256OfFile(path: string) {
	const hash = createHash("sha256")
	await pipeline(createReadStream(path), hash)
	return hash.digest("hex")
}

// remix-serve replaces the global fetch with a polyfill unless single fetch is on, and Readable.fromWeb() rejects the
// polyfill's ReadableStream. Reading the body through its reader works with both.
async function* chunksOf(body: ReadableStream<Uint8Array>) {
	const reader = body.getReader()
	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (done) return
			yield value
		}
	} finally {
		reader.releaseLock()
	}
}

async function download(
	spec: QueryModelSpec,
	file: QueryModelFile,
	path: string,
) {
	const url = `https://huggingface.co/${spec.repo}/resolve/${spec.revision}/${file.path}`
	console.warn(
		`Search models: ${spec.repo}/${file.path} isn't in ${dirname(path)}, downloading ${Math.round(file.bytes / 1e6)} MB from Hugging Face`,
	)
	const response = await fetch(url, { signal: AbortSignal.timeout(timeoutSetting("SEARCH_MODEL_DOWNLOAD_TIMEOUT_MS", 600_000)) })
	if (!response.ok || !response.body) {
		throw new Error(
			`Downloading ${spec.repo}/${file.path} failed: HTTP ${response.status}`,
		)
	}
	await mkdir(dirname(path), { recursive: true })
	const partial = `${path}.${process.pid}.part`
	const hash = createHash("sha256")
	const hashing = new Transform({
		transform(chunk, _encoding, callback) {
			hash.update(chunk)
			callback(null, chunk)
		},
	})
	try {
		await pipeline(
			Readable.from(chunksOf(response.body)),
			hashing,
			createWriteStream(partial),
		)
		const digest = hash.digest("hex")
		if (digest !== file.sha256) {
			throw new Error(
				`${spec.repo}/${file.path} has SHA-256 ${digest}, expected ${file.sha256}`,
			)
		}
		await rename(partial, path)
		await writeFile(`${path}.sha256`, file.sha256)
	} finally {
		await rm(partial, { force: true })
	}
}

async function ensureFile(
	dir: string,
	spec: QueryModelSpec,
	file: QueryModelFile,
) {
	const path = localPath(dir, spec, file)
	if (await isVerified(path, file)) return { path, downloaded: false }
	// A file without a marker (for example copied in by hand) is kept when its hash matches.
	const existing = await stat(path).catch(() => undefined)
	if (
		existing?.size === file.bytes &&
		(await sha256OfFile(path)) === file.sha256
	) {
		await writeFile(`${path}.sha256`, file.sha256)
		return { path, downloaded: false }
	}
	await download(spec, file, path)
	return { path, downloaded: true }
}

/** Checks the files of `models` in `dir` and downloads the missing or damaged ones. Logs where the files came from. */
export async function ensureModelFiles<Name extends string>(
	dir: string,
	models: Record<Name, QueryModelSpec>,
): Promise<Record<Name, LocalQueryModel>> {
	let files = 0
	let downloaded = 0
	const entries = await Promise.all(
		(Object.keys(models) as Name[]).map(async (name) => {
			const spec = models[name]
			const [model, tokenizer, tokenizerConfig] = await Promise.all([
				ensureFile(dir, spec, spec.files.model),
				ensureFile(dir, spec, spec.files.tokenizer),
				ensureFile(dir, spec, spec.files.tokenizerConfig),
			])
			for (const file of [model, tokenizer, tokenizerConfig]) {
				files++
				if (file.downloaded) downloaded++
			}
			return [
				name,
				{
					spec,
					modelPath: model.path,
					tokenizerPath: tokenizer.path,
					tokenizerConfigPath: tokenizerConfig.path,
				},
			] as const
		}),
	)
	console.info(
		`Search models: ${files} files verified in ${dir}, ${downloaded} downloaded now`,
	)
	return Object.fromEntries(entries) as Record<Name, LocalQueryModel>
}

let pending: Promise<LocalQueryModels> | undefined

/** Downloads missing or damaged model files into `dir` and returns their paths. Safe to call repeatedly. */
export function ensureQueryModelFiles(
	dir = queryModelDir(),
): Promise<LocalQueryModels> {
	if (!pending) {
		pending = ensureModelFiles(dir, QUERY_MODELS)
		pending.catch(() => {
			pending = undefined
		})
	}
	return pending
}
