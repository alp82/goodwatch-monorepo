// Draws room invite cards in a short-lived child process and keeps the latest ones in memory.
// Cards depend only on the host name, so rooms with the same host share one image.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { cardHostName } from "./link-cards.ts"

const KEEP = 200
const RUNNING_MAX = 2
const TIMEOUT_MS = 15_000

export class LinkCardBusyError extends Error {}

// The release bundle has link-card.mjs beside it; in source the child runs as TypeScript.
function childEntry() {
	for (const name of ["./link-card.mjs", "./link-card.child.ts"]) {
		const file = fileURLToPath(new URL(name, import.meta.url))
		if (existsSync(file)) return file
	}
	throw new Error("Link card renderer entry not found")
}

function draw(host: string | null) {
	return new Promise<Buffer>((resolve, reject) => {
		const child = spawn(process.execPath, [childEntry(), JSON.stringify(host)], { stdio: ["ignore", "pipe", "pipe"], timeout: TIMEOUT_MS })
		const out: Buffer[] = []
		let err = ""
		child.stdout.on("data", (chunk: Buffer) => out.push(chunk))
		child.stderr.on("data", (chunk: Buffer) => (err = (err + chunk.toString()).slice(-2000)))
		child.on("error", reject)
		child.on("close", (code, signal) => {
			const png = Buffer.concat(out)
			if (code === 0 && png.length) resolve(png)
			else reject(new Error(`Link card render failed (${signal ?? code}): ${err.trim()}`))
		})
	})
}

const cache = new Map<string, Promise<Buffer>>()
let running = 0

/** The invite card PNG for this host. Throws LinkCardBusyError when renders are already running. */
export async function inviteCardPng(hostName: string | null): Promise<Buffer> {
	const host = cardHostName(hostName)
	const key = host ?? ""
	const hit = cache.get(key)
	if (hit) {
		cache.delete(key)
		cache.set(key, hit)
		return hit
	}
	if (running >= RUNNING_MAX) throw new LinkCardBusyError("Link card renderer busy")
	running++
	const job = draw(host).finally(() => running--)
	cache.set(key, job)
	job.catch(() => cache.delete(key))
	while (cache.size > KEEP) cache.delete(cache.keys().next().value!)
	return job
}
