/** First-release relational schema. No dynamic objects or serialized domain documents. */
import { z } from "zod"
export interface Field {
	sql: string
	schema: z.ZodTypeAny
}
export type Fields = Record<string, Field>
const text = (max = 16384): Field => ({
	sql: "TEXT",
	schema: z.string().max(max),
})
const integer = (min = 0): Field => ({
	sql: "BIGINT",
	schema: z.number().int().safe().min(min),
})
const real: Field = { sql: "DOUBLE PRECISION", schema: z.number().finite() }
const bool: Field = { sql: "BOOLEAN", schema: z.boolean() }
const enumeration = (values: [string, ...string[]]): Field => ({
	sql: "TEXT",
	schema: z.enum(values),
})
const nullable = (f: Field): Field => ({
	sql: f.sql,
	schema: f.schema.nullable(),
})
const optional = (f: Field): Field => ({
	sql: f.sql,
	schema: f.schema.optional(),
})
export function object(fields: Fields): Field {
	return {
		sql: `OBJECT(STRICT) AS (${Object.entries(fields)
			.map(([k, v]) => `"${k}" ${v.sql}`)
			.join(",")})`,
		schema: z
			.object(
				Object.fromEntries(
					Object.entries(fields).map(([k, v]) => [k, v.schema])
				)
			)
			.strict(),
	}
}
const array = (f: Field, max = 2400): Field => ({
	sql: `ARRAY(${f.sql})`,
	schema: z.array(f.schema).max(max),
})
const strings = array(text())
const ref = nullable(text(128))
const refs = array(text(128), 2000)
const episode = object({
	tmdbId: integer(1),
	season: integer(),
	number: integer(),
	displaySeason: optional(integer()),
	displayNumber: optional(integer()),
	presentationVersion: optional(text()),
})
const identity = object({
	kind: enumeration(["movie", "show_start", "show_continue"]),
	tmdbId: integer(1),
	episode: optional(episode),
})
identity.schema = identity.schema.superRefine((v, ctx) => {
	if ((v.kind === "movie") === Boolean(v.episode))
		ctx.addIssue({
			code: "custom",
			message: "Movie/episode identity mismatch",
		})
})
const offer = object({
	serviceId: integer(1),
	name: text(),
	url: nullable(text()),
	kind: enumeration(["provider", "where_to_watch", "search"]),
	offerType: enumeration(["flatrate", "free", "ads"]),
})
export const availability = array(
	object({
		screenId: text(),
		state: enumeration(["watchable", "no_match", "unknown"]),
		scope: enumeration(["title", "episode"]),
		checkedAt: nullable(integer()),
		offers: array(offer, 100),
	}),
	12
)
const failure = object({
	type: enumeration(["deck", "catalog", "access"]),
	reason: text(),
	actions: strings,
	reasons: optional(strings),
	scannedTitles: optional(integer()),
	poolSize: optional(integer()),
	scanComplete: optional(bool),
	uncertainTitles: optional(integer()),
	noMatchTitles: optional(integer()),
	missingMetadataTitles: optional(integer()),
	missingEpisodeTitles: optional(integer()),
	screens: optional(
		array(
			object({
				screenId: text(),
				country: text(),
				serviceIds: array(integer(1), 100),
				watchable: integer(),
				noMatch: integer(),
				unknown: integer(),
			}),
			12
		)
	),
})
export const constraints = object({
	kinds: array(enumeration(["movie", "show_start", "show_continue"]), 3),
	maxMinutes: nullable(integer(1)),
	moods: strings,
})
export const stream = object({
	version: integer(),
	state: enumeration(["ready", "exhausted", "unavailable", "capacity"]),
	reason: nullable(
		enumeration([
			"catalog_end",
			"catalog_incomplete",
			"room_capacity",
			"awaiting_answers",
		])
	),
})
export const checkState = object({
	version: integer(),
	state: enumeration(["none", "checking", "unavailable"]),
	error: nullable(object({ code: text(), details: optional(failure) })),
})
export const prefill = object({
	country: nullable(text(2)),
	serviceIds: array(integer(1), 100),
	savedProgressAvailable: bool,
})
const base: Fields = {
	record_id: text(128),
	room_id: text(128),
	generation: integer(),
	expires_at: integer(),
}
export interface Table {
	name: string
	fields: Fields
	primary: string
	checks?: string[]
}
const entity = (name: string, fields: Fields, checks?: string[]): Table => ({
	name: `doc.yepwatch_${name}`,
	fields: { ...base, ...fields },
	primary: "record_id",
	checks,
})
export const tables = {
	room: {
		name: "doc.yepwatch_room",
		primary: "id",
		fields: {
			id: text(128),
			storage_format: integer(1),
			revision: integer(),
			expires_at: integer(),
			host_id: text(128),
			invite_hash: text(),
			phase: enumeration(["setup", "choosing", "decided"]),
			roster_version: integer(),
			context_version: integer(),
			generation: integer(),
			constraints,
			stream,
			agreement_check: checkState,
			seen_keys: array(text(), 2000),
			proposal_version: integer(),
			participant_records: array(text(128), 12),
			screen_records: array(text(128), 12),
			candidate_records: array(text(128), 120),
			ticket_records: array(text(128), 48),
			member_intent_records: array(text(128), 48),
			proposal_record: ref,
			decision_record: ref,
			pending_revision: integer(),
			pending_agreement: bool,
		},
		checks: [
			"phase IN ('setup','choosing','decided')",
			"storage_format=1",
			"revision>=0",
		],
	} as Table,
	participant: entity("participant", {
		participant_id: text(128),
		nickname: text(200),
		token_hash: text(),
		admission_hash: text(),
		epoch: integer(),
		next_sequence: integer(),
		screen_id: nullable(text(128)),
		ready: bool,
		revoked: bool,
		last_voted_id: nullable(text(128)),
		member_state: enumeration(["guest", "linked", "unavailable"]),
		member_prefill: nullable(prefill),
		member_user_id: nullable(text(256)),
		vote_records: refs,
		receipt_records: array(text(128), 64),
		agreement_record: text(128),
		grant_record: ref,
		// Compatibility with member reader interface, never used to finalize proposals.
		legacy_pick_id: nullable(text(128)),
		legacy_pick_revision: integer(),
	}),
	vote: entity(
		"vote",
		{
			participant_id: text(128),
			candidate_id: text(128),
			choice: nullable(enumeration(["watch", "pass"])),
			revision: integer(),
			active_exposure_ms: nullable(integer()),
			timing_source: nullable(
				enumeration(["active_exposure", "implied", "unavailable"])
			),
		},
		[
			"choice IS NULL OR choice IN ('watch','pass')",
			"revision>=0",
			"active_exposure_ms IS NULL OR active_exposure_ms>=0",
		]
	),
	agreement: entity("agreement", {
		participant_id: text(128),
		proposal_version: nullable(integer()),
		revision: integer(),
	}),
	proposal: entity("proposal", {
		candidate_id: text(128),
		version: integer(),
		previous_candidate_id: nullable(text(128)),
		proposer_id: text(128),
		base_participant_ids: array(text(128), 12),
	}),
	decision: entity("decision", {
		candidate_id: text(128),
		agreement_version: integer(),
		decided_at: integer(),
		availability,
	}),
	screen: entity("screen", {
		screen_id: text(128),
		label: text(200),
		country: nullable(text(2)),
		service_ids: array(integer(1), 100),
		confirmed: bool,
	}),
	candidate: entity("candidate", {
		candidate_id: text(128),
		identity,
		title: text(),
		year: nullable(integer()),
		overview: nullable(text(100000)),
		poster_url: nullable(text()),
		runtime_minutes: nullable(real),
		availability,
		viewing_duration: nullable(
			object({ minutes: real, scope: enumeration(["movie", "episode"]) })
		),
		backdrop_url: nullable(text()),
		trailer_url: nullable(text()),
		goodwatch_score: nullable(real),
		genres: nullable(strings),
	}),
	receipt: entity("command_receipt", {
		participant_id: text(128),
		command_id: text(128),
		sequence: integer(),
		digest: text(128),
		revision: integer(),
	}),
	ticket: entity("ticket", {
		ticket_hash: text(128),
		participant_id: text(128),
		epoch: integer(),
		ticket_expires_at: integer(),
	}),
	grant: entity("member_grant", {
		participant_id: text(128),
		access_token_ciphertext: text(40000),
		grant_expires_at: integer(),
	}),
	intent: entity("member_intent", {
		state_hash: text(128),
		participant_id: text(128),
		epoch: integer(),
		intent_expires_at: integer(),
		client: enumeration(["browser", "native"]),
		return_to: text(),
		challenge: text(),
		verifier_ciphertext: nullable(text(40000)),
		status: enumeration(["ready", "exchanging", "linked"]),
		code_hash: nullable(text()),
	}),
} as const
export type Entity = Exclude<keyof typeof tables, "room">
export const entityNames = Object.keys(tables).filter(
	(k) => k !== "room"
) as Entity[]
export function columns(table: Table) {
	return Object.keys(table.fields)
}
export function parseRow(table: Table, row: unknown): Record<string, any> {
	return object(table.fields).schema.parse(row)
}
export function tableDdl(table: Table, replicas: 0 | 2) {
	const fields = Object.entries(table.fields).map(
		([name, f]) =>
			`"${name}" ${f.sql}${
				name === table.primary
					? " PRIMARY KEY"
					: !f.schema.isNullable() && !f.schema.isOptional()
					? " NOT NULL"
					: ""
			}`
	)
	for (const [i, c] of (table.checks ?? []).entries())
		fields.push(`CONSTRAINT check_${i} CHECK (${c})`)
	return `CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${fields.join(
		",\n  "
	)}\n) CLUSTERED INTO ${
		table.name === "doc.yepwatch_room" ? 4 : 1
	} SHARDS WITH (column_policy='strict',number_of_replicas=${replicas},"write.wait_for_active_shards"='${
		replicas + 1
	}',refresh_interval=1000)`
}
export const controlTable: Table = {
	name: "doc.yepwatch_control",
	primary: "id",
	fields: {
		id: text(128),
		format: integer(1),
		fingerprint: text(128),
		window_number: integer(-1),
		room_reservations: array(
			object({
				room_id: text(128),
				admission_digest: text(128),
				expires_at: integer(),
			}),
			100
		),
		admission_digests: array(text(128), 120),
		command_grants: array(
			object({ command_digest: text(128), actor_digest: text(128) }),
			2400
		),
	},
}

export const runtimeTable: Table = {
	name: "doc.yepwatch_runtime",
	primary: "id",
	fields: {
		id: text(128),
		format_version: integer(1),
		key_id: text(128),
		key_check: text(128),
		room_ttl_ms: integer(1),
	},
}
/** Durable invite lookup. No plaintext key or room state is stored here. */
export const invitationTable: Table = {
	name: "doc.yepwatch_invitation",
	primary: "code_hash",
	fields: { code_hash: text(64), room_id: text(128), expires_at: integer() },
}
export const storageTables: Table[] = [
	invitationTable,
	...Object.values(tables),
	runtimeTable,
	controlTable,
]
