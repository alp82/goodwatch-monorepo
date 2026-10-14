// Email confirmation (#534, #550). A new account waits here for its email; the link in it signs the member in and
// comes back to `?state=confirmed`. A link that no longer works (24 hours, only the newest) lands on `?state=expired`,
// and the sign-in page sends a member who never got one to `?state=resend`.
import { EnvelopeIcon, LinkSlashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import { useLocation, useNavigate, useSearchParams } from "@remix-run/react"
import { type FormEvent, useState } from "react"
import type { SentState } from "~/routes/sign-up"
import {
	AuthSplit,
	BackToSignIn,
	EmailField,
	Heading,
	Notice,
	PrimaryButton,
	SecondaryButton,
	ServiceNotice,
	TextLink,
	useCooldown,
} from "~/ui/auth/kit"
import { discoveryReturnTo, safeReturnTo } from "~/utils/account-transfer"
import { type AuthFailure, useAuthClient } from "~/utils/auth-client"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Confirm your email | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const RESEND_SECONDS = 45

export default function VerifyEmail() {
	const [params] = useSearchParams()
	const state = params.get("state")
	// A link that failed after the checks before it (core's own errors) comes back with `error`.
	if (state === "confirmed" && !params.has("error")) return <Confirmed returnTo={safeReturnTo(params.get("returnTo"))} />
	if (state === "expired" || state === "confirmed") return <Resend kind="expired" />
	if (state === "resend") return <Resend kind="resend" />
	return <Sent />
}

function Confirmed({ returnTo }: { returnTo: string }) {
	const navigate = useNavigate()
	return (
		<AuthSplit>
			<Heading icon={<ShieldCheckIcon className="h-7 w-7 text-emerald-400" />} title="Email confirmed" sub="You're signed in. Welcome to GoodWatch." />
			<PrimaryButton type="button" onClick={() => navigate(returnTo)}>
				Continue
			</PrimaryButton>
		</AuthSplit>
	)
}

function Sent() {
	const sent = useLocation().state as SentState | null
	const auth = useAuthClient()
	const cooldown = useCooldown(RESEND_SECONDS)
	const [busy, setBusy] = useState(false)
	const [resent, setResent] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	// Opened again later, the page no longer knows the address: it asks for it.
	if (!sent?.email) return <Resend kind="resend" />
	const resend = async () => {
		setBusy(true)
		setFailure(null)
		const result = await auth.resendConfirmation(sent.email, sent.returnTo)
		setBusy(false)
		if (!result.ok && result.failure !== "invalid") return setFailure(result.failure)
		setResent(true)
		cooldown.restart()
	}
	return (
		<AuthSplit>
			<Heading
				icon={<EnvelopeIcon className="h-7 w-7 text-amber-400" />}
				title="Check your inbox"
				sub={
					<>
						We sent a link to <strong className="text-gray-200">{sent.email}</strong>. Open it to confirm your email and finish signing up.
					</>
				}
			/>
			{resent && <Notice tone="ok">A new link is on its way. Open the newest email; older links stop working.</Notice>}
			<ServiceNotice failure={failure} />
			<div className="space-y-3 rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm text-gray-300">
				<p>
					The email comes from <strong className="text-gray-100">hello@goodwatch.app</strong>. Not there after a few minutes? Look in spam.
				</p>
				<p>Opened it on another device? Come back to this browser and sign in, so the ratings you made here come along.</p>
			</div>
			<SecondaryButton busy={busy} disabled={cooldown.left > 0} onClick={resend}>
				{cooldown.left > 0 ? `Resend link in 0:${String(cooldown.left).padStart(2, "0")}` : "Resend link"}
			</SecondaryButton>
			<p className="text-center text-sm text-gray-400">
				Wrong address?{" "}
				<TextLink to="/sign-up" replace>
					Start over
				</TextLink>
			</p>
		</AuthSplit>
	)
}

function Resend({ kind }: { kind: "expired" | "resend" }) {
	const navigate = useNavigate()
	const auth = useAuthClient()
	const [email, setEmail] = useState("")
	const [busy, setBusy] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (busy) return
		setBusy(true)
		setFailure(null)
		const returnTo = discoveryReturnTo()
		const result = await auth.resendConfirmation(email, returnTo)
		setBusy(false)
		// The answer is the same for any address, so "invalid" means nothing more than sent.
		if (!result.ok && result.failure !== "invalid") return setFailure(result.failure)
		navigate("/verify-email?state=sent", { replace: true, state: { email, returnTo } satisfies SentState })
	}
	return (
		<AuthSplit>
			{kind === "expired" ? (
				<Heading
					icon={<LinkSlashIcon className="h-7 w-7 text-amber-400" />}
					title="This link has expired"
					sub="Confirmation links work for 24 hours, and only the newest one works."
				/>
			) : (
				<Heading icon={<EnvelopeIcon className="h-7 w-7 text-amber-400" />} title="Confirm your email" sub="Enter the email you signed up with and we'll send a new link." />
			)}
			<ServiceNotice failure={failure} />
			<form onSubmit={submit} className="space-y-5">
				<EmailField value={email} onChange={setEmail} autoFocus />
				<PrimaryButton busy={busy}>Send a new link</PrimaryButton>
			</form>
			<BackToSignIn />
		</AuthSplit>
	)
}
