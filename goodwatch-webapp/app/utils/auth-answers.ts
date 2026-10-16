// The parts of the account pages' sign-in client (auth-client.ts) that need no React: how a password action's answer
// reads, taking up a session a server action stored, and hearing a failed sign-in on a screen without a form.
import type { AuthResult } from "~/utils/auth-client"
import { MAINTENANCE_CODE } from "~/utils/auth-maintenance"

/** A password action's answer: 422 is a password Supabase turned away, with its reason; 400 a link that no longer works. */
export function routeOutcome(status: number, data: unknown): AuthResult {
	if (status >= 200 && status < 300) return { ok: true }
	if ((data as { code?: unknown } | null)?.code === MAINTENANCE_CODE) return { ok: false, failure: "maintenance" }
	if (status === 429) return { ok: false, failure: "throttled" }
	if (status >= 500) return { ok: false, failure: "unavailable" }
	if (status === 422) {
		const message = (data as { error?: unknown } | null)?.error
		return { ok: false, failure: "password", ...(typeof message === "string" && message ? { message } : {}) }
	}
	return { ok: false, failure: "invalid" }
}

type SessionClient = {
	auth: {
		getSession(): Promise<{ data: { session: { access_token: string; refresh_token: string } | null } }>
		setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ error: unknown }>
	}
}

/**
 * Takes up a session that a server action stored in the cookies. Setting it again makes the client check it and
 * announce a sign-in, which the auth provider hears like any other. False when there is none.
 */
export async function adoptServerSession(client: SessionClient | null): Promise<boolean> {
	if (!client) return false
	try {
		const { session } = (await client.auth.getSession()).data
		if (!session) return false
		const { error } = await client.auth.setSession({
			access_token: session.access_token,
			refresh_token: session.refresh_token,
		})
		return !error
	} catch {
		return false
	}
}

/** Runs `onFailure` when a sign-in answers with a failure or throws: a screen without the form can still say so. */
export function whenAuthFails(result: Promise<AuthResult>, onFailure: () => void): void {
	result.then(
		(answer) => {
			if (!answer.ok) onFailure()
		},
		onFailure,
	)
}
