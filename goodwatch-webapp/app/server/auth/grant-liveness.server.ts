import { createHash } from "node:crypto"
import { type AuthSql, authModelTable } from "./crate-adapter.server.ts"
import type { authPayloadCodec } from "./payload-codec.server.ts"

type Codec = ReturnType<typeof authPayloadCodec>
export type GrantRow = {
	id: string
	clientId: string
	userId: string
	referenceId?: string | null
	grantVersion?: string
	createdAt?: Date | string | null
	lastUsedAt?: Date | string | null
}

// Mirrors reconciliation: a refresh token gets its grant version just after minting.
const unversionedGrace = 15 * 60000
// Refreshing touches the grant, then revokes the parent token before writing the child,
// whose insert may take up to its 15-minute write deadline (plus clock skew). A grant
// created or used this recently is live whatever its tokens show.
const recentUseGrace = 20 * 60000
const time = (value: unknown) =>
	value == null ? Number.NaN : new Date(value as string).getTime()

export const grantRowId = (
	clientId: unknown,
	userId: unknown,
	referenceId: unknown,
) =>
	createHash("sha256")
		.update(JSON.stringify([clientId, userId, referenceId ?? null]))
		.digest("hex")

/** When the grant was last created or used by its app. */
export function grantActivity(grant: GrantRow) {
	return Math.max(time(grant.createdAt) || 0, time(grant.lastUsedAt) || 0)
}

/**
 * A grant is live while it was created or used in the last 20 minutes, its sign-in
 * session is unexpired, or one of its refresh tokens can still mint access. Dead grants are what eviction and maintenance reclaim first.
 * Pass `clientId` and `referenceId` to check one grant; leave them out to check all of a member's.
 */
export async function grantLiveness(
	sql: AuthSql,
	codec: Codec,
	scope: { userId: string; clientId?: string; referenceId?: string | null },
	now = new Date(),
): Promise<(grant: GrantRow) => boolean> {
	const sessions = authModelTable("session")
	const tokens = authModelTable("oauthRefreshToken")
	await sql(`REFRESH TABLE ${sessions}, ${tokens}`)
	const liveSessions = new Set(
		(
			await sql(
				`SELECT id FROM ${sessions} WHERE deleted = false AND lookup['userId'] = ? AND expires_at > ?`,
				[scope.userId, now.getTime()],
			)
		).rows.map((row) => String(row[0])),
	)
	const filters = ["deleted = false", "lookup['userId'] = ?", "expires_at > ?"]
	const args: unknown[] = [scope.userId, now.getTime()]
	if (scope.clientId !== undefined) {
		filters.push("lookup['clientId'] = ?")
		args.push(scope.clientId)
	}
	if (scope.referenceId === null) filters.push("lookup['referenceId'] IS NULL")
	else if (scope.referenceId !== undefined) {
		filters.push("lookup['referenceId'] = ?")
		args.push(scope.referenceId)
	}
	// Grant id -> versions its live refresh tokens carry (null: not versioned yet).
	const versions = new Map<string, Set<string | null>>()
	for (const [id, payload] of (
		await sql(
			`SELECT id,payload FROM ${tokens} WHERE ${filters.join(" AND ")}`,
			args,
		)
	).rows) {
		let envelope: Record<string, any>
		try {
			envelope = codec.decode(payload, `${tokens}:${id}:payload`)
		} catch {
			continue // Maintenance quarantines unreadable rows; they cannot refresh anyway.
		}
		const token = envelope.row as Record<string, unknown>
		if (envelope.deleted !== false || token?.id !== id) continue
		if (!(time(token.expiresAt) > now.getTime())) continue
		if (token.revoked != null) continue
		let version: string | null
		if (typeof token.grantVersion === "string") version = token.grantVersion
		else if (now.getTime() - time(token.createdAt) < unversionedGrace)
			version = null
		else continue
		const grant = grantRowId(token.clientId, token.userId, token.referenceId)
		versions.set(grant, (versions.get(grant) ?? new Set()).add(version))
	}
	return (grant) => {
		if (now.getTime() - grantActivity(grant) < recentUseGrace) return true
		if (
			typeof grant.referenceId === "string" &&
			liveSessions.has(grant.referenceId)
		)
			return true
		const held = versions.get(grant.id)
		return Boolean(
			held && (held.has(null) || held.has(grant.grantVersion ?? null)),
		)
	}
}
