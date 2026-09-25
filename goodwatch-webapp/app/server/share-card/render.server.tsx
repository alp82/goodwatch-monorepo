// Renders share cards to PNG in child processes (render.child.js), so a render never blocks the web server and a
// resvg abort only ends that child. A crashed or stuck child fails its render and is replaced on the next one.
import { type ChildProcess, fork } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react"
import { toDataUri } from "~/server/og-image/render.server"
import { CARD_FONT_DIR, CARD_FONTS } from "~/ui/share-card/fonts"
import type { CardDesign, CardProps, CardTitle } from "~/ui/share-card/model"

const POOL_SIZE = Number(process.env.SHARE_CARD_RENDERERS) || 2
const RENDER_TIMEOUT_MS = 30_000

// public/ in development, build/client/ once built.
function fontDir() {
	const candidates = ["public", "build/client"].map((dir) => join(process.cwd(), dir, CARD_FONT_DIR))
	const found = candidates.find((dir) => existsSync(join(dir, CARD_FONTS[0].file)))
	if (!found) throw new Error(`Share card fonts not found in ${candidates.join(" or ")}`)
	return found
}

type Job = {
	id: number
	tree: unknown
	width: number
	height: number
	resolve: (png: Buffer) => void
	reject: (error: Error) => void
}

type Slot = { child: ChildProcess | null; ready: Promise<void> | null; job: Job | null; timer?: NodeJS.Timeout }

const slots: Slot[] = Array.from({ length: POOL_SIZE }, () => ({ child: null, ready: null, job: null }))
const queue: Job[] = []
let nextId = 1

function fail(slot: Slot, error: Error) {
	clearTimeout(slot.timer)
	const job = slot.job
	slot.job = null
	job?.reject(error)
}

function spawn(slot: Slot) {
	const child = fork(new URL("./render.child.js", import.meta.url), [JSON.stringify({ fontDir: fontDir(), fonts: CARD_FONTS })], {
		serialization: "advanced",
		stdio: ["ignore", "inherit", "inherit", "ipc"],
	})
	slot.child = child
	slot.ready = new Promise((resolve, reject) => {
		child.once("message", (message: { ready?: boolean }) => (message.ready ? resolve() : reject(new Error("Renderer failed to start"))))
		child.once("error", reject)
	})
	child.on("message", (message: { id?: number; png?: string; error?: string }) => {
		const job = slot.job
		if (!job || message.id !== job.id) return
		clearTimeout(slot.timer)
		slot.job = null
		if (message.png) job.resolve(Buffer.from(message.png, "base64"))
		else job.reject(new Error(message.error ?? "Render failed"))
		next()
	})
	child.on("exit", (code, signal) => {
		if (slot.child !== child) return
		slot.child = null
		slot.ready = null
		fail(slot, new Error(`Renderer exited (${signal ?? code})`))
		next()
	})
}

function next() {
	for (const slot of slots) {
		if (slot.job || !queue.length) continue
		const job = queue.shift() as Job
		slot.job = job
		if (!slot.child) spawn(slot)
		const child = slot.child as ChildProcess
		;(slot.ready as Promise<void>)
			.then(() => {
				slot.timer = setTimeout(() => {
					fail(slot, new Error(`Render timed out after ${RENDER_TIMEOUT_MS} ms`))
					child.kill("SIGKILL")
				}, RENDER_TIMEOUT_MS)
				child.send({ id: job.id, tree: job.tree, width: job.width, height: job.height })
			})
			.catch((error) => {
				fail(slot, error)
				child.kill("SIGKILL")
			})
	}
}

type Plain = string | number | null | Plain[] | { type: string; props: Record<string, unknown> & { children: Plain } }

// Calls every component, so only plain elements with serializable props cross to the child.
function resolveTree(node: ReactNode): Plain {
	if (node === null || node === undefined || typeof node === "boolean") return null
	if (typeof node === "string" || typeof node === "number") return node
	if (Array.isArray(node)) return node.map(resolveTree)
	if (!isValidElement(node)) return null
	const element = node as ReactElement<Record<string, unknown>>
	if (typeof element.type === "function") return resolveTree((element.type as (p: unknown) => ReactNode)(element.props))
	if ((element.type as unknown) === Fragment) return resolveTree(element.props.children as ReactNode)
	const props: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(element.props)) {
		if (key === "children" || key.startsWith("data-") || typeof value === "function") continue
		props[key] = value
	}
	return { type: element.type as string, props: { ...props, children: resolveTree(element.props.children as ReactNode) } }
}

function renderTree(tree: Plain, width: number, height: number) {
	return new Promise<Buffer>((resolve, reject) => {
		queue.push({ id: nextId++, tree, width, height, resolve, reject })
		next()
	})
}

// Posters and backdrops repeat across cards and renders, so their data URIs are shared, with one retry.
const IMAGE_CACHE_MAX = 300
const imageCache = new Map<string, Promise<string | null>>()
function cachedImage(url: string | null): Promise<string | null> {
	if (!url) return Promise.resolve(null)
	let image = imageCache.get(url)
	if (!image) {
		image = toDataUri(url)
			.then((uri) => uri ?? toDataUri(url))
			.then((uri) => {
				if (!uri) imageCache.delete(url)
				return uri
			})
		if (imageCache.size >= IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value as string)
		imageCache.set(url, image)
	}
	return image
}

const inlineTitle = async (item: CardTitle): Promise<CardTitle> => ({
	...item,
	poster: await cachedImage(item.poster),
	backdrop: await cachedImage(item.backdrop),
})

/** Renders a card at its design's native size. Rejects when the render fails, times out, or crashes the renderer. */
export async function renderShareCard(design: CardDesign, props: Omit<CardProps, "editing">, editing = false): Promise<Buffer> {
	const items = await Promise.all(props.items.map(inlineTitle))
	const tree = resolveTree(<design.Card {...props} items={items} editing={editing} />)
	return renderTree(tree, design.w, design.h)
}

/** Ends the renderer processes, so a script can exit. */
export function stopShareCardRenderers() {
	for (const slot of slots) {
		const child = slot.child
		slot.child = null
		child?.kill()
	}
}
