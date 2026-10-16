import { getAuthPosters } from "~/server/auth-posters.server"
import { authFetch } from "~/utils/auth-session"
import { resetSupabasePassword } from "~/server/auth/supabase-reset.server"
import type { LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { authMaintenanceOn, maintenanceResponse, withMaintenance } from "~/server/auth/cutover-notice.server"
import { KeyIcon, LinkSlashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react"
import { type FormEvent, useState } from "react"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"
import {
	AuthSplit,
	BackToSignIn,
	EmailField,
	Heading,
	MaintenanceCard,
	Notice,
	PasswordField,
	PasswordRule,
	PrimaryButton,
	ServiceNotice,
} from "~/ui/auth/kit"
import { discoveryReturnTo } from "~/utils/account-transfer"
import { useSupabase, useUser } from "~/utils/auth"
import { type AuthFailure, PASSWORD_MIN, useAuthClient } from "~/utils/auth-client"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Reset Password | GoodWatch",
		description: "Reset your GoodWatch password",
		url: "https://goodwatch.app/reset-password",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Reset Password - GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

// The Supabase path (BETTER_AUTH_ENABLED off) saves the password here; Better Auth's is `/api/auth/reset-password`.
export const action: ActionFunction = async ({ request }: LoaderFunctionArgs) => {
	if (process.env.BETTER_AUTH_ENABLED === "true") throw new Response(null, { status: 404 })
	// The cut-over notice (AUTH_MAINTENANCE): nothing reaches Supabase Auth.
	if (authMaintenanceOn()) return maintenanceResponse()
	const formData = await request.formData()
	const password = String(formData.get("password") ?? "")
	const code = String(formData.get("code") ?? "")

	const cookies = parse(request.headers.get("Cookie") ?? "")
	const headers = new Headers()
	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			global: { fetch: authFetch() },
			cookies: {
				get(key) {
					return cookies[key]
				},
				set(key, value, options) {
					headers.append("Set-Cookie", serialize(key, value, options))
				},
				remove(key, options) {
					headers.append("Set-Cookie", serialize(key, "", options))
				},
			},
		},
	)

	const { status, body } = await resetSupabasePassword(supabase.auth, code, password)
	// The session cookies go along with a rejected password too: a second try saves under that session.
	return json(body, { status, headers })
}

// Better Auth's link arrives with `?token=`, or `?error=INVALID_TOKEN` when it no longer works; Supabase's with `?code=`.
export default function ResetPasswordRoute() {
	const { maintenance } = useLoaderData<typeof loader>()
	return maintenance ? <MaintenanceCard /> : <ResetPassword />
}

function ResetPassword() {
	const [params] = useSearchParams()
	const token = params.get("token") ?? params.get("code")
	const [state, setState] = useState<"form" | "done" | "expired">(token && !params.has("error") ? "form" : "expired")
	if (state === "done") return <Saved />
	if (state === "expired" || !token) return <Expired />
	return <NewPassword token={token} onDone={() => setState("done")} onExpired={() => setState("expired")} />
}

function NewPassword({ token, onDone, onExpired }: { token: string; onDone: () => void; onExpired: () => void }) {
	const auth = useAuthClient()
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const { betterAuth } = useSupabase()
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const [reason, setReason] = useState<string>()
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (busy) return
		setBusy(true)
		setFailure(null)
		setReason(undefined)
		const result = await auth.resetPassword(token, password)
		setBusy(false)
		if (result.ok) return onDone()
		if (result.failure === "invalid") return onExpired()
		setFailure(result.failure)
		setReason(result.message)
	}
	return (
		<AuthSplit>
			<Heading icon={<KeyIcon className="h-7 w-7 text-amber-400" />} title="Set a new password" sub="Choose the password you'll sign in with from now on." />
			{failure === "password" && (
				<Notice tone="error">{reason ?? `Choose a password with at least ${PASSWORD_MIN} characters.`}</Notice>
			)}
			<ServiceNotice failure={failure} />
			<form method="post" onSubmit={submit} className="space-y-5">
				<PasswordField label="New password" value={password} onChange={setPassword} isNew autoFocus hint={<PasswordRule password={password} />} />
				<p className="text-sm text-gray-400">
					Saving signs you out on all other devices.
					{/* Apps connect through the new sign-in only (#570). */}
					{betterAuth && " Connected apps like Claude keep working."}
				</p>
				<PrimaryButton busy={busy} disabled={password.length < PASSWORD_MIN}>
					Save password
				</PrimaryButton>
			</form>
		</AuthSplit>
	)
}

// Follows the site's member: the reset signs in, and the page changes to "signed in" once the auth provider hears it.
function Saved() {
	const navigate = useNavigate()
	const { user } = useUser()
	return (
		<AuthSplit>
			<Heading
				icon={<ShieldCheckIcon className="h-7 w-7 text-emerald-400" />}
				title="Password saved"
				sub={user ? "You're signed in on this device." : "Sign in with your new password."}
			/>
			{user ? (
				<PrimaryButton type="button" onClick={() => navigate(discoveryReturnTo())}>
					Continue
				</PrimaryButton>
			) : (
				<PrimaryButton type="button" onClick={() => navigate("/sign-in")}>
					Sign in
				</PrimaryButton>
			)}
		</AuthSplit>
	)
}

function Expired() {
	const auth = useAuthClient()
	const [email, setEmail] = useState("")
	const [busy, setBusy] = useState(false)
	const [sent, setSent] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (busy) return
		setBusy(true)
		setFailure(null)
		const result = await auth.requestPasswordReset(email)
		setBusy(false)
		if (!result.ok && result.failure !== "invalid") return setFailure(result.failure)
		setSent(true)
	}
	return (
		<AuthSplit>
			<Heading icon={<LinkSlashIcon className="h-7 w-7 text-amber-400" />} title="This link no longer works" sub="Links to set a new password work for one hour and only once." />
			{sent ? (
				<Notice tone="ok">If there's an account for {email}, a new link is on its way. It works for one hour.</Notice>
			) : (
				<>
					<ServiceNotice failure={failure} />
					<form method="post" onSubmit={submit} className="space-y-5">
						<EmailField value={email} onChange={setEmail} />
						<PrimaryButton busy={busy}>Send a new link</PrimaryButton>
					</form>
				</>
			)}
			<BackToSignIn />
		</AuthSplit>
	)
}

export const loader = async () => {
	const { data, headers } = withMaintenance({ posters: await getAuthPosters() })
	return json(data, headers ? { headers } : undefined)
}
