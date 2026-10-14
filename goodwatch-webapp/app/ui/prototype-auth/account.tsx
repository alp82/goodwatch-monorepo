// PROTOTYPE - throwaway (issue #534). Sign-in, sign-up, email verification, password reset and the emails they send.
// Every button only moves the prototype to its next screen; nothing reaches a sign-in service.
import { ArrowLeftIcon, EnvelopeIcon, EnvelopeOpenIcon, KeyIcon, LinkSlashIcon, ShieldCheckIcon } from "@heroicons/react/24/outline"
import { type ReactNode, useEffect, useState } from "react"
import {
	AuthSplit,
	CLIENTS,
	type ClientKey,
	ClientBadge,
	EmailField,
	GoodWatchBadge,
	GoogleButton,
	Heading,
	Notice,
	OrDivider,
	PasswordField,
	PasswordRule,
	PrimaryButton,
	SAMPLE_EMAIL,
	SecondaryButton,
	TextLink,
	useFakeSubmit,
	useGo,
} from "~/ui/prototype-auth/kit"

export const PASSWORD_MIN = 10

// Where a finished sign-in goes in the prototype: the consent page when the member came from an app, else a toast-like note.
function useSignedIn(state: string, client: ClientKey) {
	const go = useGo()
	return () => (state === "connect" ? go({ screen: "consent", state: "ask", client }) : go({ screen: "done", state: null }))
}

export function SignIn({ state, client }: { state: string; client: ClientKey }) {
	const go = useGo()
	const signedIn = useSignedIn(state, client)
	const [email, setEmail] = useState(state === "form" || state === "connect" || state === "cutover" ? "" : SAMPLE_EMAIL)
	const [password, setPassword] = useState(state === "error" ? "••••••••••••" : "")
	const [stay, setStay] = useState(true)
	const { busy, submit } = useFakeSubmit(signedIn)
	const c = CLIENTS[client]
	return (
		<AuthSplit aside={state === "connect" ? <ConnectAside client={client} /> : undefined}>
			{state === "connect" && (
				<div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/70 p-3 text-sm text-gray-200">
					<ClientBadge client={client} size="sm" />
					<p>
						Sign in to connect <strong className="text-white">{c.name}</strong> to your GoodWatch. You choose what it can do on the next page.
					</p>
				</div>
			)}
			<Heading title={state === "cutover" ? "Sign in again" : "Sign in"} sub={state === "cutover" ? undefined : "Welcome back to GoodWatch"} />
			{state === "cutover" && <CutoverExplainer />}
			<GoogleButton onDone={signedIn} />
			<OrDivider />
			{state === "error" && (
				<Notice tone="error">
					That email and password don't match. Check both, or{" "}
					<TextLink onClick={() => go({ screen: "forgot", state: "form" })}>set a new password</TextLink>.
				</Notice>
			)}
			{state === "unverified" && (
				<Notice tone="warn">
					<p>Confirm your email first. We sent a link to {SAMPLE_EMAIL} when you signed up.</p>
					<p className="mt-2">
						<TextLink onClick={() => go({ screen: "verify", state: "sent" })}>Send a new link</TextLink>
					</p>
				</Notice>
			)}
			{state === "throttled" && <Notice tone="warn">Too many tries in a row. Wait a minute, then try again, or set a new password.</Notice>}
			<form onSubmit={submit} className="space-y-5">
				<EmailField value={email} onChange={setEmail} error={state === "error"} />
				<PasswordField
					value={password}
					onChange={setPassword}
					error={state === "error"}
					labelAside={
						<button type="button" onClick={() => go({ screen: "forgot", state: "form" })} className="cursor-pointer text-sm text-amber-500 hover:text-amber-400">
							Forgot password?
						</button>
					}
				/>
				<label className="flex items-center gap-2 text-sm text-gray-300">
					<input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-600 focus:ring-2 focus:ring-amber-500" />
					Stay signed in on this device
				</label>
				<PrimaryButton busy={busy}>Sign in</PrimaryButton>
			</form>
			<p className="text-center text-gray-400">
				New to GoodWatch? <TextLink onClick={() => go({ screen: "sign-up", state: state === "connect" ? "connect" : "form" })}>Create an account</TextLink>
			</p>
		</AuthSplit>
	)
}

function CutoverExplainer() {
	return (
		<Notice tone="info">
			<p className="font-semibold">GoodWatch has a new sign-in.</p>
			<p className="mt-1">Your ratings, Wishlist and shows are all still here. Sign in once with the same email and password, or with Google, and you're set.</p>
		</Notice>
	)
}

// The picture column while an app waits: what is about to be connected, instead of the slogan.
function ConnectAside({ client }: { client: ClientKey }) {
	const c = CLIENTS[client]
	return (
		<div className="max-w-md p-8 text-center text-white">
			<div className="mb-8 flex items-center justify-center gap-4">
				<ClientBadge client={client} size="lg" />
				<span className="text-3xl text-gray-300">⇄</span>
				<GoodWatchBadge size="lg" />
			</div>
			<h2 className="mb-4 text-4xl font-bold">Connect {c.name}</h2>
			<p className="text-xl text-gray-200">Log watches, rate titles and pick tonight's movie by chatting with {c.name}.</p>
		</div>
	)
}

export function SignUp({ state, client }: { state: string; client: ClientKey }) {
	const go = useGo()
	const signedIn = useSignedIn(state, client)
	const [email, setEmail] = useState(state === "taken" ? SAMPLE_EMAIL : "")
	const [password, setPassword] = useState(state === "taken" ? "••••••••••••" : "")
	const { busy, submit } = useFakeSubmit(() => (state === "taken" ? undefined : go({ screen: "verify", state: "sent" })))
	return (
		<AuthSplit aside={state === "connect" ? <ConnectAside client={client} /> : undefined}>
			{state === "connect" && (
				<div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/70 p-3 text-sm text-gray-200">
					<ClientBadge client={client} size="sm" />
					<p>
						Create a free account, then connect <strong className="text-white">{CLIENTS[client].name}</strong>.
					</p>
				</div>
			)}
			<Heading title="Create your account" sub="Free. Your ratings, Wishlist and shows, on every device." />
			{state === "guest" && (
				<Notice tone="ok">
					<span className="font-semibold">Your 12 ratings and 4 Wishlist titles come along.</span> We move them from this browser into your new account.
				</Notice>
			)}
			<GoogleButton onDone={signedIn} />
			<OrDivider />
			{state === "taken" && (
				<Notice tone="warn">
					There's already an account for {SAMPLE_EMAIL}. <TextLink onClick={() => go({ screen: "sign-in", state: "form" })}>Sign in</TextLink> or{" "}
					<TextLink onClick={() => go({ screen: "forgot", state: "form" })}>set a new password</TextLink>.
				</Notice>
			)}
			<form onSubmit={submit} className="space-y-5">
				<EmailField value={email} onChange={setEmail} error={state === "taken"} />
				<PasswordField value={password} onChange={setPassword} isNew hint={<PasswordRule password={password} min={PASSWORD_MIN} />} />
				<PrimaryButton busy={busy} disabled={password.length < PASSWORD_MIN && state !== "taken"}>
					Create account
				</PrimaryButton>
				<p className="text-center text-xs text-gray-500">
					By creating an account you agree to the <span className="underline">Privacy Policy</span>.
				</p>
			</form>
			<p className="text-center text-gray-400">
				Already have an account? <TextLink onClick={() => go({ screen: "sign-in", state: state === "connect" ? "connect" : "form" })}>Sign in</TextLink>
			</p>
		</AuthSplit>
	)
}

// "Resend in 0:42": a new link at most once a minute.
function useCooldown(seconds: number) {
	const [left, setLeft] = useState(seconds)
	useEffect(() => {
		if (left <= 0) return
		const id = setTimeout(() => setLeft(left - 1), 1000)
		return () => clearTimeout(id)
	}, [left])
	return { left, restart: () => setLeft(seconds) }
}

export function Verify({ state }: { state: string }) {
	const go = useGo()
	const cooldown = useCooldown(45)
	const [resent, setResent] = useState(false)
	const resend = useFakeSubmit(() => {
		setResent(true)
		cooldown.restart()
	})
	if (state === "confirmed")
		return (
			<AuthSplit>
				<Heading icon={<ShieldCheckIcon className="h-7 w-7 text-emerald-400" />} title="Email confirmed" sub="You're signed in. Welcome to GoodWatch." />
				<PrimaryButton type="button" onClick={() => go({ screen: "done", state: null })}>
					Continue
				</PrimaryButton>
			</AuthSplit>
		)
	if (state === "expired")
		return (
			<AuthSplit>
				<Heading icon={<LinkSlashIcon className="h-7 w-7 text-amber-400" />} title="This link has expired" sub="Confirmation links work for 24 hours, and only the newest one works." />
				<ResendForm label="Send a new link" onSent={() => go({ screen: "verify", state: "sent" })} />
				<BackToSignIn />
			</AuthSplit>
		)
	return (
		<AuthSplit>
			<Heading
				icon={<EnvelopeIcon className="h-7 w-7 text-amber-400" />}
				title="Check your inbox"
				sub={
					<>
						We sent a link to <strong className="text-gray-200">{SAMPLE_EMAIL}</strong>. Open it to confirm your email and finish signing up.
					</>
				}
			/>
			{resent && <Notice tone="ok">A new link is on its way. Open the newest email; older links stop working.</Notice>}
			<div className="space-y-3 rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm text-gray-300">
				<p>
					The email comes from <strong className="text-gray-100">hello@goodwatch.app</strong>. Not there after a few minutes? Look in spam.
				</p>
				<p>Opened it on another device? Come back to this browser and sign in, so the ratings you made here come along.</p>
			</div>
			<SecondaryButton busy={resend.busy} disabled={cooldown.left > 0} onClick={() => resend.submit()}>
				{cooldown.left > 0 ? `Resend link in 0:${String(cooldown.left).padStart(2, "0")}` : "Resend link"}
			</SecondaryButton>
			<p className="text-center text-sm text-gray-400">
				Wrong address? <TextLink onClick={() => go({ screen: "sign-up", state: "form" })}>Start over</TextLink>
				<span className="mx-2 text-gray-600">·</span>
				<TextLink onClick={() => go({ screen: "verify", state: "confirmed" })}>Pretend I clicked the link</TextLink>
			</p>
		</AuthSplit>
	)
}

function ResendForm({ label, onSent }: { label: string; onSent: () => void }) {
	const [email, setEmail] = useState(SAMPLE_EMAIL)
	const { busy, submit } = useFakeSubmit(onSent)
	return (
		<form onSubmit={submit} className="space-y-5">
			<EmailField value={email} onChange={setEmail} />
			<PrimaryButton busy={busy}>{label}</PrimaryButton>
		</form>
	)
}

function BackToSignIn() {
	const go = useGo()
	return (
		<button type="button" onClick={() => go({ screen: "sign-in", state: "form" })} className="mx-auto flex cursor-pointer items-center gap-1.5 text-sm text-gray-400 hover:text-white">
			<ArrowLeftIcon className="h-4 w-4" /> Back to sign in
		</button>
	)
}

export function Forgot({ state }: { state: string }) {
	const go = useGo()
	if (state === "sent")
		return (
			<AuthSplit>
				<Heading
					icon={<EnvelopeIcon className="h-7 w-7 text-amber-400" />}
					title="Check your inbox"
					sub={
						<>
							If there's an account for <strong className="text-gray-200">{SAMPLE_EMAIL}</strong>, a link to set a new password is on its way. It works for one hour.
						</>
					}
				/>
				<div className="rounded-xl border border-gray-800 bg-gray-800/40 p-4 text-sm text-gray-300">
					Signed up with Google? Then you have no GoodWatch password: use <strong className="text-gray-100">Continue with Google</strong> instead.
				</div>
				<SecondaryButton onClick={() => go({ screen: "reset", state: "form" })}>Pretend I clicked the link</SecondaryButton>
				<BackToSignIn />
			</AuthSplit>
		)
	return (
		<AuthSplit>
			<Heading icon={<KeyIcon className="h-7 w-7 text-amber-400" />} title="Forgot your password?" sub="Enter your email and we'll send you a link to set a new one." />
			<ResendForm label="Send link" onSent={() => go({ screen: "forgot", state: "sent" })} />
			<BackToSignIn />
		</AuthSplit>
	)
}

export function Reset({ state }: { state: string }) {
	const go = useGo()
	const [password, setPassword] = useState("")
	const [everywhere, setEverywhere] = useState(true)
	const { busy, submit } = useFakeSubmit(() => go({ screen: "reset", state: "done" }))
	if (state === "done")
		return (
			<AuthSplit>
				<Heading icon={<ShieldCheckIcon className="h-7 w-7 text-emerald-400" />} title="Password saved" sub="You're signed in on this device." />
				<PrimaryButton type="button" onClick={() => go({ screen: "done", state: null })}>
					Continue
				</PrimaryButton>
			</AuthSplit>
		)
	if (state === "expired")
		return (
			<AuthSplit>
				<Heading icon={<LinkSlashIcon className="h-7 w-7 text-amber-400" />} title="This link no longer works" sub="Links to set a new password work for one hour and only once." />
				<ResendForm label="Send a new link" onSent={() => go({ screen: "forgot", state: "sent" })} />
				<BackToSignIn />
			</AuthSplit>
		)
	return (
		<AuthSplit>
			<Heading
				icon={<KeyIcon className="h-7 w-7 text-amber-400" />}
				title="Set a new password"
				sub={
					<>
						For <strong className="text-gray-200">{SAMPLE_EMAIL}</strong>
					</>
				}
			/>
			<form onSubmit={submit} className="space-y-5">
				<PasswordField label="New password" value={password} onChange={setPassword} isNew hint={<PasswordRule password={password} min={PASSWORD_MIN} />} />
				<label className="flex items-start gap-2 text-sm text-gray-300">
					<input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-600 focus:ring-2 focus:ring-amber-500" />
					<span>
						Sign out on all other devices
						<span className="block text-gray-500">Connected apps like Claude keep working.</span>
					</span>
				</label>
				<PrimaryButton busy={busy} disabled={password.length < PASSWORD_MIN}>
					Save password
				</PrimaryButton>
			</form>
		</AuthSplit>
	)
}

// Where a sign-in lands in the prototype.
export function Done() {
	const go = useGo()
	return (
		<div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
			<EnvelopeOpenIcon className="h-10 w-10 text-emerald-400" />
			<h1 className="text-2xl font-bold text-white">Signed in (pretend)</h1>
			<p className="text-gray-400">A real sign-in goes back to the page the member came from, or to the taste quiz after a new account.</p>
			<SecondaryButton onClick={() => go({ screen: "sign-in", state: "form" })}>Back to the prototype's sign-in</SecondaryButton>
		</div>
	)
}

// The two emails, as a mail app would show them.
export function Emails() {
	return (
		<div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-10 lg:grid-cols-2">
			<EmailPreview
				subject="Confirm your email for GoodWatch"
				preheader="One tap and your account is ready."
				title="Confirm your email"
				body={<p>Tap the button to confirm {SAMPLE_EMAIL} and finish creating your GoodWatch account.</p>}
				button="Confirm email"
				footer="The link works for 24 hours. Didn't sign up for GoodWatch? Ignore this email and no account is created."
				link="https://goodwatch.app/api/auth/verify-email?token=…"
			/>
			<EmailPreview
				subject="Set a new GoodWatch password"
				preheader="Someone asked to reset the password for your account."
				title="Set a new password"
				body={<p>Someone (we hope you) asked to set a new password for the GoodWatch account of {SAMPLE_EMAIL}.</p>}
				button="Set new password"
				footer="The link works for one hour and only once. Didn't ask for this? Ignore this email; your password stays as it is."
				link="https://goodwatch.app/reset-password?token=…"
			/>
		</div>
	)
}

function EmailPreview({ subject, preheader, title, body, button, footer, link }: { subject: string; preheader: string; title: string; body: ReactNode; button: string; footer: string; link: string }) {
	return (
		<section className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-xl">
			<div className="space-y-1 border-b border-gray-700 px-5 py-4 text-sm">
				<p className="text-gray-400">
					From <span className="text-gray-100">GoodWatch &lt;hello@goodwatch.app&gt;</span>
				</p>
				<p className="text-lg font-semibold text-white">{subject}</p>
				<p className="text-gray-500">{preheader}</p>
			</div>
			<div className="bg-gray-100 px-4 py-8 sm:px-8">
				<div className="mx-auto max-w-md rounded-lg bg-white p-8 text-gray-800 shadow">
					<p className="mb-6 text-xl font-black tracking-tight">
						Good<span className="text-amber-500">Watch</span>
					</p>
					<h2 className="mb-3 text-2xl font-bold text-gray-900">{title}</h2>
					<div className="mb-6 leading-relaxed text-gray-700">{body}</div>
					<span className="inline-block rounded-lg bg-amber-600 px-6 py-3 font-semibold text-white">{button}</span>
					<p className="mt-6 text-sm leading-relaxed text-gray-500">{footer}</p>
					<p className="mt-4 break-all text-xs text-gray-400">Or paste this address: {link}</p>
				</div>
			</div>
		</section>
	)
}
