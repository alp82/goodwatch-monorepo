// PROTOTYPE - throwaway (issue #534). Connected apps in the settings: which apps reach the member's GoodWatch, and
// Disconnect.
//   A: a tab of its own in the settings' sidebar.
//   B: a section at the end of the Account tab, under the sign-in methods and the password.
import { ArrowDownTrayIcon, AtSymbolIcon, ClipboardDocumentIcon, EyeSlashIcon, FlagIcon, LinkIcon, TvIcon, UserIcon } from "@heroicons/react/24/solid"
import { CheckIcon, EnvelopeIcon } from "@heroicons/react/24/outline"
import { type ReactNode, useState } from "react"
import { type ClientKey, ClientBadge, googleMark, SAMPLE_EMAIL } from "~/ui/prototype-auth/kit"

type App = { id: string; client: ClientKey; name: string; access: string; connected: string; used: string; where?: string }
const SAMPLE_APPS: App[] = [
	{ id: "claude", client: "claude", name: "Claude", access: "Can see and change", connected: "Connected 3 Oct 2026", used: "Last used 2 hours ago" },
	{ id: "claude-code", client: "claude-code", name: "Claude Code", access: "Can see and change", connected: "Connected 9 Oct 2026", used: "Last used yesterday", where: "On a computer" },
	{ id: "chatgpt", client: "chatgpt", name: "ChatGPT", access: "Can see only", connected: "Connected 12 Sept 2026", used: "Last used 18 days ago" },
]

const NAV = [
	{ name: "Country", icon: FlagIcon },
	{ name: "Streaming", icon: TvIcon },
	{ name: "Profile", icon: AtSymbolIcon },
	{ name: "Imports", icon: ArrowDownTrayIcon },
	{ name: "Hidden titles", icon: EyeSlashIcon },
	{ name: "Account", icon: UserIcon },
]

// A copy of the settings page's frame (routes/settings.tsx), which needs a signed-in member to render.
function SettingsFrame({ current, extraTab, children }: { current: string; extraTab: boolean; children: ReactNode }) {
	const nav = extraTab ? [...NAV, { name: "Connected apps", icon: LinkIcon }] : NAV
	return (
		<div className="mx-auto max-w-7xl px-4 py-2 sm:px-8 md:py-4 lg:py-8">
			<div className="flex flex-col gap-4 text-sm text-gray-300 sm:text-base">
				<h1 className="my-3 text-center text-2xl font-bold tracking-tight text-gray-100 sm:my-6 sm:text-3xl md:text-4xl lg:text-5xl">Your Settings</h1>
				<hr className="mb-4 border-gray-700" />
				<div className="flex flex-wrap gap-4 lg:gap-8">
					<nav aria-label="Sidebar">
						<ul className="-mx-2 w-36 space-y-1 lg:w-48">
							{nav.map((item) => {
								const isCurrent = item.name === current
								return (
									<li key={item.name}>
										<span
											className={`${isCurrent ? "bg-indigo-800 text-gray-50" : "text-gray-400"} group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold`}
										>
											<item.icon aria-hidden="true" className={`${isCurrent ? "text-gray-50" : "text-gray-400"} h-6 w-6`} />
											{item.name}
										</span>
									</li>
								)
							})}
						</ul>
					</nav>
					<div className="min-w-0 flex-1 basis-80">{children}</div>
				</div>
			</div>
		</div>
	)
}

export function ConnectedApps({ variant, state }: { variant: "A" | "B"; state: string }) {
	const [apps, setApps] = useState(state === "empty" ? [] : SAMPLE_APPS)
	const [removed, setRemoved] = useState<string | null>(null)
	const disconnect = (app: App) => {
		setApps(apps.filter((a) => a.id !== app.id))
		setRemoved(app.name)
	}
	const section = <AppsSection apps={apps} removed={removed} onDisconnect={disconnect} confirming={state === "confirm" ? "claude" : null} heading={variant === "A" ? "h2" : "h3"} />
	if (variant === "A")
		return (
			<SettingsFrame current="Connected apps" extraTab>
				<div className="px-2 md:px-4 lg:px-8">{section}</div>
			</SettingsFrame>
		)
	return (
		<SettingsFrame current="Account" extraTab={false}>
			<div className="flex flex-col gap-4 px-2 md:px-4 lg:px-8">
				<h2 className="text-base font-bold tracking-tight text-gray-100 sm:text-lg md:text-xl lg:text-2xl">Account</h2>
				<div className="flex flex-wrap items-center gap-2 text-base">
					<span>You sign in with:</span>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1 text-sm">
						<span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4">{googleMark}</span> Google
					</span>
					<span className="inline-flex items-center gap-1.5 rounded-full bg-gray-800 px-3 py-1 text-sm">
						<EnvelopeIcon className="h-4 w-4" /> {SAMPLE_EMAIL}
					</span>
				</div>
				<div className="mt-4 rounded-xl border border-dashed border-gray-700 p-4 text-sm text-gray-500">Change password and Restart onboarding, as today (folded away in this prototype).</div>
				<div className="mt-6 border-t border-gray-800 pt-8">{section}</div>
			</div>
		</SettingsFrame>
	)
}

function AppsSection({
	apps,
	removed,
	onDisconnect,
	confirming,
	heading,
}: {
	apps: App[]
	removed: string | null
	onDisconnect: (app: App) => void
	confirming: string | null
	heading: "h2" | "h3"
}) {
	const H = heading
	return (
		<section className="flex max-w-2xl flex-col gap-5">
			<div>
				<H className={`font-bold tracking-tight text-gray-100 ${heading === "h2" ? "text-base sm:text-lg md:text-xl lg:text-2xl" : "text-base md:text-lg lg:text-xl"}`}>Connected apps</H>
				<p className="mt-1 text-gray-400">Assistants that can reach your GoodWatch. Disconnecting stops them right away; nothing you saved is lost.</p>
			</div>
			{removed && (
				<p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100">
					<CheckIcon className="h-4 w-4 text-emerald-400" /> {removed} is disconnected. To use it again, connect it from {removed}.
				</p>
			)}
			{apps.length === 0 ? (
				<div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6 text-center">
					<p className="font-semibold text-gray-100">No apps connected</p>
					<p className="mx-auto mt-1 max-w-md text-sm text-gray-400">Add GoodWatch to Claude or ChatGPT to log watches, rate titles and pick tonight's movie by chatting.</p>
				</div>
			) : (
				<ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-700 bg-gray-800/40">
					{apps.map((app) => (
						<AppRow key={app.id} app={app} startConfirming={confirming === app.id} onDisconnect={() => onDisconnect(app)} />
					))}
				</ul>
			)}
			<ConnectorAddress />
		</section>
	)
}

function AppRow({ app, onDisconnect, startConfirming }: { app: App; onDisconnect: () => void; startConfirming: boolean }) {
	const [confirming, setConfirming] = useState(startConfirming)
	return (
		<li className="p-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<ClientBadge client={app.client} size="md" />
				<div className="min-w-0 flex-1 basis-48">
					<p className="font-semibold text-gray-100">
						{app.name}
						{app.where && <span className="ml-2 text-sm font-normal text-gray-500">{app.where}</span>}
					</p>
					<p className={`text-sm ${app.access.includes("change") ? "text-amber-300" : "text-sky-300"}`}>{app.access}</p>
					<p className="text-sm text-gray-500">
						{app.connected} · {app.used}
					</p>
				</div>
				{!confirming && (
					<button
						type="button"
						onClick={() => setConfirming(true)}
						className="cursor-pointer rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-200 hover:border-red-500 hover:text-red-300"
					>
						Disconnect
					</button>
				)}
			</div>
			{confirming && (
				<div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-red-950/40 p-3 ring-1 ring-red-900">
					<p className="min-w-0 flex-1 basis-56 text-sm text-red-100">Disconnect {app.name}? It stops working with GoodWatch right away.</p>
					<div className="flex gap-2">
						<button type="button" onClick={() => setConfirming(false)} className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800">
							Cancel
						</button>
						<button type="button" onClick={onDisconnect} className="cursor-pointer rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600">
							Disconnect
						</button>
					</div>
				</div>
			)}
		</li>
	)
}

// What a member pastes into Claude or ChatGPT to add GoodWatch.
function ConnectorAddress() {
	const [copied, setCopied] = useState(false)
	return (
		<div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
			<p className="text-sm font-semibold text-gray-200">Connect a new app</p>
			<p className="mt-1 text-sm text-gray-400">In Claude or ChatGPT, add a custom connector with this address. You approve it here once.</p>
			<div className="mt-3 flex items-center gap-2">
				<code className="min-w-0 flex-1 truncate rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 ring-1 ring-gray-700">https://goodwatch.app/mcp</code>
				<button
					type="button"
					onClick={() => {
						setCopied(true)
						setTimeout(() => setCopied(false), 1500)
					}}
					className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-gray-600"
				>
					{copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<p className="mt-2 text-sm">
				<span className="cursor-pointer text-amber-500 hover:text-amber-400">Step-by-step for Claude and ChatGPT</span>
			</p>
		</div>
	)
}
