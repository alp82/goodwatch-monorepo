// PROTOTYPE - throwaway (issue #534). Shared pieces of the account page prototypes: the split layout of today's sign-in
// pages, fields, buttons, notices and the fake "submit" that only moves the prototype to its next screen.
import { CheckCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeSlashIcon, InformationCircleIcon } from "@heroicons/react/24/solid"
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useState } from "react"
import { AuthHookImage } from "~/ui/auth/AuthHookImage"
import { Spinner } from "~/ui/wait/Spinner"

export const SAMPLE_EMAIL = "alex@example.com"

// Moves the prototype to another screen or state, as a real submit or link would. The address keeps the other switches.
export function useGo() {
	const [params, setParams] = useSearchParams()
	return (next: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		for (const [key, value] of Object.entries(next)) {
			if (value === null) p.delete(key)
			else p.set(key, value)
		}
		setParams(p, { replace: false })
		window.scrollTo({ top: 0, behavior: "instant" })
	}
}

// A submit that pretends to talk to the server for a moment.
export function useFakeSubmit(after: () => void) {
	const [busy, setBusy] = useState(false)
	const submit = (e?: { preventDefault: () => void }) => {
		e?.preventDefault()
		if (busy) return
		setBusy(true)
		setTimeout(() => {
			setBusy(false)
			after()
		}, 700)
	}
	return { busy, submit }
}

// Today's layout of sign-in, sign-up and the password pages: the form on the left, the picture from lg up.
export function AuthSplit({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
	return (
		<div className="flex min-h-[calc(100vh-4rem)] bg-gray-900">
			<div className="flex flex-1 items-start justify-center px-4 py-10 sm:px-8 lg:items-center lg:p-16">
				<div className="flex w-full max-w-md flex-col gap-7">{children}</div>
			</div>
			<div className="relative hidden overflow-hidden shadow-xl lg:block lg:flex-1">
				<div className="absolute inset-0 z-10 bg-gradient-to-br from-green-600/20 to-orange-600/20" />
				<AuthHookImage />
				<div className="absolute inset-0 z-20 flex items-center justify-center">
					{aside ?? (
						<div className="p-8 text-center text-white">
							<h2 className="mb-8 text-5xl font-bold">Your Personal Movie Guide</h2>
							<p className="mx-auto max-w-md text-xl text-gray-200">Track, rate, and discover your next favorite movies and shows all in one place.</p>
						</div>
					)}
				</div>
			</div>
		</div>
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

export function EmailField({ value, onChange, label = "Email address", error }: { value: string; onChange: (v: string) => void; label?: string; error?: boolean }) {
	return (
		<div>
			<label htmlFor="proto-email" className="mb-2 block text-sm font-medium text-gray-300">
				{label}
			</label>
			<input
				id="proto-email"
				type="email"
				autoComplete="email"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`${inputClass} ${error ? "border-red-500" : "border-gray-700"}`}
				placeholder="you@example.com"
			/>
		</div>
	)
}

export function PasswordField({
	value,
	onChange,
	label = "Password",
	labelAside,
	isNew,
	hint,
	error,
}: {
	value: string
	onChange: (v: string) => void
	label?: string
	labelAside?: ReactNode
	isNew?: boolean
	hint?: ReactNode
	error?: boolean
}) {
	const [shown, setShown] = useState(false)
	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-2">
				<label htmlFor="proto-password" className="block text-sm font-medium text-gray-300">
					{label}
				</label>
				{labelAside}
			</div>
			<div className="relative">
				<input
					id="proto-password"
					type={shown ? "text" : "password"}
					autoComplete={isNew ? "new-password" : "current-password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					className={`${inputClass} pr-12 ${error ? "border-red-500" : "border-gray-700"}`}
					placeholder="••••••••••"
				/>
				<button
					type="button"
					onClick={() => setShown(!shown)}
					className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 hover:text-white"
					aria-label={shown ? "Hide password" : "Show password"}
				>
					{shown ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
				</button>
			</div>
			{hint}
		</div>
	)
}

// The length rule, ticked off while the member types.
export function PasswordRule({ password, min }: { password: string; min: number }) {
	const ok = password.length >= min
	return (
		<p className={`mt-2 flex items-center gap-1.5 text-sm ${ok ? "text-emerald-400" : "text-gray-400"}`}>
			<CheckCircleIcon className={`h-4 w-4 ${ok ? "" : "opacity-40"}`} />
			At least {min} characters
		</p>
	)
}

export function PrimaryButton({ children, busy, disabled, onClick, type = "submit" }: { children: ReactNode; busy?: boolean; disabled?: boolean; onClick?: () => void; type?: "submit" | "button" }) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={busy || disabled}
			className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white transition duration-200 hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
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

export function GoogleButton({ onDone }: { onDone: () => void }) {
	const { busy, submit } = useFakeSubmit(onDone)
	return (
		<button
			type="button"
			onClick={() => submit()}
			disabled={busy}
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

export function Notice({ tone, children, icon }: { tone: keyof typeof NOTICE_TONES; children: ReactNode; icon?: ReactNode }) {
	return (
		<div role="status" className={`flex gap-3 rounded-lg border p-4 text-sm leading-relaxed ${NOTICE_TONES[tone].box}`}>
			{icon ?? NOTICE_TONES[tone].icon}
			<div className="min-w-0 flex-1">{children}</div>
		</div>
	)
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} className="cursor-pointer font-medium text-amber-500 hover:text-amber-400">
			{children}
		</button>
	)
}

// The apps a member can connect. The prototype fakes how each one reaches the consent page.
export type ClientKey = "claude" | "chatgpt" | "claude-code" | "unknown"
export const CLIENTS: Record<ClientKey, { name: string; maker: string; host: string; verified: boolean; how: string }> = {
	claude: { name: "Claude", maker: "Anthropic", host: "claude.ai", verified: true, how: "Its details come from claude.ai." },
	chatgpt: { name: "ChatGPT", maker: "OpenAI", host: "chatgpt.com", verified: true, how: "Its details come from chatgpt.com." },
	"claude-code": { name: "Claude Code", maker: "Anthropic", host: "this computer", verified: true, how: "It runs on this computer and returns to it after you choose." },
	unknown: { name: "Movie Buddy", maker: "unknown", host: "moviebuddy.example", verified: false, how: "The app named itself; GoodWatch can't check who made it." },
}

// Neutral badges, not the apps' own logos: the real page shows the logo from the app's published details.
export function ClientBadge({ client, size = "md" }: { client: ClientKey; size?: "sm" | "md" | "lg" }) {
	const dims = { sm: "h-9 w-9 text-base", md: "h-12 w-12 text-xl", lg: "h-16 w-16 text-2xl" }[size]
	const look: Record<ClientKey, string> = {
		claude: "bg-[#d97757] text-white",
		chatgpt: "bg-white text-black",
		"claude-code": "bg-[#2b2a27] text-[#d97757] ring-1 ring-[#d97757]/50",
		unknown: "bg-gray-700 text-gray-300",
	}
	const glyph: Record<ClientKey, ReactNode> = {
		claude: <Spark />,
		chatgpt: <span className="font-bold">G</span>,
		"claude-code": <span className="font-mono font-bold">&gt;_</span>,
		unknown: <span className="font-bold">?</span>,
	}
	return <span className={`inline-flex shrink-0 items-center justify-center rounded-2xl ${dims} ${look[client]}`}>{glyph[client]}</span>
}

function Spark() {
	return (
		<svg viewBox="0 0 24 24" className="h-[55%] w-[55%]" aria-hidden="true">
			{[0, 30, 60, 90, 120, 150].map((angle) => (
				<rect key={angle} x="11" y="2" width="2" height="20" rx="1" fill="currentColor" transform={`rotate(${angle} 12 12)`} />
			))}
		</svg>
	)
}

export function GoodWatchBadge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
	const dims = { sm: "h-9 w-9 text-sm", md: "h-12 w-12 text-lg", lg: "h-16 w-16 text-2xl" }[size]
	return <span className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-gray-950 font-black text-amber-400 ring-1 ring-amber-500/40 ${dims}`}>GW</span>
}

export const POSTERS = [
	{ title: "Dune: Part Two", path: "6izwz7rsy95ARzTR3poZ8H6c5pp" },
	{ title: "Parasite", path: "7IiTTgloJzvGI1TAYymCfbfl3vT" },
	{ title: "Oppenheimer", path: "8Gxv8gSFCU0XGDykEGv7zR1n2ua" },
	{ title: "Stranger Things", path: "uOOtwVbSr4QDjAGIifLDwpb2Pdl" },
	{ title: "Interstellar", path: "yQvGrMoipbRoddT0ZR8tPoR7NfX" },
	{ title: "The Matrix", path: "dXNAPwY7VrqMAo51EKhhCJfaGb5" },
	{ title: "Game of Thrones", path: "1XS1oqL89opfnbLl8WnZY1O1uJx" },
	{ title: "Everything Everywhere All at Once", path: "vt5Fd1wouNEL7HN3TQ0PMls4auE" },
	{ title: "Inception", path: "xn0Kcg4e6p0mLxVS3nAWhNmW2Ni" },
]
export const posterUrl = (path: string) => `https://image.tmdb.org/t/p/w342/${path}.jpg`
