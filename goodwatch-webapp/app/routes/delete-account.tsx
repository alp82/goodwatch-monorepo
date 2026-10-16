// Deleting an account (#553), from Settings → Account. A member with a password confirms with it and the account is
// deleted at once; a member who signs in with Google gets an email whose link comes back here with `?token=`, and the
// button on that page deletes. Opening the link alone deletes nothing. The page never says whether an account exists:
// a link opened while signed out asks to sign in first, and one that no longer works says only that.
import {
	ArrowLeftIcon,
	CheckCircleIcon,
	EnvelopeIcon,
	LinkSlashIcon,
	TrashIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import {
	Link,
	useLocation,
	useNavigate,
	useSearchParams,
} from "@remix-run/react"
import { type FormEvent, type ReactNode, useEffect, useState } from "react"
import {
	AuthSplit,
	Heading,
	Notice,
	PasswordField,
	PrimaryButton,
	SecondaryButton,
	TextLink,
	textLink,
	useCooldown,
} from "~/ui/auth/kit"
import { Spinner } from "~/ui/wait/Spinner"
import { useSupabase, useUser } from "~/utils/auth"
import { type AuthFailure, useAuthClient } from "~/utils/auth-client"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Delete your account | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const RESEND_SECONDS = 45
const SETTINGS = "/settings/account"

export default function DeleteAccount() {
	const [params] = useSearchParams()
	const token = params.get("token")
	const { user, loading } = useUser()
	const { betterAuth } = useSupabase()
	// Kept apart from the signed-in member: once the account is gone, nobody is signed in any more.
	const [deleted, setDeleted] = useState(false)

	if (deleted) return <Deleted />
	if (!betterAuth) return <NotYet />
	if (loading) return <Waiting />
	if (!user?.email)
		return token ? <SignInToFinish token={token} /> : <SignInFirst />
	if (token)
		return (
			<ConfirmLink
				token={token}
				email={user.email}
				onDeleted={() => setDeleted(true)}
			/>
		)
	return <Confirm email={user.email} onDeleted={() => setDeleted(true)} />
}

/** What goes with the account, in the member's words. */
function WhatGoes() {
	const items = [
		"Your ratings, Want to See and watch history",
		"Your lists and your @handle page",
		"Your imports and settings",
		"Apps like Claude, which are disconnected",
	]
	return (
		<div className="rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm">
			<p className="mb-3 font-semibold text-gray-100">
				Deleted with your account
			</p>
			<ul className="space-y-2 text-gray-300">
				{items.map((item) => (
					<li key={item} className="flex gap-2.5">
						<XMarkIcon
							className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
							aria-hidden="true"
						/>
						{item}
					</li>
				))}
			</ul>
			<p className="mt-3 border-t border-gray-800 pt-3 text-gray-400">
				Your @handle stays reserved, so nobody else can take it. This can't be
				undone.
			</p>
		</div>
	)
}

function BackToSettings({
	children = "Keep my account",
}: { children?: ReactNode }) {
	return (
		<Link
			to={SETTINGS}
			className="mx-auto flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
		>
			<ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> {children}
		</Link>
	)
}

const trashIcon = (
	<TrashIcon className="h-7 w-7 text-red-400" aria-hidden="true" />
)

/** A request turned away for being too many or because the service is down. */
function FailureNotice({ failure }: { failure: AuthFailure | null }) {
	if (failure === "throttled")
		return (
			<Notice tone="warn">
				Too many tries in a row. Wait a while, then try again.
			</Notice>
		)
	if (failure === "unavailable")
		return (
			<Notice tone="error">
				Deleting your account isn't working right now. Try again in a few
				minutes.
			</Notice>
		)
	return null
}

/** The first step: the password, or for a member who signs in only with Google, an email with a link. */
function Confirm({
	email,
	onDeleted,
}: { email: string; onDeleted: () => void }) {
	const auth = useAuthClient()
	const [methods, setMethods] = useState<("email" | "google")[] | null>(null)
	const [byEmail, setByEmail] = useState(false)
	const [sent, setSent] = useState(false)
	useEffect(() => {
		let current = true
		auth.signInMethods().then((found) => {
			// Without an answer, the email link still works for everyone.
			if (current) setMethods(found ?? [])
		})
		return () => {
			current = false
		}
	}, [auth])

	if (sent) return <LinkSent email={email} />
	if (methods === null) return <Waiting />
	if (methods.includes("email") && !byEmail)
		return (
			<WithPassword
				email={email}
				onDeleted={onDeleted}
				onUseEmail={() => setByEmail(true)}
			/>
		)
	return (
		<WithEmail
			email={email}
			googleOnly={!methods.includes("email")}
			onSent={() => setSent(true)}
		/>
	)
}

function WithPassword({
	email,
	onDeleted,
	onUseEmail,
}: { email: string; onDeleted: () => void; onUseEmail: () => void }) {
	const auth = useAuthClient()
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (busy || !password) return
		setBusy(true)
		setFailure(null)
		const result = await auth.deleteAccount(password)
		if (result.ok) return onDeleted()
		setBusy(false)
		setFailure(result.failure)
	}
	return (
		<AuthSplit>
			<Heading
				icon={trashIcon}
				title="Delete your account"
				sub={<SignedInAs email={email} />}
			/>
			<WhatGoes />
			{failure === "invalid" && (
				<Notice tone="error">That password isn't right.</Notice>
			)}
			<FailureNotice failure={failure} />
			<form method="post" onSubmit={submit} className="space-y-5">
				<PasswordField
					label="Your password, to confirm"
					value={password}
					onChange={setPassword}
					error={failure === "invalid"}
					autoFocus
				/>
				<PrimaryButton danger busy={busy} disabled={!password}>
					Delete my account
				</PrimaryButton>
			</form>
			<p className="text-center text-sm text-gray-400">
				Forgot your password?{" "}
				<button type="button" onClick={onUseEmail} className={textLink}>
					Confirm by email instead
				</button>
			</p>
			<BackToSettings />
		</AuthSplit>
	)
}

function WithEmail({
	email,
	googleOnly,
	onSent,
}: { email: string; googleOnly: boolean; onSent: () => void }) {
	const auth = useAuthClient()
	const [busy, setBusy] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const send = async () => {
		setBusy(true)
		setFailure(null)
		const result = await auth.requestAccountDeletionLink()
		setBusy(false)
		if (result.ok) return onSent()
		setFailure(result.failure === "invalid" ? "unavailable" : result.failure)
	}
	return (
		<AuthSplit>
			<Heading
				icon={trashIcon}
				title="Delete your account"
				sub={<SignedInAs email={email} />}
			/>
			<WhatGoes />
			<FailureNotice failure={failure} />
			<p className="text-sm leading-relaxed text-gray-300">
				{googleOnly ? "You sign in with Google, so we" : "We"} email you a link
				to confirm. Your account is deleted only when you press the button on
				the page it opens.
			</p>
			<PrimaryButton type="button" busy={busy} onClick={send}>
				Email me the link
			</PrimaryButton>
			<BackToSettings />
		</AuthSplit>
	)
}

function LinkSent({ email }: { email: string }) {
	const auth = useAuthClient()
	const cooldown = useCooldown(RESEND_SECONDS)
	const [busy, setBusy] = useState(false)
	const [resent, setResent] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	const resend = async () => {
		setBusy(true)
		setFailure(null)
		const result = await auth.requestAccountDeletionLink()
		setBusy(false)
		if (!result.ok)
			return setFailure(
				result.failure === "invalid" ? "unavailable" : result.failure,
			)
		setResent(true)
		cooldown.restart()
	}
	return (
		<AuthSplit>
			<Heading
				icon={
					<EnvelopeIcon className="h-7 w-7 text-amber-400" aria-hidden="true" />
				}
				title="Check your inbox"
				sub={
					<>
						We sent a link to <strong className="text-gray-200">{email}</strong>
						. Open it to delete your account.
					</>
				}
			/>
			{resent && <Notice tone="ok">A new link is on its way.</Notice>}
			<FailureNotice failure={failure} />
			<div className="space-y-3 rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm text-gray-300">
				<p>
					The link works for one hour and only once. Nothing is deleted until
					you press the button on the page it opens.
				</p>
				<p>
					The email comes from{" "}
					<strong className="text-gray-100">hello@goodwatch.app</strong>. Not
					there after a few minutes? Look in spam.
				</p>
			</div>
			<SecondaryButton
				busy={busy}
				disabled={cooldown.left > 0}
				onClick={resend}
			>
				{cooldown.left > 0
					? `Resend link in 0:${String(cooldown.left).padStart(2, "0")}`
					: "Resend link"}
			</SecondaryButton>
			<BackToSettings>Back to settings</BackToSettings>
		</AuthSplit>
	)
}

/** The page the emailed link opens: the last step. */
function ConfirmLink({
	token,
	email,
	onDeleted,
}: { token: string; email: string; onDeleted: () => void }) {
	const auth = useAuthClient()
	const [busy, setBusy] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	if (failure === "invalid") return <Expired email={email} />
	const confirm = async () => {
		setBusy(true)
		setFailure(null)
		const result = await auth.confirmAccountDeletion(token)
		if (result.ok) return onDeleted()
		setBusy(false)
		setFailure(result.failure)
	}
	return (
		<AuthSplit>
			<Heading
				icon={trashIcon}
				title="Delete your account for good?"
				sub={<SignedInAs email={email} />}
			/>
			<WhatGoes />
			<FailureNotice failure={failure} />
			<PrimaryButton type="button" danger busy={busy} onClick={confirm}>
				Delete my account
			</PrimaryButton>
			<BackToSettings />
		</AuthSplit>
	)
}

function Expired({ email }: { email: string }) {
	const auth = useAuthClient()
	const [busy, setBusy] = useState(false)
	const [sent, setSent] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)
	if (sent) return <LinkSent email={email} />
	const send = async () => {
		setBusy(true)
		setFailure(null)
		const result = await auth.requestAccountDeletionLink()
		setBusy(false)
		if (result.ok) return setSent(true)
		setFailure(result.failure === "invalid" ? "unavailable" : result.failure)
	}
	return (
		<AuthSplit>
			<Heading
				icon={
					<LinkSlashIcon
						className="h-7 w-7 text-amber-400"
						aria-hidden="true"
					/>
				}
				title="This link no longer works"
				sub="Links to delete your account work for one hour, only once, and only for the account that asked for them."
			/>
			<FailureNotice failure={failure} />
			<PrimaryButton type="button" busy={busy} onClick={send}>
				Send me a new link
			</PrimaryButton>
			<BackToSettings>Back to settings</BackToSettings>
		</AuthSplit>
	)
}

/** A link opened while signed out: sign in on this device first, then back here with the link. */
function SignInToFinish({ token }: { token: string }) {
	const back = `/delete-account?token=${encodeURIComponent(token)}`
	return (
		<AuthSplit>
			<Heading
				icon={trashIcon}
				title="Sign in to delete your account"
				sub="Deleting needs you signed in on this device. After signing in you come back here to confirm."
			/>
			<Link
				to={`/sign-in?redirectTo=${encodeURIComponent(back)}`}
				rel="nofollow"
				className="flex w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white transition duration-200 hover:bg-amber-600"
			>
				Sign in
			</Link>
			<p className="text-center text-sm text-gray-400">
				Didn't ask to delete your account? Close this page; nothing changes.
			</p>
		</AuthSplit>
	)
}

/** Opened while signed out without a link: sign in, then back here. */
function SignInFirst() {
	const navigate = useNavigate()
	const { pathname } = useLocation()
	useEffect(() => {
		navigate(`/sign-in?redirectTo=${encodeURIComponent(pathname)}`, {
			replace: true,
		})
	}, [navigate, pathname])
	return <Waiting />
}

function Deleted() {
	return (
		<AuthSplit>
			<Heading
				icon={
					<CheckCircleIcon
						className="h-7 w-7 text-emerald-400"
						aria-hidden="true"
					/>
				}
				title="Your account is deleted"
				sub="Everything you saved is gone, and connected apps are disconnected. Thanks for watching with GoodWatch."
			/>
			<Link
				to="/"
				className="flex w-full items-center justify-center rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white transition duration-200 hover:bg-amber-600"
			>
				Back to GoodWatch
			</Link>
			<p className="text-center text-sm text-gray-400">
				Changed your mind? You can{" "}
				<TextLink to="/sign-up">create a new account</TextLink> with the same
				email any time.
			</p>
		</AuthSplit>
	)
}

function NotYet() {
	return (
		<AuthSplit>
			<Heading
				icon={trashIcon}
				title="Delete your account"
				sub={
					<>
						Deleting your account here arrives with GoodWatch's new sign-in.
						Until then, write to{" "}
						<a href="mailto:hello@goodwatch.app" className={textLink}>
							hello@goodwatch.app
						</a>{" "}
						from your account's email.
					</>
				}
			/>
			<BackToSettings>Back to settings</BackToSettings>
		</AuthSplit>
	)
}

function SignedInAs({ email }: { email: string }) {
	return (
		<>
			Signed in as <strong className="break-all text-gray-200">{email}</strong>
		</>
	)
}

function Waiting() {
	return (
		<AuthSplit>
			<div className="flex justify-center py-16">
				<Spinner size="large" />
			</div>
		</AuthSplit>
	)
}
