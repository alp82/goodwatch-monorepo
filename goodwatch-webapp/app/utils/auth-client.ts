// What the account pages ask of the sign-in service (#550). With Better Auth on (BETTER_AUTH_ENABLED) the browser
// calls its `/api/auth/*` routes, which set the session cookie, and the root loader is asked who is signed in now.
// With it off, the same calls go to Supabase as before, so the flag can still be switched back.
// Answers never say whether an account exists: the server gives the same one for a known and an unknown address.
import { useCallback, useMemo } from "react"
import {
	beginAuthentication,
	discoveryReturnTo,
	noteCreatedAccount,
} from "~/utils/account-transfer"
import { useSupabase } from "~/utils/auth"
import { forgetSupabaseSignIn } from "~/utils/auth-cookie"

export const PASSWORD_MIN = 10

export type AuthFailure =
	/** Wrong details, an unconfirmed email, or a link that no longer works: the server doesn't say which. */
	| "invalid"
	| "throttled"
	| "unavailable"
	/** The password is too short. */
	| "password"
export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure }

const OK: AuthResult = { ok: true }
const fail = (failure: AuthFailure): AuthResult => ({ ok: false, failure })

/** Where the confirmation link lands: the page that says the email is confirmed, then the page the person came from. */
export function confirmedHref(returnTo: string) {
	return `/verify-email?state=confirmed&returnTo=${encodeURIComponent(returnTo)}`
}

async function call(
	path: string,
	body?: unknown,
): Promise<{ status: number; data: any }> {
	try {
		const response = await fetch(`/api/auth${path}`, {
			method: body === undefined ? "GET" : "POST",
			headers: body === undefined ? undefined : { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: "same-origin",
		})
		let data: any = null
		try {
			data = await response.json()
		} catch {}
		return { status: response.status, data }
	} catch {
		return { status: 0, data: null }
	}
}

function outcome({ status, data }: { status: number; data: any }): AuthResult {
	if (status >= 200 && status < 300) return OK
	if (status === 429) return fail("throttled")
	if (status === 0 || status >= 500) return fail("unavailable")
	if (data?.code === "PASSWORD_TOO_SHORT") return fail("password")
	return fail("invalid")
}

function supabaseOutcome(error: { status?: number; code?: string } | null): AuthResult {
	if (!error) return OK
	if (error.status === 429) return fail("throttled")
	if (error.code === "weak_password") return fail("password")
	if (!error.status || error.status >= 500) return fail("unavailable")
	return fail("invalid")
}

export type AuthClient = ReturnType<typeof useAuthClient>

export function useAuthClient() {
	const { betterAuth, getSupabase, refreshUser } = useSupabase()
	return useMemo(() => {
		const supabase = async () => {
			try {
				return await getSupabase()
			} catch {
				return null
			}
		}
		const signedIn = (result: AuthResult) => {
			if (result.ok) {
				forgetSupabaseSignIn()
				refreshUser()
			}
			return result
		}
		return {
			async signIn(input: { email: string; password: string; remember: boolean; returnTo: string }) {
				beginAuthentication("sign-in", input.returnTo)
				if (betterAuth)
					return signedIn(
						outcome(
							await call("/sign-in/email", {
								email: input.email,
								password: input.password,
								rememberMe: input.remember,
							}),
						),
					)
				const client = await supabase()
				if (!client) return fail("unavailable")
				const { error } = await client.auth.signInWithPassword({ email: input.email, password: input.password })
				return supabaseOutcome(error)
			},

			/** A new account waits for its email to be confirmed; an address that has one already gets an email. */
			async signUp(input: { email: string; password: string; returnTo: string }) {
				beginAuthentication("sign-up", input.returnTo)
				if (betterAuth)
					return outcome(
						await call("/sign-up/email", {
							email: input.email,
							password: input.password,
							name: "",
							callbackURL: confirmedHref(input.returnTo),
						}),
					)
				const client = await supabase()
				if (!client) return fail("unavailable")
				const { data, error } = await client.auth.signUp({
					email: input.email,
					password: input.password,
					options: { emailRedirectTo: `${window.location.origin}${input.returnTo}` },
				})
				if (!error) noteCreatedAccount(data.user)
				return supabaseOutcome(error)
			},

			/** Leaves for Google; the answer comes back to `returnTo`, or to the sign-in page when it failed. */
			async google(returnTo: string): Promise<AuthResult> {
				const back = discoveryReturnTo(returnTo)
				beginAuthentication("oauth", back)
				if (betterAuth) {
					const answer = await call("/sign-in/social", {
						provider: "google",
						callbackURL: back,
						errorCallbackURL: "/sign-in?error=google",
					})
					if (typeof answer.data?.url !== "string") return outcome({ ...answer, status: answer.status === 200 ? 500 : answer.status })
					forgetSupabaseSignIn()
					window.location.assign(answer.data.url)
					return OK
				}
				const client = await supabase()
				if (!client) return fail("unavailable")
				const { error } = await client.auth.signInWithOAuth({
					provider: "google",
					options: { redirectTo: `${window.location.origin}${back}` },
				})
				return supabaseOutcome(error)
			},

			async signOut(): Promise<AuthResult> {
				if (betterAuth) {
					const result = outcome(await call("/sign-out", {}))
					refreshUser()
					return result
				}
				const client = await supabase()
				if (!client) return fail("unavailable")
				return supabaseOutcome((await client.auth.signOut()).error)
			},

			async resendConfirmation(email: string, returnTo: string): Promise<AuthResult> {
				if (betterAuth)
					return outcome(await call("/send-verification-email", { email, callbackURL: confirmedHref(returnTo) }))
				const client = await supabase()
				if (!client) return fail("unavailable")
				const { error } = await client.auth.resend({
					type: "signup",
					email,
					options: { emailRedirectTo: `${window.location.origin}${returnTo}` },
				})
				return supabaseOutcome(error)
			},

			async requestPasswordReset(email: string): Promise<AuthResult> {
				if (betterAuth) return outcome(await call("/request-password-reset", { email, redirectTo: "/reset-password" }))
				return routeAction("/forgot-password", { email })
			},

			/** `token` is Better Auth's reset token, or Supabase's one-time code. Better Auth signs the member in. */
			async resetPassword(token: string, password: string): Promise<AuthResult> {
				if (betterAuth) return signedIn(outcome(await call("/reset-password", { token, newPassword: password })))
				return routeAction("/reset-password", { code: token, password })
			},

			/** Other devices are signed out; this one stays signed in. Better Auth asks for the current password. */
			async changePassword(current: string, next: string): Promise<AuthResult> {
				if (betterAuth)
					return signedIn(
						outcome(
							await call("/change-password", {
								currentPassword: current,
								newPassword: next,
								revokeOtherSessions: true,
							}),
						),
					)
				const client = await supabase()
				if (!client) return fail("unavailable")
				return supabaseOutcome((await client.auth.updateUser({ password: next })).error)
			},

			/** How the member signs in: "email" (a password), "google", or both. */
			async signInMethods(): Promise<("email" | "google")[] | null> {
				if (betterAuth) {
					const { status, data } = await call("/list-accounts")
					if (status !== 200 || !Array.isArray(data)) return null
					return data.map((account: { providerId: string }) =>
						account.providerId === "credential" ? "email" : "google",
					)
				}
				const client = await supabase()
				const { data } = (await client?.auth.getUser()) ?? { data: null }
				return (data?.user?.identities ?? []).map((identity) => (identity.provider === "google" ? "google" : "email"))
			},
		}
	}, [betterAuth, getSupabase, refreshUser])
}

// The Supabase path of the password pages runs on their own server actions, as before.
async function routeAction(path: string, fields: Record<string, string>): Promise<AuthResult> {
	try {
		const response = await fetch(`${path}?_data=routes${encodeURIComponent(path)}`, {
			method: "POST",
			body: new URLSearchParams(fields),
			credentials: "same-origin",
		})
		if (response.status === 429) return fail("throttled")
		if (response.status >= 500) return fail("unavailable")
		return response.ok ? OK : fail("invalid")
	} catch {
		return fail("unavailable")
	}
}

/** The one-press save: Continue with Google, then back to `returnTo`. The guest's ratings move to the account once the sign-in lands. */
export function useContinueWithGoogle() {
	const auth = useAuthClient()
	return useCallback((returnTo: string) => auth.google(returnTo), [auth])
}
