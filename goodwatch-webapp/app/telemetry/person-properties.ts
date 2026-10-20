/** The account fields used by PostHog persons, shared by browser, server and backfill.
 * Never spread auth payloads: they can contain credentials and private metadata.
 */
export interface AnalyticsUser {
	id: string
	email?: string | null
	name?: string | null
	image?: string | null
	createdAt?: Date | string | number
	created_at?: string
	emailVerified?: boolean
	email_confirmed_at?: string
	user_metadata?: Record<string, unknown>
	app_metadata?: Record<string, unknown>
}

export function personProperties(
	user: AnalyticsUser,
): Record<string, string | boolean> {
	const properties: Record<string, string | boolean> = { user_id: user.id }
	const text = (key: string, value: unknown) => {
		if (typeof value === "string" && value.trim() && value.length <= 2048)
			properties[key] = value.trim()
	}
	const metadata = user.user_metadata ?? {}
	text("email", user.email)
	text("name", user.name || metadata.full_name || metadata.name)
	text("first_name", metadata.given_name || metadata.first_name)
	text("last_name", metadata.family_name || metadata.last_name)
	text("$avatar", user.image || metadata.avatar_url || metadata.picture)
	text("auth_provider", user.app_metadata?.provider)
	const created = user.createdAt ?? user.created_at
	if (created) {
		const date = new Date(created)
		if (Number.isFinite(date.getTime()))
			properties.account_created_at = date.toISOString()
	}
	if (typeof user.emailVerified === "boolean")
		properties.email_verified = user.emailVerified
	else if (user.email_confirmed_at) properties.email_verified = true
	return properties
}
