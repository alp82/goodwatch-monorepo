// PROTOTYPE - throwaway (settings subpages, round 2). Account and sign-in with only what the real page can do today:
// it shows how you sign in, changes the password (members with email sign-in), and restarts setup. No placeholders
// for unbuilt controls. Fake member; nothing saves.
import { ArrowPathIcon, CheckCircleIcon, EnvelopeIcon, KeyIcon } from "@heroicons/react/24/outline"
import { type ReactNode, useState } from "react"
import { PasswordInput } from "~/ui/form/PasswordInput"
import { MEMBER } from "./data"

const googleLogo = (
	<svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
		<path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335" />
		<path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4" />
		<path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05" />
		<path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853" />
	</svg>
)

const card = "flex flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6"
const button =
	"inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-600 px-4 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-60"

function MethodCard({ icon, name, detail, children }: { icon: ReactNode; name: string; detail: string; children?: ReactNode }) {
	return (
		<div className={card}>
			<div className="flex items-center gap-4">
				<span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">{icon}</span>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-white">{name}</p>
					<p className="truncate text-sm text-gray-400">{detail}</p>
				</div>
				<CheckCircleIcon className="size-6 shrink-0 text-emerald-400" aria-label="In use" />
			</div>
			{children}
		</div>
	)
}

function PasswordChange() {
	const [open, setOpen] = useState(false)
	const [current, setCurrent] = useState("")
	const [next, setNext] = useState("")
	const [done, setDone] = useState(false)
	if (!open)
		return (
			<div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
				<button type="button" className={button} onClick={() => setOpen(true)}>
					<KeyIcon className="size-4" aria-hidden /> Change password
				</button>
				{done && (
					<output className="text-sm text-emerald-300">Password changed. Other devices are signed out.</output>
				)}
			</div>
		)
	return (
		<form
			className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4"
			onSubmit={(e) => {
				e.preventDefault()
				setOpen(false)
				setDone(true)
				setCurrent("")
				setNext("")
			}}
		>
			<div className="grid gap-3 sm:grid-cols-2">
				<PasswordInput id="proto-account-current" label="Current password" placeholder="" value={current} onChange={setCurrent} />
				<PasswordInput id="proto-account-new" label="New password" placeholder="at least 8 characters" value={next} onChange={setNext} />
			</div>
			<p className="text-sm text-gray-400">Other devices are signed out. Connected apps keep working.</p>
			<div className="flex flex-wrap gap-3">
				<button
					type="submit"
					disabled={!current || next.length < 8}
					className="inline-flex min-h-10 cursor-pointer items-center rounded-md bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-gray-400"
				>
					Change password
				</button>
				<button type="button" className={button} onClick={() => setOpen(false)}>
					Cancel
				</button>
			</div>
		</form>
	)
}

function RestartSetup() {
	const [state, setState] = useState<"idle" | "done">("idle")
	return (
		<div className={`${card} md:flex-row md:items-center md:gap-6`}>
			<span className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 md:mb-0">
				<ArrowPathIcon className="size-6 text-gray-300" aria-hidden />
			</span>
			<div className="min-w-0 flex-1">
				<p className="font-semibold text-white">Restart setup</p>
				<p className="text-sm text-gray-400">Go through the first steps again: your country, your services and your scores. Nothing you saved is lost.</p>
				<output aria-live="polite" className="mt-1 block text-sm text-emerald-300">
					{state === "done" ? "Done. The first steps show up again." : ""}
				</output>
			</div>
			<button type="button" className={`${button} mt-3 self-start md:mt-0 md:self-center`} onClick={() => setState("done")}>
				Restart setup
			</button>
		</div>
	)
}

export function AccountPage() {
	return (
		<div className="flex max-w-4xl flex-col gap-10">
			<section className="flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 md:p-6">
				<span
					aria-hidden="true"
					className="flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-2xl font-black text-white uppercase"
				>
					{MEMBER.handle.slice(0, 1)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="truncate text-xl font-black text-white md:text-2xl">{MEMBER.email}</p>
					<p className="text-sm text-gray-400">
						@{MEMBER.handle} · Member since {MEMBER.memberSince}
					</p>
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<div>
					<h2 className="text-lg font-bold text-white">How you sign in</h2>
					<p className="text-sm text-gray-400">Either way opens the same account.</p>
				</div>
				<div className="grid items-start gap-4 md:grid-cols-2">
					<MethodCard icon={<EnvelopeIcon className="size-6 text-gray-300" aria-hidden />} name="Email and password" detail={MEMBER.email}>
						<PasswordChange />
					</MethodCard>
					<MethodCard icon={googleLogo} name="Google" detail={`Signed in with ${MEMBER.email}`} />
				</div>
			</section>

			<section className="flex flex-col gap-3">
				<h2 className="text-lg font-bold text-white">Start over</h2>
				<RestartSetup />
			</section>
		</div>
	)
}
