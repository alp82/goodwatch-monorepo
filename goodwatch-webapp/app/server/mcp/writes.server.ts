import { createHash } from "node:crypto"
import { titleKey } from "../../utils/title-key"
import {
	updateNotInterestedMany,
	updateWishListMany,
} from "../library-many.server"
import { type Score, updateScores } from "../scores.server"
import { applyShowTrackingAction } from "../show-tracking.server"
import { markTasteChanged } from "../taste/index.server"
import { getDisplayFields } from "../title-cards.server"
import {
	getUserData,
	resetUserDataCache,
	withDeferredUserDataReset,
} from "../userData.server"
import { applyWatchLogAction } from "../watch-log.server"
import {
	actionHash,
	readAction,
	readActionResult,
	runAction,
} from "./actions.server"
import {
	MAX_BATCH_ITEMS,
	type Ports,
	isBatchTool,
	runBatch,
	splitMessage,
	undoBatch,
} from "./batch.server.ts"
import { type CatalogTitle, resolve, summary } from "./data.server.ts"
import {
	prepareServices,
	savedServices,
	writeServices,
} from "./services.server"
import {
	applyTitleWrite,
	partLabel,
	partOf,
	snapshot,
	writePartScore,
} from "./title-write.server.ts"
import type { ReadArgs } from "./tools.server"
import type { WriteToolName } from "./write-names.ts"
import { type WriteArgs, itemSchemas } from "./write-tools.server.ts"

/** Everything a title write reads and writes, so tests can run the single and batch paths without Crate. */
export interface WritePorts extends Ports {
	readAction: typeof readAction
	runAction: typeof runAction
}

export const liveWritePorts: WritePorts = {
	readAction,
	runAction,
	resolve,
	async titlesById(keys) {
		const displays = await getDisplayFields(
			keys.map((key) => titleKey(key.media_type, key.tmdb_id)),
		)
		const found = new Map<string, CatalogTitle>()
		for (const key of keys) {
			const display = displays.get(titleKey(key.media_type, key.tmdb_id))
			if (display) found.set(`${key.media_type}:${key.tmdb_id}`, display)
		}
		return found
	},
	userData: (userId) => getUserData({ user_id: userId }),
	snapshot,
	applyTitleWrite,
	wishlistMany: updateWishListMany,
	notInterestedMany: updateNotInterestedMany,
	deferResets: withDeferredUserDataReset,
	resetUserData: (userId) => resetUserDataCache({ user_id: userId }),
	markTasteChanged,
	summary,
	readReceipt: readActionResult,
	updateScores: (input) =>
		updateScores({ ...input, score: input.score as Score | null }),
	async setPartScore({ user_id, tmdb_id, season, episode, score }) {
		const refused = await writePartScore(
			user_id,
			{ media_type: "show", tmdb_id },
			{ season, ...(episode !== undefined ? { episode } : {}) },
			score,
		)
		if (refused) throw new Error(refused.refused)
	},
	deleteMovieWatch: (userId, movieId, watchId) =>
		applyWatchLogAction(userId, movieId, { type: "delete", watchId }),
	showEvent: (userId, showId, event) =>
		applyShowTrackingAction(userId, { id: showId, event }),
}

/**
 * The ID of the watches and groups one action makes: a single call's own (unchanged since the first release), or
 * one per batch item. An item's key is JSON, so no single call's action_id can produce it.
 */
const writeActionId = (userId: string, actionId: string, item?: number) =>
	`mcp-${createHash("sha256")
		.update(
			item === undefined
				? `${userId}:${actionId}`
				: JSON.stringify([userId, actionId, item]),
		)
		.digest("hex")}`

/** A batch is undone once: every undo of it shares this receipt, so a repeat replays the first undo. */
export const batchUndoKey = (batchId: string) => `batch-undo:${batchId}`

export async function writeMemberTool(
	userId: string,
	origin: string,
	name: WriteToolName,
	input: WriteArgs,
	ports: WritePorts = liveWritePorts,
): Promise<Record<string, unknown>> {
	const { readAction, runAction } = ports
	let args = input
	const legacyHash = actionHash(name, args)
	// Canonicalize ignored selectors before hashing, so an ID-only retry replays the same action.
	if (args.title_id) {
		const { title_name: _name, year: _year, ...byId } = args
		args = byId
	}
	const normalizeSelector = (selector: ReadArgs) => {
		if (!selector.title_id) return selector
		const { title_name: _name, year: _year, ...byId } = selector
		return byId
	}
	if (args.titles)
		args = { ...args, titles: args.titles.map(normalizeSelector) }
	if (args.add_titles)
		args = { ...args, add_titles: args.add_titles.map(normalizeSelector) }
	if (args.items) args = { ...args, items: args.items.map(normalizeSelector) }
	// The schema caps items too; this holds for any caller, and claims no receipt for a call that can't run.
	if (args.items && args.items.length > MAX_BATCH_ITEMS)
		return { outcome: "refused", message: splitMessage(origin) }
	const hash = actionHash(name, args)
	const prior = await readAction(userId, args.action_id, hash)
	if (prior) {
		// Existing exact retries may predate selector normalization. Never re-execute them.
		if (prior.outcome === "action_id_conflict" && legacyHash !== hash)
			return (await readAction(userId, args.action_id, legacyHash)) ?? prior
		return prior
	}
	if (name === "set_settings")
		return (await import("./settings.server")).changeSettings(
			userId,
			origin,
			args,
			hash,
		)
	if (name === "create_list" || name === "update_list_titles")
		return (await import("./lists.server")).changeList(
			userId,
			origin,
			name,
			args,
			hash,
		)

	if (name === "set_my_services") {
		const prepared = await prepareServices(args)
		if ("result" in prepared) return prepared.result
		return runAction(
			userId,
			args.action_id,
			hash,
			async () => {
				const before = await savedServices(userId)
				await writeServices(userId, prepared.country, prepared.ids)
				await resetUserDataCache({ user_id: userId })
				await markTasteChanged(userId)
				const after = await savedServices(userId)
				return {
					outcome:
						JSON.stringify(before) === JSON.stringify(after)
							? "unchanged"
							: "applied",
					action_id: args.action_id,
					before,
					after,
				}
			},
			{
				tool: name,
				requested: { country: prepared.country, service_ids: prepared.ids },
			},
		)
	}
	if (args.items && isBatchTool(name)) {
		const batch = args
		return runAction(
			userId,
			batch.action_id,
			hash,
			() =>
				runBatch(ports, itemSchemas, userId, origin, name, batch, (index) =>
					writeActionId(userId, batch.action_id, index),
				),
			{
				tool: name,
				batch: true,
				batch_id: batch.action_id,
				item_count: batch.items?.length,
			},
		)
	}
	if (name === "undo_watch" && args.batch_id) {
		const undo = { ...args, batch_id: args.batch_id }
		const key = batchUndoKey(undo.batch_id)
		const undoHash = actionHash(name, { batch_id: undo.batch_id })
		const earlier = await readAction(userId, key, undoHash)
		if (earlier) return earlier
		return runAction(
			userId,
			key,
			undoHash,
			() => undoBatch(ports, userId, origin, undo),
			{ tool: name, batch_id: undo.batch_id },
		)
	}
	const resolved = await ports.resolve(args, origin)
	if ("result" in resolved) return { ...resolved.result, outcome: "unresolved" }
	const title = resolved.title
	return runAction(
		userId,
		args.action_id,
		hash,
		async () => {
			const part = partOf(name, args)
			const before = await ports.snapshot(userId, title, undefined, part)
			const actionId = writeActionId(userId, args.action_id)
			const write = await ports.applyTitleWrite(
				userId,
				origin,
				name,
				args,
				title,
				before,
				actionId,
			)
			if ("refused" in write)
				return { outcome: "refused", message: write.refused }
			const removedWatchId = write.removedWatchId
			await ports.resetUserData(userId)
			// A season or episode score changes nothing taste reads.
			if (!part) await ports.markTasteChanged(userId)
			const after = await ports.snapshot(userId, title, undefined, part)
			return {
				outcome:
					JSON.stringify(before) === JSON.stringify(after)
						? "unchanged"
						: "applied",
				action_id: args.action_id,
				title: ports.summary(title, origin),
				...(part ? { part: partLabel(part) } : {}),
				before: {
					...before,
					watch_count: before.watches.length,
					watches: before.watches.slice(0, 20),
				},
				after: {
					...after,
					watch_count: after.watches.length,
					watches: after.watches.slice(0, 20),
				},
				changes: {
					watches_added: after.watches.filter(
						(watch) =>
							!before.watches.some((old) => old.id === watch.id) &&
							(name === "log_watch"
								? watch.id === actionId || watch.group_id === actionId
								: name === "set_show_status"
									? watch.group_id === actionId
									: (name === "rate_title" || name === "undo_watch") &&
										watch.origin === "score"),
					),
					watches_removed: before.watches.filter(
						(watch) =>
							!after.watches.some((next) => next.id === watch.id) &&
							(name === "undo_watch"
								? watch.id === removedWatchId
								: (name === "log_watch" || name === "rate_title") &&
									watch.origin === "score"),
					),
				},
			}
		},
		{ tool: name, title: summary(title, origin) },
	)
}
