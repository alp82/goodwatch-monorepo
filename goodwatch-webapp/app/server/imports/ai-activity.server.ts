// The Imports page's "Your AI app" source, on the server: what the member's AI app changed through the MCP server
// since the member opened that source, with posters, and Undo all for those changes.
import { listConnectedApps } from "~/server/auth/connected-apps.server"
import { execute, query } from "~/utils/crate"
import {
	type AiActionRow,
	type AiActivity,
	type AiTitleChange,
	summarizeAiActions,
} from "./ai-activity.ts"

/** The most calls one read looks at: 50 titles each is far more than one list. */
const MAX_ACTIONS = 200
/** How far back a reading may start, so an old timestamp can't read a member's whole history. */
export const MAX_LOOKBACK_MS = 6 * 60 * 60 * 1000

export interface AiActivityTitle extends AiTitleChange {
	posterPath: string | null
}

export interface AiActivityResponse extends Omit<AiActivity, "titles"> {
	titles: AiActivityTitle[]
	/** The member's connected AI app with the latest use, or null when none is connected or it can't be read. */
	app: {
		name: string
		kind: "claude" | "claude-code" | "chatgpt" | null
	} | null
	/** False only when the member's connected apps were read and there are none. */
	connected: boolean
}

export const sinceFrom = (raw: string | null, now = Date.now()) => {
	const value = Number(raw)
	if (!Number.isFinite(value) || value <= 0) return now
	return Math.min(now, Math.max(value, now - MAX_LOOKBACK_MS))
}

async function readRows(userId: string, since: number) {
	const rows = await query<{
		action_id: string
		created_at: number | string
		result: string | null
	}>(
		`SELECT action_id, created_at, result FROM user_mcp_action
		 WHERE user_id = ? AND created_at >= ? ORDER BY created_at LIMIT ${MAX_ACTIONS}`,
		[userId, new Date(since)],
	)
	return rows.map(
		(row): AiActionRow => ({
			action_id: row.action_id,
			created_at: new Date(row.created_at).getTime(),
			result: row.result,
		}),
	)
}

async function posters(titles: AiTitleChange[]) {
	const found = new Map<string, string | null>()
	for (const kind of ["movie", "show"] as const) {
		const ids = titles.filter((t) => t.mediaType === kind).map((t) => t.tmdbId)
		if (!ids.length) continue
		const rows = await query<{ tmdb_id: number; poster_path: string | null }>(
			`SELECT tmdb_id, poster_path FROM ${kind} WHERE tmdb_id = ANY(?)`,
			// node-crate sends arrays as JSON arrays; its parameter type only names scalars.
			[ids as never],
		).catch(() => [])
		for (const row of rows) found.set(`${kind}:${row.tmdb_id}`, row.poster_path)
	}
	return found
}

async function connection(request: Request) {
	const apps = await listConnectedApps(request).catch(() => null)
	if (apps === null) return { connected: true, app: null }
	const latest = [...apps].sort((a, b) =>
		(b.lastUsedAt ?? b.connectedAt).localeCompare(
			a.lastUsedAt ?? a.connectedAt,
		),
	)[0]
	return {
		connected: apps.length > 0,
		app: latest ? { name: latest.app.name, kind: latest.app.kind } : null,
	}
}

export async function readAiActivity(
	request: Request,
	userId: string,
	since: number,
): Promise<AiActivityResponse> {
	const [rows, link] = await Promise.all([
		readRows(userId, since),
		connection(request),
	])
	const activity = summarizeAiActions(rows)
	const found = await posters(activity.titles)
	return {
		...activity,
		...link,
		titles: activity.titles.map((title) => ({
			...title,
			posterPath: found.get(title.key) ?? null,
		})),
	}
}

/** Takes back every batch call since `since` that isn't taken back yet, through the same undo the MCP server uses. */
export async function undoAiActivity(
	request: Request,
	userId: string,
	since: number,
): Promise<AiActivityResponse> {
	const activity = summarizeAiActions(await readRows(userId, since))
	const origin = new URL(request.url).origin
	const { writeMemberTool } = await import("~/server/mcp/writes.server")
	for (const batchId of activity.batches) {
		if (activity.undone.includes(batchId)) continue
		await writeMemberTool(userId, origin, "undo_watch", {
			action_id: `imports-undo:${batchId}`,
			batch_id: batchId,
		})
	}
	// The undo receipts were just written; make them readable before reporting.
	await execute("REFRESH TABLE user_mcp_action").catch(() => undefined)
	return readAiActivity(request, userId, since)
}
