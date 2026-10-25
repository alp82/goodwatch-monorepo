import { execute } from "~/utils/crate"
import { createCorrectionStore, type Sql } from "./correction-store.server"
import { announceCorrectionReset } from "./cache-revision.server"
import { feedbackStaff, trustedAccount, type Correction } from "./corrections"
import { nativeFetch } from "../native-fetch.server"
const run = execute as Sql
async function invalidate(c: Correction) {
	try {
		const ids: [string, number][] = [[c.entity_kind, c.tmdb_id]]
		if (c.target?.personId) ids.push(["person", c.target.personId])
		if (c.target?.creditTmdbId)
			ids.push([
				c.target.creditMediaType === "tv" ? "show" : "movie",
				c.target.creditTmdbId,
			])
		// Every process drops only these entities' pages (cache-revision.server.ts). Data caches keep their
		// entries: the readers apply live corrections after the cache.
		await announceCorrectionReset({
			paths: ids.map(([kind, id]) => `/${kind}/${id}`),
			...(c.field === "offer" && c.target?.country
				? { country: c.target.country }
				: {}),
		})
		const { forgetStoredCard } = await import("../og-image/store.server")
		const { getRedisCluster } = await import("../../utils/cache")
		const paths = await run(
			"SELECT payload, metadata, message, member_id, created_at, discord_message_id, discord_thread_id FROM doc.feedback_report WHERE id = ?",
			[c.report_id],
		)
		const original = (
			paths.json?.[0] as { metadata?: { url?: string } }
		)?.metadata?.url?.split("?")[0]
		const { titlePath, personPath } = await import("../../utils/helpers")
		const canonicalPaths = await Promise.all(
			ids.map(async ([kind, id]) => {
				const column = kind === "person" ? "name" : "title"
				const result = await run(
					`SELECT ${column} AS label FROM doc.${kind} WHERE tmdb_id = ?`,
					[id],
				)
				const label = (result.json?.[0] as { label?: string })?.label
				return label
					? kind === "person"
						? personPath(id, label)
						: titlePath(kind, id, label)
					: `/${kind}/${id}`
			}),
		)
		await Promise.all(
			[
				...new Set([
					...ids.map(([kind, id]) => `/${kind}/${id}`),
					...canonicalPaths,
					...(original ? [original] : []),
				]),
			].map((path) => forgetStoredCard(getRedisCluster(), path)),
		)
		const report = paths.json?.[0] as
			| {
					payload: import("./schema").FeedbackInput["data"]
					metadata: Record<string, unknown>
					message: string
					member_id: string | null
					created_at: number
					discord_message_id?: string
					discord_thread_id?: string
			  }
			| undefined
		if (
			report?.discord_message_id &&
			report.discord_thread_id &&
			process.env.DISCORD_BOT_TOKEN
		) {
			try {
				const { reportComponents, MESSAGE_FLAGS } = await import(
					"./discord-post"
				)
				const response = await nativeFetch(
					`https://discord.com/api/v10/channels/${report.discord_thread_id}/messages/${report.discord_message_id}`,
					{
						method: "PATCH",
						headers: {
							Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
							"Content-Type": "application/json",
						},
						signal: AbortSignal.timeout(3000),
						body: JSON.stringify({
							content: null,
							flags: MESSAGE_FLAGS,
							allowed_mentions: { parse: [] },
							components: reportComponents(
								{
									id: c.report_id,
									kind: "data",
									message: report.message,
									data: report.payload,
									metadata: report.metadata,
									memberId: report.member_id,
									createdAt: report.created_at,
									dedupeKey: null,
									correction: c,
								},
								{
									origin: process.env.APP_ORIGIN ?? "https://goodwatch.app",
									screenshotInline: false,
									interactive: true,
								},
							),
						}),
					},
				)
				if (!response.ok)
					console.error("[feedback] correction post update failed", {
						reportId: c.report_id,
					})
			} catch {
				console.error("[feedback] correction post update failed", {
					reportId: c.report_id,
				})
			}
		}
	} catch {
		console.error("[feedback] correction cache reset incomplete", {
			correctionId: c.id,
		})
	}
}
export const correctionStore = createCorrectionStore(run, invalidate)
/** All trust decisions share this function. Identity and account age come from the fresh session. */
export async function isTrusted(memberId: string | null, createdAt?: number) {
	if (!memberId) return false
	if (trustedAccount(memberId, { createdAt })) return true
	let staff = false
	try {
		const { getUserLink } = await import("../discord/link.server")
		const link = await getUserLink(memberId)
		if (link) {
			staff = feedbackStaff(link.discord_user_id)
			if (
				!staff &&
				process.env.DISCORD_BOT_TOKEN &&
				process.env.DISCORD_FEEDBACK_FORUM_CHANNEL_ID
			) {
				const headers = {
					Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
				}
				const channel = await nativeFetch(
					`https://discord.com/api/v10/channels/${process.env.DISCORD_FEEDBACK_FORUM_CHANNEL_ID}`,
					{ headers, signal: AbortSignal.timeout(1500) },
				)
				const guild = channel.ok ? (await channel.json()).guild_id : null
				if (guild) {
					const member = await nativeFetch(
						`https://discord.com/api/v10/guilds/${guild}/members/${link.discord_user_id}`,
						{ headers, signal: AbortSignal.timeout(1500) },
					)
					if (member.ok)
						staff = feedbackStaff(
							link.discord_user_id,
							(await member.json()).roles,
						)
				}
			}
		}
	} catch {
		/* Staff lookup failure never grants trust. */
	}
	if (trustedAccount(memberId, { staff, createdAt })) return true
	try {
		const kept = await run(
			"SELECT count(*) AS kept FROM doc.catalog_correction WHERE member_id = ? AND status = 'live'",
			[memberId],
		)
		return trustedAccount(memberId, {
			kept: Number((kept.json?.[0] as { kept: number })?.kept ?? 0),
		})
	} catch {
		return false
	}
}
