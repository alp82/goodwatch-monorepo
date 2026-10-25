import { createHash } from "node:crypto"
import type { FeedbackInput } from "./schema.ts"
export type CorrectionStatus =
	| "pending"
	| "live"
	| "rejected"
	| "reverted"
	| "withdrawn"
export interface Correction {
	id: string
	entity_kind: "movie" | "show" | "person"
	tmdb_id: number
	target: NonNullable<FeedbackInput["data"]>["target"]
	field: string
	op: "set" | "add" | "remove"
	value: unknown
	old_value: unknown
	status: CorrectionStatus
	member_id: string | null
	provider_name?: string
	provider_logo?: string
	reviewer: string | null
	report_id: string
	source_link: string | null
	created_at: number
	updated_at: number
}
export function trustedAccount(
	memberId: string | null,
	facts: { staff?: boolean; createdAt?: number; kept?: number },
	now = Date.now(),
) {
	return (
		!!memberId &&
		(!!facts.staff ||
			(facts.createdAt !== undefined &&
				now - facts.createdAt >= 90 * 86400000) ||
			(facts.kept ?? 0) >= 3)
	)
}
export function mapCorrection(data: FeedbackInput["data"]) {
	if (
		!data ||
		!["movie", "show", "person"].includes(data.entityKind) ||
		!Number.isSafeInteger(Number(data.ids.tmdbId)) ||
		Number(data.ids.tmdbId) <= 0
	)
		return null
	const t = data.target ?? {},
		key = `${data.area}/${data.problem}`
	let field: string,
		op: Correction["op"] = "set",
		review = false
	switch (key) {
		case "details/date":
			if (data.entityKind === "person") return null
			field = data.entityKind === "movie" ? "release_date" : "first_air_date"
			break
		case "episodes/ep-title":
		case "episodes/ep-date":
			if (
				data.entityKind !== "show" ||
				t.seasonNumber === undefined ||
				t.episodeNumber === undefined
			)
				return null
			field = data.problem === "ep-title" ? "name" : "air_date"
			break
		case "cast/character":
		case "cast/not-in-it":
			if (data.entityKind === "person" || !t.personId) return null
			field = "character"
			if (data.problem === "not-in-it") {
				op = "remove"
				review = true
			}
			break
		case "credits/role":
		case "credits/not-theirs":
			if (data.entityKind !== "person" || !t.creditTmdbId || !t.creditMediaType)
				return null
			field = "role"
			if (data.problem === "not-theirs") {
				op = "remove"
				review = true
			}
			break
		case "watch/not-there":
		case "watch/missing":
			if (
				data.entityKind === "person" ||
				!t.providerId ||
				!t.offerType ||
				!(t.country ?? data.country)
			)
				return null
			field = "offer"
			op = data.problem === "missing" ? "add" : "remove"
			review = op === "add" && !data.sourceLink
			break
		default:
			return null
	}
	if (
		op === "set" &&
		(typeof data.suggestedValue !== "string" || !data.suggestedValue.trim())
	)
		return null
	if (field.endsWith("date")) {
		const v = String(data.suggestedValue)
		if (
			!/^\d{4}-\d{2}-\d{2}$/.test(v) ||
			!Number.isFinite(Date.parse(v)) ||
			new Date(v).toISOString().slice(0, 10) !== v
		)
			return null
	}
	const target =
		field === "offer"
			? {
					providerId: t.providerId,
					offerType: t.offerType,
					country: t.country ?? data.country,
				}
			: field === "character"
				? { personId: t.personId }
				: field === "role"
					? { creditTmdbId: t.creditTmdbId, creditMediaType: t.creditMediaType }
					: field === "name" || field === "air_date"
						? { seasonNumber: t.seasonNumber, episodeNumber: t.episodeNumber }
						: {}
	return {
		entity_kind: data.entityKind as Correction["entity_kind"],
		tmdb_id: Number(data.ids.tmdbId),
		target,
		field,
		op,
		value: data.suggestedValue ?? null,
		old_value: data.currentValue ?? null,
		review,
	}
}
export const correctionKey = (
	c: Pick<Correction, "entity_kind" | "tmdb_id" | "target" | "field">,
) =>
	createHash("sha256")
		.update(
			JSON.stringify([
				c.entity_kind,
				c.tmdb_id,
				c.field,
				Object.entries(c.target ?? {})
					.filter(([, v]) => v != null)
					.sort(([a], [b]) => a.localeCompare(b)),
			]),
		)
		.digest("hex")
export const flagArea = (area?: string) =>
	["analysis", "scores", "score", "standout", "media", "related"].includes(
		area ?? "",
	)
export function feedbackStaff(
	user: string | undefined,
	roles: string[] = [],
	env: Record<string, string | undefined> = process.env,
) {
	const ids = (v?: string) =>
		(v ?? "")
			.split(",")
			.map((x) => x.trim())
			.filter(Boolean)
	return (
		!!user &&
		(ids(env.DISCORD_FEEDBACK_STAFF_USER_IDS).includes(user) ||
			roles.some((r) => ids(env.DISCORD_FEEDBACK_STAFF_ROLE_IDS).includes(r)))
	)
}
