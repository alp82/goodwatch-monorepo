// "Set a new password" on the Supabase path (BETTER_AUTH_ENABLED off). The link's one-time code becomes a session, and
// the password is saved under it. The answer says why it failed: a spent or expired link (400), a password Supabase
// turned away with its own reason (422), or Supabase being unavailable.
//
// A rejected password has already spent the code, and its session is in the cookies the route returns. A second try
// with the same code then saves the password under that session, so the member can fix it without a new email.

type ResetError = { message: string; code?: string; status?: number }
export type SupabaseResetAuth = {
	exchangeCodeForSession(code: string): Promise<{ error: unknown }>
	getUser(): Promise<{ data: { user: unknown } }>
	updateUser(attributes: { password: string }): Promise<{ error: ResetError | null }>
}
export type ResetAnswer =
	| { status: 200; body: { success: true } }
	| { status: number; body: { error: string; code: string } }

export const PASSWORD_MIN = 10

export async function resetSupabasePassword(
	auth: SupabaseResetAuth,
	code: string,
	password: string,
): Promise<ResetAnswer> {
	if (!password || !code)
		return { status: 400, body: { error: "Password and reset code are required", code: "missing" } }
	if (password.length < PASSWORD_MIN)
		return {
			status: 422,
			body: { error: `Password must be at least ${PASSWORD_MIN} characters`, code: "weak_password" },
		}
	const { error: exchangeError } = await auth.exchangeCodeForSession(code)
	if (exchangeError) {
		const { data } = await auth.getUser()
		if (!data.user) return { status: 400, body: { error: "Invalid or expired reset code", code: "expired" } }
	}
	const { error } = await auth.updateUser({ password })
	if (!error) return { status: 200, body: { success: true } }
	const status = error.status === 429 ? 429 : !error.status || error.status >= 500 ? 503 : 422
	return { status, body: { error: error.message, code: error.code ?? "rejected" } }
}
