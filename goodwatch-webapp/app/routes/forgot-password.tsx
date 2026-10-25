import { getAuthPosters } from "~/server/auth-posters.server"
import { authFetch } from "~/utils/auth-session"
import type { LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import { authMaintenanceOn, maintenanceResponse, withMaintenance } from "~/server/auth/cutover-notice.server"
import { EnvelopeIcon, KeyIcon } from "@heroicons/react/24/outline"
import { type FormEvent, useState } from "react"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { AuthSplit, BackToSignIn, EmailField, Heading, MaintenanceCard, PrimaryButton, ServiceNotice } from "~/ui/auth/kit"
import { type AuthFailure, useAuthClient } from "~/utils/auth-client"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Forgot Password | GoodWatch",
		description: "Reset your GoodWatch password",
		url: "https://goodwatch.app/forgot-password",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Forgot Password - GoodWatch",
	}

	// A form, not a page to find in search results.
	return buildMeta({ pageMeta, items: [], robots: "noindex, follow" })
}

// The Supabase path (BETTER_AUTH_ENABLED off) asks for the link here; Better Auth's is `/api/auth/request-password-reset`.
export const action: ActionFunction = async ({ request }: LoaderFunctionArgs) => {
	if (process.env.BETTER_AUTH_ENABLED === "true") throw new Response(null, { status: 404 })
	// The cut-over notice (AUTH_MAINTENANCE): nothing reaches Supabase Auth.
	if (authMaintenanceOn()) return maintenanceResponse()
	const formData = await request.formData()
	const email = formData.get("email") as string

	if (!email) {
		return json({ error: "Please enter your email address" }, { status: 400 })
	}

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

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${new URL(request.url).origin}/reset-password`,
	})

	if (error) {
		return json({ error: error.message }, { status: 400 })
	}

	return json(
		{ message: "Check your email for a password reset link" },
		{
			headers,
		}
	)
}

export default function ForgotPasswordRoute() {
	const { maintenance } = useLoaderData<typeof loader>()
	return maintenance ? <MaintenanceCard /> : <ForgotPassword />
}

function ForgotPassword() {
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
		// The answer is the same whether the address has an account or not.
		if (!result.ok && result.failure !== "invalid") return setFailure(result.failure)
		setSent(true)
		window.scrollTo({ top: 0 })
	}

	if (sent)
		return (
			<AuthSplit>
				<Heading
					icon={<EnvelopeIcon className="h-7 w-7 text-amber-400" />}
					title="Check your inbox"
					sub={
						<>
							If there's an account for <strong data-feedback-private className="text-gray-200">{email}</strong>, a link to set a new password is on its way. It works for one hour.
						</>
					}
				/>
				<div className="rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm text-gray-300">
					Signed up with Google? Then you have no GoodWatch password: use <strong className="text-gray-100">Continue with Google</strong> instead.
				</div>
				<BackToSignIn />
			</AuthSplit>
		)
	return (
		<AuthSplit>
			<Heading icon={<KeyIcon className="h-7 w-7 text-amber-400" />} title="Forgot your password?" sub="Enter your email and we'll send you a link to set a new one." />
			<ServiceNotice failure={failure} />
			<form method="post" onSubmit={submit} className="space-y-5">
				<EmailField value={email} onChange={setEmail} autoFocus />
				<PrimaryButton busy={busy}>Send link</PrimaryButton>
			</form>
			<BackToSignIn />
		</AuthSplit>
	)
}

export const loader = async () => {
	const { data, headers } = withMaintenance({ posters: await getAuthPosters() })
	return json(data, headers ? { headers } : undefined)
}
