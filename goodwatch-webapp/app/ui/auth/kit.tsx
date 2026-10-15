// The pieces of the account pages (#534, #550): the split layout with the picture, fields, buttons and notices.
import { CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon } from "@heroicons/react/24/solid"
import { ArrowLeftIcon } from "@heroicons/react/24/outline"
import { Link, useMatches } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { AuthScene } from "~/ui/auth/AuthScene"
import type { AuthPoster } from "~/ui/auth/PosterSpotlight"
import { Spinner } from "~/ui/wait/Spinner"
import { type AuthFailure, PASSWORD_MIN } from "~/utils/auth-client"

// Keep main's poster scene around the Better Auth forms. Every credential form posts so that a submission
// before hydration can never place a password in the address.
export function AuthSplit({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
	const matches = useMatches()
	const data = matches.at(-1)?.data as { posters?: AuthPoster[] } | undefined
	return (
		<AuthScene posters={data?.posters ?? []} aside={aside}>
			<div className="flex w-full flex-col gap-7">{children}</div>
		</AuthScene>
	)
}

export function Heading({ title, sub, icon }: { title: string; sub?: ReactNode; icon?: ReactNode }) {
	return (
		<div className="text-center">
			{icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-800 ring-1 ring-gray-700">{icon}</div>}
			<h1 className="mb-2 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
			{sub && <p className="text-gray-400">{sub}</p>}
		</div>
	)
}

const inputClass =
	"w-full rounded-lg border bg-gray-800 px-4 py-3 text-white placeholder-gray-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-amber-500"

export function EmailField({
	value,
	onChange,
	label = "Email address",
	error,
	autoFocus,
}: {
	value: string
	onChange: (v: string) => void
	label?: string
	error?: boolean
	autoFocus?: boolean
}) {
	return (
		<div>
			<label htmlFor="auth-email" className="mb-2 block text-sm font-medium text-gray-300">
				{label}
			</label>
			<input
				id="auth-email"
				name="email"
				type="email"
				autoComplete="email"
				required
				// biome-ignore lint/a11y/noAutofocus: the page's only task is this form
				autoFocus={autoFocus}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				aria-invalid={error || undefined}
				className={`${inputClass} ${error ? "border-red-500" : "border-gray-700"}`}
				placeholder="you@example.com"
			/>
		</div>
	)
}

export function PasswordField({
	id = "auth-password",
	value,
	onChange,
	label = "Password",
	labelAside,
	isNew,
	hint,
	error,
	autoFocus,
}: {
	id?: string
	value: string
	onChange: (v: string) => void
	label?: string
	labelAside?: ReactNode
	isNew?: boolean
	hint?: ReactNode
	error?: boolean
	autoFocus?: boolean
}) {
	const [shown, setShown] = useState(false)
	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<label htmlFor={id} className="block text-sm font-medium text-gray-300">
					{label}
				</label>
				{labelAside}
			</div>
			<div className="relative">
				<input
					id={id}
					name={isNew ? "new-password" : "password"}
					type={shown ? "text" : "password"}
					autoComplete={isNew ? "new-password" : "current-password"}
					required
					minLength={isNew ? PASSWORD_MIN : undefined}
					// biome-ignore lint/a11y/noAutofocus: the page's only task is this form
					autoFocus={autoFocus}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					aria-invalid={error || undefined}
					className={`${inputClass} pr-12 ${error ? "border-red-500" : "border-gray-700"}`}
					placeholder="••••••••••"
				/>
				<button
					type="button"
					onClick={() => setShown(!shown)}
					className="absolute inset-y-0 right-0 flex cursor-pointer items-center px-4 text-gray-400 hover:text-white"
					aria-label={shown ? "Hide password" : "Show password"}
					aria-pressed={shown}
				>
					{shown ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
				</button>
			</div>
			{hint}
		</div>
	)
}

// The length rule, ticked off while the member types.
export function PasswordRule({ password }: { password: string }) {
	const ok = password.length >= PASSWORD_MIN
	return (
		<p className={`mt-2 flex items-center gap-1.5 text-sm ${ok ? "text-emerald-400" : "text-gray-400"}`}>
			<CheckCircleIcon className={`h-4 w-4 ${ok ? "" : "opacity-40"}`} />
			At least {PASSWORD_MIN} characters
		</p>
	)
}

export function PrimaryButton({
	children,
	busy,
	disabled,
	onClick,
	type = "submit",
	danger,
}: {
	children: ReactNode
	busy?: boolean
	disabled?: boolean
	onClick?: () => void
	type?: "submit" | "button"
	/** Red, for the one button that deletes something for good. */
	danger?: boolean
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={busy || disabled}
			aria-busy={busy || undefined}
			className={`flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-3 font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 ${danger ? "bg-red-700 hover:bg-red-600" : "bg-amber-700 hover:bg-amber-600"}`}
		>
			{busy ? <Spinner size="small" /> : children}
		</button>
	)
}

export function SecondaryButton({ children, onClick, busy, disabled }: { children: ReactNode; onClick?: () => void; busy?: boolean; disabled?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy || disabled}
			aria-busy={busy || undefined}
			className="flex w-full cursor-pointer items-center justify-center rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 font-semibold text-gray-100 transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500"
		>
			{busy ? <Spinner size="small" /> : children}
		</button>
	)
}

export const googleMark = (
	<svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
		<path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
		<path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
		<path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
		<path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
	</svg>
)

export function GoogleButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={busy}
			aria-busy={busy || undefined}
			className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-100 px-4 py-3 text-lg font-medium text-black transition duration-200 hover:bg-gray-300 disabled:opacity-60"
		>
			{busy ? <Spinner size="small" /> : googleMark}
			<span>Continue with Google</span>
		</button>
	)
}

export function OrDivider({ text = "or with email" }: { text?: string }) {
	return (
		<div className="relative">
			<div className="absolute inset-0 flex items-center">
				<div className="w-full border-t border-gray-700" />
			</div>
			<div className="relative flex justify-center text-sm">
				<span className="bg-gray-900 px-2 text-gray-400">{text}</span>
			</div>
		</div>
	)
}

const NOTICE_TONES = {
	info: { box: "border-sky-700 bg-sky-950/60 text-sky-100", icon: <InformationCircleIcon className="h-5 w-5 shrink-0 text-sky-400" /> },
	warn: { box: "border-amber-700 bg-amber-950/50 text-amber-100", icon: <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-amber-400" /> },
	error: { box: "border-red-700 bg-red-950/50 text-red-100", icon: <ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-red-400" /> },
	ok: { box: "border-emerald-700 bg-emerald-950/50 text-emerald-100", icon: <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" /> },
}

export function Notice({ tone, children }: { tone: keyof typeof NOTICE_TONES; children: ReactNode }) {
	return (
		<div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-lg border p-4 text-sm leading-relaxed ${NOTICE_TONES[tone].box}`}>
			{NOTICE_TONES[tone].icon}
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	)
}

/** The notice for a request the server turned away for being too many or for being down. */
export function ServiceNotice({ failure }: { failure: AuthFailure | null }) {
	if (failure === "throttled") return <Notice tone="warn">Too many tries in a row. Wait a few minutes, then try again.</Notice>
	if (failure === "unavailable") return <Notice tone="error">Sign-in isn't working right now. Try again in a few minutes.</Notice>
	return null
}

export const textLink = "cursor-pointer font-medium text-amber-500 hover:text-amber-400"

export function TextLink({ to, children, replace }: { to: string; children: ReactNode; replace?: boolean }) {
	return (
		<Link to={to} replace={replace} rel="nofollow" className={textLink}>
			{children}
		</Link>
	)
}

export function BackToSignIn() {
	return (
		<Link to="/sign-in" rel="nofollow" className="mx-auto flex items-center gap-1.5 text-sm text-gray-400 hover:text-white">
			<ArrowLeftIcon className="h-4 w-4" /> Back to sign in
		</Link>
	)
}

/** "Resend in 0:42": a new link at most once in that many seconds. */
export function useCooldown(seconds: number, startRunning = true) {
	const [left, setLeft] = useState(startRunning ? seconds : 0)
	useEffect(() => {
		if (left <= 0) return
		const id = setTimeout(() => setLeft(left - 1), 1000)
		return () => clearTimeout(id)
	}, [left])
	return { left, restart: () => setLeft(seconds) }
}
