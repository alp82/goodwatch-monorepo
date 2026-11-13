import { roomSearch } from "./proposal-intent.ts"
import { releaseMembers } from "./proposal-release-members.ts"
import type { ContinuousMembers } from "./continuous-members.server.ts"
import { ReleaseControl } from "./proposal-release-control.ts"
import { SqlCreationQuotas } from './proposal-creation-quota.ts'
import { RoomRetention, cleanupRounds, hasDeletions } from './proposal-room-retention.ts'
import {
	API_PREFIX,
	REVISION_CHANNEL,
} from "../../../packages/yepwatch-contracts/proposal.ts"
import { createProposalHandler } from "./proposal-http.server.ts"
import { ProposalService, revisionMessage } from "./proposal-service.server.ts"
import type { TicketStore } from "./proposal-tickets.ts"
import type { CommandBudget } from "./proposal-command-budget.ts"
import type { Sql } from "./repository.server.ts"
import { RelationalProposalRepository } from "./proposal-relational-repository.ts"
import { checkReleaseStore } from "./proposal-release-store.ts"
import type { ProposalCatalog, ProposalRepository } from "./proposal-types.ts"
import type { RoomsValkey } from "./proposal-rooms-valkey.ts"
import { ValkeyRoomRepository } from "./proposal-valkey-repository.ts"
import { ValkeyReleaseControl } from "./proposal-valkey-control.ts"
import { ValkeyAccountRooms, MirroredDeletionStore } from "./proposal-valkey-accounts.ts"
import { HistorySync } from "./proposal-history-sync.ts"
import { ValkeyCommandBudget } from "./proposal-command-budget.ts"
import type { ReleaseConfig } from "./proposal-release-config.ts"
export const RELEASE_HEALTH = {
	live: `${API_PREFIX}/health/live`,
	ready: `${API_PREFIX}/health/ready`,
}
export interface ReleaseDependencies {
	sql: Sql
	catalog: ProposalCatalog
	memberCatalog?: (members: ContinuousMembers) => ProposalCatalog
	snapshot(): { count: number; version: string } | null
	catalogProbe(): Promise<void>
	/** The messaging connection: revision hints. */
	bus: {
		ping(): Promise<unknown>
		publish(channel: string, value: string): Promise<unknown>
	}
	/** The realtime tickets, shared by every API process (ValkeyTicketStore). Its check is part of readiness. */
	tickets: TicketStore
	/**
	 * The command rate limit, shared by every API process (ValkeyCommandBudget); its check is part of readiness.
	 * Without one, commands are charged on the control row like admissions.
	 */
	commands?: CommandBudget
	/**
	 * The dedicated rooms Valkey (docs/yepwatch-valkey-rooms.md): live rooms, capacity, admissions, account checks;
	 * Crate becomes the history copy. Without one, rooms stay in Crate (tests, local runners).
	 */
	rooms?: RoomsValkey
	now?: () => number
}
/** No guest identities, fixtures, DDL or fail-open readiness. Normal handler behavior stays in its existing module. */
export function createReleaseRuntime(
	config: ReleaseConfig,
	deps: ReleaseDependencies
) {
	const now = deps.now ?? Date.now
	const crateRepository = new RelationalProposalRepository(deps.sql, config.secret)
	const quotas = new SqlCreationQuotas(deps.sql, config.control.roomsPerPerson ?? 10)
	let repository: ProposalRepository = crateRepository
	let control: { check(): Promise<void> } & ConstructorParameters<typeof ProposalService>[5]
	let history: HistorySync | undefined
	if (deps.rooms) {
		const rooms = deps.rooms
		const deletions = new MirroredDeletionStore(rooms, crateRepository.deletionStore, () => history!.caughtUp())
		const live = new ValkeyRoomRepository(rooms, crateRepository, config.secret, {
			accounts: new ValkeyAccountRooms(rooms, crateRepository.accountStore, config.secret),
			deletions,
			retentionDays: config.roomRetentionDays,
			onCommit: () => history?.kickSoon(),
		})
		history = new HistorySync({
			redis: rooms,
			repository: live,
			crate: crateRepository,
			quotas,
			accounts: crateRepository.accountStore,
			deletions,
			retentionDays: config.roomRetentionDays,
		})
		repository = live
		control = new ValkeyReleaseControl(rooms, config.control, deps.commands ?? new ValkeyCommandBudget(rooms), quotas)
	} else control = new ReleaseControl(deps.sql, config.control, quotas, deps.commands)
	const members = config.member
		? releaseMembers(repository, config.member, fetch, config.secret)
		: undefined
	if (members && !deps.memberCatalog)
		throw new Error("Member catalog adapter required")
	const tickets = deps.tickets
	const service = new ProposalService(
		repository,
		members ? deps.memberCatalog!(members) : deps.catalog,
		config.secret,
		async (event) => {
			await deps.bus.publish(REVISION_CHANNEL, revisionMessage(event))
		},
		Date.now,
		control,
		roomSearch(process.env),
		{ tickets }
	)
	const handle = createProposalHandler(service, {
		serviceSecret: config.gatewaySecret,
		allowedOrigins: [config.publicOrigin],
		secureCookies: true,
		members,
	})
	let draining = false
	let initialized = false
	let checkedAt: number | null = null
	let probing: Promise<void> | undefined
	const checks = {
		snapshot: false,
		catalog: false,
		rooms: false,
		control: false,
		realtime: false,
		history: false,
	}
	/** With Valkey rooms, the Crate checks once started: they run on their own, never holding up a probe. */
	let crateChecking: Promise<void> | undefined
	function checkCrate() {
		crateChecking ??= Promise.allSettled([deps.catalogProbe(), checkReleaseStore(deps.sql, config.keyId, config.secret)])
			.then(([catalog, store]) => {
				checks.catalog = catalog.status === "fulfilled"
				checks.history = store.status === "fulfilled"
			})
			.finally(() => {
				crateChecking = undefined
			})
	}
	async function probe() {
		if (probing) return probing
		probing = (async () => {
			const started = Boolean(history && initialized)
			if (started) checkCrate()
			const results = await Promise.allSettled([
				Promise.resolve().then(() => {
					if (!deps.snapshot()?.count) throw new Error("Snapshot not loaded")
				}),
				started ? Promise.resolve() : deps.catalogProbe(),
				// Live rooms: in Valkey once its copies of Crate's tables are imported (the first probe imports them),
				// otherwise the Crate store.
				history ? control.check().then(() => history!.ensureMirrors()) : checkReleaseStore(deps.sql, config.keyId, config.secret),
				control.check(),
				Promise.all([deps.bus.ping(), tickets.check?.()]),
				// The Crate store (with Valkey rooms: the history copy). Needed to start, not to keep serving.
				started ? Promise.resolve() : checkReleaseStore(deps.sql, config.keyId, config.secret),
			])
			for (const [i, key] of (
				Object.keys(checks) as (keyof typeof checks)[]
			).entries())
				if (!started || (key !== "catalog" && key !== "history")) checks[key] = results[i].status === "fulfilled"
			checkedAt = now()
			if (Object.values(checks).every(Boolean) && !!deps.snapshot()?.count) {
				if (!initialized) history?.start()
				initialized = true
			}
		})().finally(() => {
			probing = undefined
		})
		return probing
	}
	function readiness() {
		const recent =
			checkedAt !== null &&
			now() - checkedAt <= Math.max(15000, config.probeMs * 3)
		const loaded = !!deps.snapshot()?.count
		// With Valkey rooms, Crate (the history copy, and the catalog queries once the snapshot is loaded) never takes a
		// started API out of service: rooms keep working on Valkey.
		const serving = Object.entries(checks).every(([k, ok]) => ok || ((k === "history" || k === "catalog") && history && initialized))
		return {
			ready: !draining && recent && loaded && serving,
			status: draining ? "draining" : "running",
			checks: { ...checks, snapshot: loaded },
			sourceCommit: config.sourceCommit,
			contractVersion: 3,
			mode: members ? "member" : "guest",
		}
	}
	async function handler(request: Request) {
		const path = new URL(request.url).pathname
		if (path === RELEASE_HEALTH.live && request.method === "GET")
			return Response.json(
				{ status: "live", sourceCommit: config.sourceCommit },
				{ headers: { "cache-control": "no-store" } }
			)
		if (path === RELEASE_HEALTH.ready && request.method === "GET") {
			const state = readiness()
			return Response.json(state, {
				status: state.ready ? 200 : 503,
				headers: { "cache-control": "no-store" },
			})
		}
		// Keep setup/commands truthful while unavailable: do not admit rooms before any startup preflight succeeded.
		if (!initialized)
			return Response.json(
				{
					error: {
						code: "busy",
						message: "YepWatch is starting; retry shortly",
						retryable: true,
					},
				},
				{ status: 503, headers: { "cache-control": "no-store" } }
			)
		return handle(request)
	}
	const timer = setInterval(() => void probe(), config.probeMs)
	timer.unref()
	let repairing = false
	const repair = setInterval(() => {
		if (repairing || draining || !readiness().ready) return
		void history?.kick()
		repairing = true
		void service
			.repair()
			.catch(() => {})
			.finally(() => {
				repairing = false
			})
	}, 2000)
	repair.unref()
	// Its own repository: rooms read for deletion stay out of the serving cache.
	const retention = new RoomRetention(deps.sql, new RelationalProposalRepository(deps.sql, config.secret), {
		retentionDays: config.roomRetentionDays,
	})
	// Every operation settles before the next round starts: a failed sibling never lets a second retention run begin.
	const cleanup = cleanupRounds(
		[
			() => service.deletions.purgeDue(now()),
			() => quotas.purgeExpired(),
			async () => {
				const report = await retention.run()
				if (hasDeletions(report)) console.log(JSON.stringify({ event: "yepwatch_room_retention", ...report }))
			},
		],
		() => console.error("YepWatch cleanup will retry")
	)
	const purge = setInterval(() => {
		// Pending ideas whose lease ran out in rooms nobody reads (bounded; same takeover as a read).
		if (!draining && readiness().ready) void service.resumeStaleInterpretations().catch(() => {})
		if (draining || !readiness().ready) return
		void cleanup()
	}, 60_000)
	purge.unref()
	return {
		handler,
		service,
		probe,
		readiness,
		/** True once a probe found the snapshot loaded and every dependency answering; it never turns false again. */
		initialized: () => initialized,
		drain() {
			draining = true
		},
		/** The history copy's loops, for shutdown (queued jobs stay in Valkey for the next process). */
		history,
		stop() {
			clearInterval(timer)
			clearInterval(repair)
			clearInterval(purge)
			return history?.stop()
		},
	}
}
