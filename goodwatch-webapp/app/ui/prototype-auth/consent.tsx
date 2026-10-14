// PROTOTYPE - throwaway (issue #534). The OAuth consent page an app such as Claude opens when a member connects it.
//   A: a card inside the site, under the usual header; the app gets everything the connector offers.
//   B: a page of its own without the site's navigation, and the member picks "See and change" or "See only".
// `client` picks the app: claude and chatgpt bring published details (CIMD), claude-code returns to this computer,
// unknown registered itself (DCR) and gets a warning.
import {
	ArrowPathIcon,
	BookmarkIcon,
	CheckIcon,
	ChartBarIcon,
	EyeIcon,
	GlobeAltIcon,
	LockClosedIcon,
	NoSymbolIcon,
	PencilSquareIcon,
	PlayCircleIcon,
	StarIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import { ExclamationTriangleIcon, ShieldCheckIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useState } from "react"
import { CLIENTS, type ClientKey, ClientBadge, GoodWatchBadge, SAMPLE_EMAIL, useFakeSubmit, useGo } from "~/ui/prototype-auth/kit"

const CAN_SEE: { icon: typeof EyeIcon; text: string }[] = [
	{ icon: StarIcon, text: "Your ratings, Wishlist and Not interested titles" },
	{ icon: PlayCircleIcon, text: "What you've watched and where you are in each show" },
	{ icon: ChartBarIcon, text: "Your taste profile and recommendations" },
	{ icon: TvIcon, text: "Your country and streaming services" },
]
const CAN_CHANGE: { icon: typeof EyeIcon; text: string }[] = [
	{ icon: PlayCircleIcon, text: "Log what you watched, and undo it" },
	{ icon: StarIcon, text: "Rate titles and mark them Not interested" },
	{ icon: BookmarkIcon, text: "Add titles to your Wishlist and remove them" },
	{ icon: PencilSquareIcon, text: "Set a show to Watching, On hold or Dropped" },
	{ icon: GlobeAltIcon, text: "Change your country and streaming services" },
]
const CANNOT = ["See your email address or password", "Change your password or delete your account", "Connect other apps"]

type Access = "change" | "see"

export function Consent({ variant, state, client }: { variant: "A" | "B"; state: string; client: ClientKey }) {
	const go = useGo()
	const [access, setAccess] = useState<Access>("change")
	const allow = useFakeSubmit(() => go({ state: "allowed" }))
	const deny = useFakeSubmit(() => go({ state: "denied" }))
	const c = CLIENTS[client]

	if (state === "allowed" || state === "denied") {
		const page = <Leaving client={client} allowed={state === "allowed"} />
		return variant === "B" ? <Standalone>{page}</Standalone> : <InSite>{page}</InSite>
	}

	const body = (
		<>
			<Header client={client} />
			{!c.verified && <UnverifiedWarning client={client} />}
			<SignedInAs />
			{variant === "B" ? (
				<AccessChoice access={access} onChange={setAccess} />
			) : (
				<>
					<List title={`${c.name} can see`} items={CAN_SEE} />
					<List title={`${c.name} can change`} items={CAN_CHANGE} />
				</>
			)}
			<Cannot name={c.name} />
			<div className="flex flex-col-reverse gap-3 sm:flex-row">
				<button
					type="button"
					onClick={() => deny.submit()}
					disabled={allow.busy || deny.busy}
					className="flex-1 cursor-pointer rounded-lg border border-gray-600 bg-gray-800 px-4 py-3 font-semibold text-gray-100 hover:bg-gray-700"
				>
					Deny
				</button>
				<button
					type="button"
					onClick={() => allow.submit()}
					disabled={allow.busy || deny.busy}
					className="flex-1 cursor-pointer rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white hover:bg-amber-600"
				>
					{allow.busy ? "Connecting…" : `Allow ${c.name}`}
				</button>
			</div>
			<p className="text-center text-xs leading-relaxed text-gray-500">
				Afterwards you go back to {c.host}. Disconnect {c.name} any time in Settings, Connected apps.
			</p>
		</>
	)
	return variant === "B" ? <Standalone>{body}</Standalone> : <InSite>{body}</InSite>
}

function InSite({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-[calc(100vh-4rem)] justify-center bg-gray-900 px-4 py-8 sm:py-14">
			<div className="flex w-full max-w-lg flex-col gap-6 self-start rounded-2xl border border-gray-700 bg-gray-800/40 p-5 shadow-2xl sm:p-8">{children}</div>
		</div>
	)
}

// Covers the site's header and dock: the page belongs to the app's flow, not to browsing GoodWatch.
function Standalone({ children }: { children: ReactNode }) {
	return (
		<div data-standalone className="fixed inset-0 z-[1050] overflow-y-auto bg-gray-950">
			<div className="mx-auto flex min-h-full max-w-lg flex-col gap-6 px-5 py-8 sm:py-14">
				<p className="text-center text-2xl font-black tracking-tight text-white">
					Good<span className="text-amber-400">Watch</span>
				</p>
				{children}
			</div>
		</div>
	)
}

function Header({ client }: { client: ClientKey }) {
	const c = CLIENTS[client]
	return (
		<div className="text-center">
			<div className="mb-5 flex items-center justify-center gap-3">
				<ClientBadge client={client} size="lg" />
				<span className="flex items-center gap-1 text-gray-500" aria-hidden="true">
					<span className="h-1 w-1 rounded-full bg-current" />
					<span className="h-1 w-1 rounded-full bg-current" />
					<span className="h-1 w-1 rounded-full bg-current" />
				</span>
				<GoodWatchBadge size="lg" />
			</div>
			<h1 className="text-2xl font-bold text-white sm:text-3xl">{c.name} wants to access your GoodWatch</h1>
			<p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-gray-400">
				{c.verified ? <ShieldCheckIcon className="h-4 w-4 text-emerald-400" /> : <ExclamationTriangleIcon className="h-4 w-4 text-amber-400" />}
				{c.verified ? `By ${c.maker} · ${c.host}` : `Unverified app · ${c.host}`}
			</p>
		</div>
	)
}

function UnverifiedWarning({ client }: { client: ClientKey }) {
	const c = CLIENTS[client]
	return (
		<div className="rounded-xl border border-amber-700 bg-amber-950/50 p-4 text-sm leading-relaxed text-amber-50">
			<p className="font-semibold">GoodWatch can't check who made this app.</p>
			<p className="mt-1">
				It calls itself "{c.name}". Only allow it if you started this connection yourself, in an app you trust. It returns to {c.host}.
			</p>
		</div>
	)
}

function SignedInAs() {
	const go = useGo()
	return (
		<div className="flex items-center gap-3 rounded-xl bg-gray-900/70 px-4 py-3 ring-1 ring-gray-700">
			<span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 font-semibold text-white">A</span>
			<div className="min-w-0 flex-1 text-sm">
				<p className="text-gray-400">Signed in as</p>
				<p className="truncate font-medium text-gray-100">{SAMPLE_EMAIL}</p>
			</div>
			<button type="button" onClick={() => go({ screen: "sign-in", state: "connect" })} className="cursor-pointer text-sm font-medium text-amber-500 hover:text-amber-400">
				Switch
			</button>
		</div>
	)
}

function List({ title, items, muted }: { title: string; items: { icon: typeof EyeIcon; text: string }[]; muted?: boolean }) {
	return (
		<section className={muted ? "opacity-40" : ""}>
			<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">{title}</h2>
			<ul className="space-y-2.5">
				{items.map(({ icon: Icon, text }) => (
					<li key={text} className="flex items-start gap-3 text-gray-200">
						<Icon className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
						<span>{text}</span>
					</li>
				))}
			</ul>
		</section>
	)
}

function Cannot({ name }: { name: string }) {
	return (
		<section className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
			<h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-300">
				<LockClosedIcon className="h-4 w-4" /> {name} can never
			</h2>
			<ul className="space-y-1 text-sm text-gray-400">
				{CANNOT.map((text) => (
					<li key={text} className="flex items-start gap-2">
						<NoSymbolIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
						{text}
					</li>
				))}
			</ul>
		</section>
	)
}

function AccessChoice({ access, onChange }: { access: Access; onChange: (a: Access) => void }) {
	const option = (key: Access, title: string, note: string) => (
		<label
			className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${access === key ? "border-amber-500 bg-amber-950/30" : "border-gray-700 bg-gray-900/50 hover:border-gray-500"}`}
		>
			<input type="radio" name="access" checked={access === key} onChange={() => onChange(key)} className="mt-1 h-4 w-4 border-gray-600 bg-gray-800 text-amber-600 focus:ring-amber-500" />
			<span>
				<span className="block font-semibold text-white">{title}</span>
				<span className="block text-sm text-gray-400">{note}</span>
			</span>
		</label>
	)
	return (
		<div className="space-y-5">
			<div className="grid gap-3 sm:grid-cols-2">
				{option("change", "See and change", "Log watches, rate and keep your lists by chatting.")}
				{option("see", "See only", "Ask about your shows and taste. Nothing changes.")}
			</div>
			<List title="It can see" items={CAN_SEE} />
			<List title={access === "see" ? "It can't change anything" : "It can change"} items={CAN_CHANGE} muted={access === "see"} />
		</div>
	)
}

// After the choice the browser goes straight back to the app; this is the moment in between.
function Leaving({ client, allowed }: { client: ClientKey; allowed: boolean }) {
	const go = useGo()
	const c = CLIENTS[client]
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			{allowed ? <CheckIcon className="h-12 w-12 rounded-full bg-emerald-900 p-2.5 text-emerald-300" /> : <NoSymbolIcon className="h-12 w-12 text-gray-400" />}
			<h1 className="text-2xl font-bold text-white">{allowed ? `${c.name} is connected` : `${c.name} was not connected`}</h1>
			<p className="flex items-center gap-2 text-gray-400">
				<ArrowPathIcon className="h-4 w-4 animate-spin" /> Taking you back to {c.host}…
			</p>
			<button type="button" onClick={() => go({ state: "ask" })} className="cursor-pointer text-sm text-amber-500 hover:text-amber-400">
				Prototype: back to the question
			</button>
		</div>
	)
}
