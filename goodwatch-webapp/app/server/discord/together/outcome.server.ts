import type { Session } from "./store.server.ts"
export const OUTCOME_COLUMNS = [
	"session_id",
	"guild_id",
	"channel_id",
	"message_id",
	"starter_id",
	"type",
	"mood",
	"status",
	"decided_tmdb_id",
	"decided_media_type",
	"participant_count",
	"created_at",
	"ended_at",
] as const
/** Explicit allowlist: live ballots, picks, names, and webhook credentials never reach Crate. */
export function outcomeRow(session: Session) {
	const m = session.meta
	const [kind, id] = m.decidedTitleId?.split(":") ?? []
	return [
		m.id,
		m.guildId,
		m.channelId ?? null,
		m.messageId ?? null,
		m.starterId,
		m.type,
		m.mood ?? null,
		m.status,
		id ? Number(id) : null,
		kind ?? null,
		m.participantCount ?? session.summary.participantCount,
		m.createdAt,
		m.endedAt ?? null,
	]
}
export function createOutcomeWriter(
	execute: (sql: string, args: (string | number | null)[]) => Promise<unknown>,
	log: (line: string) => void,
) {
	let missingLogged = false
	return async (session: Session) => {
		if (session.meta.status === "open") return
		try {
			await execute(
				`INSERT INTO discord_together (${OUTCOME_COLUMNS.join(
					", ",
				)}) VALUES (${OUTCOME_COLUMNS.map(() => "?").join(
					", ",
				)}) ON CONFLICT (session_id) DO NOTHING`,
				outcomeRow(session),
			)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			if (
				/discord_together/i.test(message) &&
				/RelationUnknown|unknown relation|does not exist/i.test(message)
			) {
				if (!missingLogged) {
					log("DISCORD: discord_together table unavailable")
					missingLogged = true
				}
			} else log("DISCORD: together outcome write failed")
		}
	}
}
export const writeOutcome = createOutcomeWriter(
	async (sql, args) => {
		const { execute } = await import("../../../utils/crate")
		// The shared wrapper omits null from its parameter type; Crate accepts JSON null parameters.
		return execute(sql, args as (string | number)[])
	},
	(line) => console.warn(line),
)
