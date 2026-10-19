import { randomUUID } from "node:crypto"
import { NativeImportError } from "./store.server.ts"

export interface ResolutionStore {
	read(
		key: string,
	): Promise<{ value: unknown; version: number | string } | null>
	cas(
		key: string,
		version: number | string | null,
		value: unknown,
	): Promise<boolean>
	preview(member: string, id: string): Promise<boolean>
}
export type ResolutionPhase =
	| "watched_parents"
	| "episodes"
	| "other_parents"
	| "movies"
	| "publishing"
export interface ResolutionJob {
	root: string
	member: string
	activePreviewId: string
	generation: number
	state:
		| "queued"
		| "running"
		| "editing"
		| "completed"
		| "cancelled"
		| "limited"
		| "failed"
	phase: ResolutionPhase
	cursor: string
	total: number
	processed: number
	matched: number
	held: number
	failed: Record<string, number>
	attempts: number
	deadline: number
	leaseUntil: number
	owner: string | null
	updatedAt: number
	replacementId: string | null
	nonce: string
	snapshot: string
}
export interface ResolutionContext {
	job: ResolutionJob
	signal: AbortSignal
	check(): Promise<ResolutionJob>
	attempt(): Promise<void>
	commit(key: string, value: unknown): Promise<void>
}
export interface ResolutionStep {
	done: boolean
	cursor?: string
	processed: number
	matched: number
	held: number
	failed: Record<string, number>
}
const phases: ResolutionPhase[] = [
	"watched_parents",
	"episodes",
	"other_parents",
	"movies",
]
export const RESOLUTION_LIMITS = {
	page: 200,
	attempts: 25000,
	deadlineMs: 30 * 60_000,
	leaseMs: 60_000,
	heartbeatMs: 10_000,
} as const
function refusal(message: string, code: string): never {
	const error = new NativeImportError(409, message)
	error.code = code
	throw error
}
const slotsKey = "resolution/slots"
type Reservation = {
	root: string
	member: string
	deadline: number
	total: number
}
export class ResolutionStopped extends Error {
	constructor() {
		super("Resolution stopped")
		this.name = "ResolutionStopped"
	}
}
export class ResolutionBudget extends Error {
	constructor() {
		super("Resolution budget reached")
		this.name = "ResolutionBudget"
	}
}
const terminal = (state: ResolutionJob["state"]) =>
	["completed", "cancelled", "limited", "failed"].includes(state)
export const jobKey = (root: string) => `job/${root}`

export function createResolutionJobs(options: {
	store: ResolutionStore
	now?: () => number
	step: (ctx: ResolutionContext) => Promise<ResolutionStep>
	publish: (ctx: ResolutionContext) => Promise<string>
	finished?: (job: ResolutionJob) => Promise<void>
}) {
	const { store } = options
	const now = options.now ?? Date.now
	const active = new Map<string, AbortController>()
	async function read(root: string) {
		return (await store.read(jobKey(root)))?.value as ResolutionJob | undefined
	}
	async function update(
		root: string,
		change: (j: ResolutionJob) => ResolutionJob,
	) {
		for (let retry = 0; retry < 20; retry++) {
			const row = await store.read(jobKey(root))
			if (!row) throw new ResolutionStopped()
			const value = change(structuredClone(row.value as ResolutionJob))
			if (await store.cas(jobKey(root), row.version, value)) return value
		}
		throw new ResolutionStopped()
	}
	async function reserve(member: string, root: string, total: number) {
		for (let retry = 0; retry < 20; retry++) {
			const row = await store.read(slotsKey)
			const entries = (row?.value ?? []) as Reservation[]
			const live: Reservation[] = []
			for (const entry of entries) {
				const job = await read(entry.root)
				if (job && terminal(job.state)) await options.finished?.(job)
				if (job ? !terminal(job.state) : entry.deadline > now())
					live.push(entry)
			}
			if (live.some((x) => x.root === root)) return
			if (live.some((x) => x.member === member))
				refusal(
					"You already have an import matching. Wait for it to finish or discard it.",
					"tvtime_resolution_member_busy",
				)
			if (live.length >= 2)
				refusal(
					"Two imports are already matching. Try again after one finishes.",
					"tvtime_resolution_global_busy",
				)
			if (
				await store.cas(slotsKey, row?.version ?? null, [
					...live,
					{
						root,
						member,
						total,
						deadline: now() + RESOLUTION_LIMITS.deadlineMs,
					},
				])
			)
				return
		}
		refusal(
			"Import matching is busy. Please try again.",
			"tvtime_resolution_busy",
		)
	}
	async function admit(member: string, root: string, total: number) {
		await reserve(member, root, total)
		const reservations = (await store.read(slotsKey))?.value as
			| Reservation[]
			| undefined
		const reservation = reservations?.find(
			(entry) => entry.root === root && entry.member === member,
		)
		if (!reservation) throw new ResolutionStopped()
		const value: ResolutionJob = {
			root,
			member,
			activePreviewId: root,
			generation: 1,
			state: "queued",
			phase: "watched_parents",
			cursor: "",
			total,
			processed: 0,
			matched: 0,
			held: 0,
			failed: {},
			attempts: 0,
			deadline: reservation.deadline,
			leaseUntil: 0,
			owner: null,
			updatedAt: now(),
			replacementId: null,
			nonce: randomUUID(),
			snapshot: randomUUID(),
		}
		await store.cas(jobKey(root), null, value)
		return read(root)
	}
	async function run(root: string) {
		if (active.has(root)) return
		const abort = new AbortController()
		active.set(root, abort)
		let captured: ResolutionJob | undefined
		let context: ResolutionContext | undefined
		try {
			captured = await update(root, (j) => {
				if (
					terminal(j.state) ||
					((j.state === "running" || j.state === "editing") &&
						j.leaseUntil > now())
				)
					throw new ResolutionStopped()
				return {
					...j,
					state: "running",
					owner: randomUUID(),
					leaseUntil: now() + RESOLUTION_LIMITS.leaseMs,
					updatedAt: now(),
				}
			})
			const owner = captured.owner
			const generation = captured.generation
			const owned = (j: ResolutionJob) => {
				if (
					abort.signal.aborted ||
					j.owner !== owner ||
					j.generation !== generation ||
					j.state !== "running" ||
					j.leaseUntil <= now()
				)
					throw new ResolutionStopped()
				return j
			}
			const check = async () => {
				const j = await read(root)
				if (!j) throw new ResolutionStopped()
				owned(j)
				if (!(await store.preview(j.member, j.activePreviewId)))
					throw new ResolutionStopped()
				return j
			}
			const mutate = async (change: (j: ResolutionJob) => ResolutionJob) => {
				await check()
				return update(root, (j) => change(owned(j)))
			}
			const ctx: ResolutionContext = {
				job: captured,
				signal: abort.signal,
				check,
				async attempt() {
					await mutate((j) => {
						if (j.deadline <= now() || j.attempts >= RESOLUTION_LIMITS.attempts)
							throw new ResolutionBudget()
						return { ...j, attempts: j.attempts + 1 }
					})
				},
				async commit(key, value) {
					await check()
					for (let n = 0; n < 20; n++) {
						const row = await store.read(key)
						await check()
						if (await store.cas(key, row?.version ?? null, value)) return
					}
					throw new ResolutionStopped()
				},
			}
			context = ctx
			const heartbeat = setInterval(() => {
				void mutate((j) => ({
					...j,
					leaseUntil: now() + RESOLUTION_LIMITS.leaseMs,
					updatedAt: now(),
				})).catch(() => abort.abort())
			}, RESOLUTION_LIMITS.heartbeatMs)
			heartbeat.unref()
			try {
				for (;;) {
					ctx.job = await check()
					if (ctx.job.phase === "publishing") break
					if (
						ctx.job.deadline <= now() ||
						ctx.job.attempts >= RESOLUTION_LIMITS.attempts
					)
						throw new ResolutionBudget()
					const result = await options.step(ctx)
					captured = await mutate((j) => {
						const failed = { ...j.failed }
						for (const [code, count] of Object.entries(result.failed))
							failed[code] = (failed[code] ?? 0) + count
						const next = phases[phases.indexOf(j.phase) + 1]
						return {
							...j,
							processed: j.processed + result.processed,
							matched: j.matched + result.matched,
							held: j.held + result.held,
							failed,
							cursor: result.done ? "" : (result.cursor ?? j.cursor),
							phase: result.done ? (next ?? "publishing") : j.phase,
							updatedAt: now(),
						}
					})
					if (result.done && ctx.job.phase === "movies") break
				}
				ctx.job = await check()
				const replacementId = await options.publish(ctx)
				await check()
				await mutate((j) => ({
					...j,
					state: "completed",
					replacementId,
					activePreviewId: replacementId,
					leaseUntil: 0,
					owner: null,
					updatedAt: now(),
					snapshot: randomUUID(),
				}))
			} finally {
				clearInterval(heartbeat)
			}
		} catch (error) {
			if (error instanceof ResolutionStopped && captured) {
				const current = await read(root).catch(() => undefined)
				if (
					current?.owner === captured.owner &&
					current.generation === captured.generation &&
					current.state === "running" &&
					!(await store
						.preview(current.member, current.activePreviewId)
						.catch(() => true))
				)
					await update(root, (j) =>
						j.owner === captured?.owner && j.generation === captured?.generation
							? {
									...j,
									state: "cancelled",
									generation: j.generation + 1,
									owner: null,
									leaseUntil: 0,
									updatedAt: now(),
								}
							: j,
					).catch(() => {})
			}
			if (error instanceof ResolutionBudget && context) {
				try {
					context.job = await context.check()
					const replacementId = await options.publish(context)
					await context.check()
					await update(root, (j) => {
						if (
							j.owner !== captured?.owner ||
							j.generation !== captured?.generation
						)
							throw new ResolutionStopped()
						return {
							...j,
							state: "limited",
							replacementId,
							activePreviewId: replacementId,
							processed: j.total,
							held: j.total - j.matched,
							failed: {
								...j.failed,
								tvtime_lookup_budget_exhausted:
									(j.failed.tvtime_lookup_budget_exhausted ?? 0) +
									j.total -
									j.processed,
							},
							owner: null,
							leaseUntil: 0,
							updatedAt: now(),
							snapshot: randomUUID(),
						}
					})
					return
				} catch {}
			}
			if (captured && !(error instanceof ResolutionStopped))
				await update(root, (j) => {
					if (
						j.owner !== captured?.owner ||
						j.generation !== captured?.generation
					)
						return j
					const limited = error instanceof ResolutionBudget
					return {
						...j,
						state: limited ? "limited" : "failed",
						owner: null,
						leaseUntil: 0,
						held: limited ? Math.max(j.held, j.total - j.matched) : j.held,
						failed: {
							...j.failed,
							[limited
								? "tvtime_lookup_budget_exhausted"
								: "tvtime_resolution_failed"]:
								(j.failed[
									limited
										? "tvtime_lookup_budget_exhausted"
										: "tvtime_resolution_failed"
								] ?? 0) + 1,
						},
						updatedAt: now(),
					}
				}).catch(() => {})
			if (
				!(error instanceof ResolutionStopped) &&
				!(error instanceof ResolutionBudget)
			)
				throw error
		} finally {
			active.delete(root)
			const settled = await read(root).catch(() => undefined)
			if (settled && terminal(settled.state))
				await options.finished?.(settled).catch(() => {})
		}
	}
	async function cancel(member: string, root: string) {
		const existing = await read(root)
		if (!existing || existing.member !== member)
			throw new NativeImportError(404, "We couldn't find that import.")
		active.get(root)?.abort()
		return update(root, (j) => ({
			...j,
			state: "cancelled",
			generation: j.generation + 1,
			owner: null,
			leaseUntil: 0,
			updatedAt: now(),
		}))
	}
	async function edit(
		member: string,
		root: string,
		build: () => Promise<string>,
		expectedPreviewId?: string,
	) {
		const existing = await read(root)
		if (!existing || existing.member !== member)
			throw new NativeImportError(404, "We couldn't find that import.")
		const editing = await update(root, (j) => {
			if (expectedPreviewId && j.activePreviewId !== expectedPreviewId)
				refusal(
					"This preview has been replaced. Review the latest preview.",
					"tvtime_preview_replaced",
				)
			if (j.state === "editing" && j.leaseUntil > now())
				refusal(
					"This preview is changing. Try again in a moment.",
					"tvtime_preview_changing",
				)
			if (j.state === "cancelled")
				refusal(
					"This preview was discarded. Upload the file again.",
					"tvtime_preview_discarded",
				)
			return {
				...j,
				state: "editing",
				generation: j.generation + 1,
				snapshot: randomUUID(),
				owner: null,
				leaseUntil: now() + RESOLUTION_LIMITS.leaseMs,
				updatedAt: now(),
			}
		})
		active.get(root)?.abort()
		try {
			const id = await build()
			await update(root, (j) => {
				if (j.generation !== editing.generation || j.state !== "editing")
					throw new ResolutionStopped()
				return {
					...j,
					state: terminal(existing.state) ? "completed" : "queued",
					activePreviewId: id,
					replacementId: id,
					snapshot: randomUUID(),
					leaseUntil: 0,
					updatedAt: now(),
				}
			})
			return id
		} catch (e) {
			await update(root, (j) =>
				j.generation === editing.generation && j.state === "editing"
					? {
							...j,
							state: terminal(existing.state) ? "completed" : "queued",
							leaseUntil: 0,
						}
					: j,
			).catch(() => {})
			throw e
		}
	}
	async function reconcile(waitForCompletion = true) {
		const slots = (await store.read(slotsKey))?.value as
			| Reservation[]
			| undefined
		await Promise.all(
			(slots ?? []).map(async (entry) => {
				let j = await read(entry.root)
				if (!j && entry.deadline > now())
					j = await admit(entry.member, entry.root, entry.total)
				if (j && terminal(j.state)) await options.finished?.(j)
				if (j && !terminal(j.state) && j.leaseUntil <= now()) {
					const work = run(j.root)
					if (waitForCompletion) await work
					else void work.catch(() => {})
				}
			}),
		)
	}
	async function refreshSnapshot(
		member: string,
		root: string,
		preview: string,
	) {
		const current = await read(root)
		if (!current || current.member !== member) return undefined
		if (
			!["completed", "limited"].includes(current.state) ||
			current.activePreviewId !== preview ||
			current.updatedAt + 30 * 60_000 > now()
		)
			return current
		return update(root, (j) =>
			["completed", "limited"].includes(j.state) &&
			j.activePreviewId === preview &&
			j.updatedAt + 30 * 60_000 <= now()
				? { ...j, snapshot: randomUUID(), updatedAt: now() }
				: j,
		)
	}
	return { admit, read, run, cancel, edit, reconcile, refreshSnapshot }
}
