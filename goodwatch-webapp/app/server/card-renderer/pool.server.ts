// The card renderer: a small pool of child processes (render.child.js) that draw Open Graph cards and share list cards.
// satori and resvg block their thread, for about 0.3 seconds for an Open Graph card and about 20 seconds for a share
// list card, and resvg aborts its whole process on some inputs. In a child, a render never stalls the web server's
// event loop and an abort only ends that child. A crashed or stuck child fails its job and is replaced on the next one.
//
// Two kinds of jobs share the pool. "card" jobs (Open Graph cards) are short and are taken first. "list" jobs (share
// list cards) are long, so they never hold every child: with two or more children, one stays free for cards.
// A child holds about 350 MB once it has rendered, so one that has had no job for ten minutes is ended and the next
// job starts a new one, which adds about a second to that render.
// Both queues are bounded. A job that arrives at a full queue is rejected at once with CardRendererBusyError, so a
// burst of link-preview bots can't pile up renders without limit: the caller answers "busy" instead.
import { type ChildProcess, fork } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
	Fragment,
	type ReactElement,
	type ReactNode,
	isValidElement,
} from "react"
import { onShutdown } from "~/server/lifecycle.server"
import { gauge } from "~/server/metrics/registry.server"
import { separateEntryUrl } from "~/server/separate-entry.server"
import { CARD_FONTS, CARD_FONT_DIR } from "~/ui/share-card/fonts"

// The share card fonts are files: public/ in development, build/client/ once built. Relative to this module, with the
// working directory as a fallback.
function fontDir() {
	const here = fileURLToPath(new URL(".", import.meta.url))
	const candidates = [
		join(here, "../../../public", CARD_FONT_DIR),
		join(here, "../client", CARD_FONT_DIR),
		...["public", "build/client"].map((dir) =>
			join(process.cwd(), dir, CARD_FONT_DIR),
		),
	]
	const found = candidates.find((dir) =>
		existsSync(join(dir, CARD_FONTS[0].file)),
	)
	if (!found)
		throw new Error(`Share card fonts not found in ${candidates.join(" or ")}`)
	return found
}

// How many card and list jobs may wait for a child. Running jobs don't count.
const MAX_WAITING = { card: 24, list: 8 } as const
// How long a job may run once a child has it. A share list card took 20 seconds on a 4-core host.
const TIMEOUT_MS = { card: 15_000, list: 60_000 } as const
// How long a child without a job is kept.
export const IDLE_EXIT_MS = 10 * 60_000

export const POOL_SIZE =
	Number(process.env.CARD_RENDERERS) ||
	Number(process.env.SHARE_CARD_RENDERERS) ||
	2
export class CardRendererBusyError extends Error {}
export type Font = { name: string; weight: number; style: string; data: Buffer }
type Output = {
	name: string
	format: "png" | "jpeg"
	width: number
	qualities?: number[]
	maxBytes?: number
}
type Input = {
	kind: "card" | "list"
	tree: unknown
	width: number
	height: number
	fontSet: "share" | "og"
	dynamicAssets: boolean
	outputs: Output[]
}
type Job = Input & {
	id: number
	resolve: (images: Record<string, Buffer>) => void
	reject: (error: Error) => void
}
type Slot = {
	child: ChildProcess | null
	ready: boolean
	job: Job | null
	sentFonts: Set<string>
	timer?: NodeJS.Timeout
	idle?: NodeJS.Timeout
}
const slots: Slot[] = Array.from({ length: POOL_SIZE }, () => ({
	child: null,
	ready: false,
	job: null,
	sentFonts: new Set(),
}))
const queues: Record<Input["kind"], Job[]> = { card: [], list: [] }
const fonts = new Map<string, Font[]>()
let nextId = 1
let forkChild = () =>
	fork(
		separateEntryUrl("render.child.js", import.meta.url),
		[JSON.stringify({ fontDir: fontDir(), fonts: CARD_FONTS })],
		{
			serialization: "advanced",
			stdio: ["ignore", "inherit", "inherit", "ipc"],
		},
	)
export function setCardRendererForkForTest(fn: typeof forkChild) {
	forkChild = fn
}
/** A named set of fonts that exist only as bytes in the server bundle. Each child gets it once, before its first job. */
export function registerFontSet(name: string, data: Font[]) {
	fonts.set(name, data)
}
export function cardRendererStats() {
	return {
		running: slots.filter((s) => s.job).length,
		waitingCards: queues.card.length,
		waitingLists: queues.list.length,
	}
}
gauge("goodwatch_card_renderer_running", "Active card renders.", [], () => [
	{ labels: [], value: cardRendererStats().running },
])
gauge(
	"goodwatch_card_renderer_waiting",
	"Queued card renders.",
	["kind"],
	() => [
		{ labels: ["card"], value: queues.card.length },
		{ labels: ["list"], value: queues.list.length },
	],
)
function discard(slot: Slot, error: Error) {
	const child = slot.child
	slot.child = null
	slot.ready = false
	slot.sentFonts.clear()
	clearTimeout(slot.timer)
	clearTimeout(slot.idle)
	const job = slot.job
	slot.job = null
	job?.reject(error)
	child?.kill("SIGKILL")
	next()
}
// Ends a slot's child once it has had no job for a while. The timer doesn't keep a script's process alive.
function restWhenIdle(slot: Slot) {
	clearTimeout(slot.idle)
	slot.idle = setTimeout(() => {
		if (!slot.job) discard(slot, new Error("Renderer idle"))
	}, IDLE_EXIT_MS)
	slot.idle.unref?.()
}
function send(slot: Slot) {
	const { child, job } = slot
	if (!child || !slot.ready || !job) return
	try {
		for (const [name, data] of fonts) {
			if (slot.sentFonts.has(name)) continue
			child.send({ fonts: { [name]: data } })
			slot.sentFonts.add(name)
		}
		const timeout = TIMEOUT_MS[job.kind]
		slot.timer = setTimeout(
			() => discard(slot, new Error(`Render timed out after ${timeout} ms`)),
			timeout,
		)
		const { resolve, reject, ...input } = job
		child.send(input, (error) => {
			if (error && slot.child === child) discard(slot, error)
		})
	} catch (error) {
		discard(slot, error as Error)
	}
}
function spawn(slot: Slot) {
	const child = forkChild()
	slot.child = child
	// Bound startup too, so a child that never announces readiness cannot occupy a slot forever.
	slot.timer = setTimeout(
		() => discard(slot, new Error("Renderer startup timed out")),
		15_000,
	)
	child.on(
		"message",
		(message: {
			ready?: boolean
			id?: number
			images?: Record<string, Buffer>
			error?: string
		}) => {
			if (slot.child !== child) return
			if (message.ready) {
				clearTimeout(slot.timer)
				slot.ready = true
				send(slot)
				return
			}
			const job = slot.job
			if (!job || job.id !== message.id) return
			clearTimeout(slot.timer)
			slot.job = null
			if (message.images) job.resolve(message.images)
			else job.reject(new Error(message.error ?? "Render failed"))
			next()
			if (!slot.job) restWhenIdle(slot)
		},
	)
	child.on("error", (error) => {
		if (slot.child === child) discard(slot, error)
	})
	child.on("exit", () => {
		if (slot.child === child) discard(slot, new Error("Renderer exited"))
	})
}
function next() {
	for (const slot of slots) {
		if (slot.job) continue
		const lists = slots.filter((s) => s.job?.kind === "list").length
		const job =
			queues.card.shift() ??
			(lists < Math.max(1, POOL_SIZE - 1) ? queues.list.shift() : undefined)
		if (!job) continue
		slot.job = job
		clearTimeout(slot.idle)
		try {
			if (!slot.child) spawn(slot)
			else send(slot)
		} catch (error) {
			discard(slot, error as Error)
		}
	}
}
/** Renders one card. Rejects with CardRendererBusyError when the job's queue is full, and when the render fails. */
export function renderCard(input: Input): Promise<Record<string, Buffer>> {
	return new Promise((resolve, reject) => {
		const queue = queues[input.kind]
		if (queue.length >= MAX_WAITING[input.kind]) {
			reject(new CardRendererBusyError("Card renderer queue is full"))
			return
		}
		queue.push({ ...input, id: nextId++, resolve, reject })
		next()
	})
}
/** Ends the renderer processes and rejects what is queued, at shutdown or so that a script can exit. */
export function stopCardRenderers() {
	const error = new Error("Card renderers stopped")
	for (const queue of Object.values(queues))
		for (const job of queue.splice(0)) job.reject(error)
	for (const slot of slots) discard(slot, error)
}
onShutdown("card renderers", stopCardRenderers)
type Plain =
	| string
	| number
	| null
	| Plain[]
	| { type: string; props: Record<string, unknown> & { children: Plain } }

// Calls every component, so only plain elements with serializable props cross to the child.
export function resolveTree(node: ReactNode): Plain {
	if (node === null || node === undefined || typeof node === "boolean")
		return null
	if (typeof node === "string" || typeof node === "number") return node
	if (Array.isArray(node)) return node.map(resolveTree)
	if (!isValidElement(node)) return null
	const element = node as ReactElement<Record<string, unknown>>
	if (typeof element.type === "function")
		return resolveTree(
			(element.type as (p: unknown) => ReactNode)(element.props),
		)
	if ((element.type as unknown) === Fragment)
		return resolveTree(element.props.children as ReactNode)
	const props: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(element.props)) {
		if (
			key === "children" ||
			key.startsWith("data-") ||
			typeof value === "function"
		)
			continue
		props[key] = value
	}
	return {
		type: element.type as string,
		props: {
			...props,
			children: resolveTree(element.props.children as ReactNode),
		},
	}
}
