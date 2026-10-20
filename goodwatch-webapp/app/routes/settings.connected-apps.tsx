// Settings, Connected apps (#534: variant A, #570): the apps that reach the member's GoodWatch through MCP, when each
// was last used, and Disconnect after a confirmation. Claude Code shows one row per computer.
import { CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Link, useLoaderData, useRevalidator } from "@remix-run/react"
import { useState } from "react"
import { type ConnectedApp, connectedAppsPage } from "~/server/auth/connected-apps.server"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { ConnectorAddressCard } from "~/ui/connector/ConnectorAddressCard"
import { USE_WITH_AI_PATH } from "~/ui/connector/connector"
import { SettingsPage } from "~/ui/settings/SettingsPage"
import { Spinner } from "~/ui/wait/Spinner"

export const meta: MetaFunction = () => [{ title: "Connected apps | GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const apps = await connectedAppsPage(request)
	// "Last used 2 hours ago" is counted from the server's clock, so the browser renders the same words.
	return json({ apps, now: Date.now() }, { headers: { "Cache-Control": "private, no-store" } })
}

export default function ConnectedApps() {
	const { apps, now } = useLoaderData<typeof loader>()
	const [removed, setRemoved] = useState<string | null>(null)
	return (
		<SettingsPage title="Connected apps" intro="Assistants that can reach your GoodWatch. Disconnecting stops them right away; nothing you saved is lost.">
			<section className="flex flex-col gap-5 text-base">
				{removed && (
					<output className="flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-100">
						<CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" /> {removed} is disconnected. To use it again, connect it
						from {removed}.
					</output>
				)}
				{apps === null ? (
					<div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6 text-center text-sm text-gray-400">
						Connected apps arrive with GoodWatch's new sign-in.
					</div>
				) : apps.length === 0 ? (
					<div className="rounded-xl border border-gray-700 bg-gray-800/40 p-6 text-center">
						<p className="font-semibold text-gray-100">No apps connected</p>
						<p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
							Add GoodWatch to Claude or ChatGPT to log watches, rate titles and pick your next movie by chatting.
						</p>
						<Link to={USE_WITH_AI_PATH} prefetch="intent" className="mt-3 inline-block text-sm font-semibold text-amber-500 hover:text-amber-400">
							See what it looks like
						</Link>
					</div>
				) : (
					<ul className="divide-y divide-gray-800 overflow-hidden rounded-xl border border-gray-700 bg-gray-800/40">
						{apps.map((connected) => (
							<AppRow key={connected.id} connected={connected} now={now} onDisconnected={() => setRemoved(connected.app.name)} />
						))}
					</ul>
				)}
				<ConnectorAddressCard />
			</section>
		</SettingsPage>
	)
}

function AppRow({ connected, now, onDisconnected }: { connected: ConnectedApp; now: number; onDisconnected: () => void }) {
	const { app } = connected
	const revalidator = useRevalidator()
	const [confirming, setConfirming] = useState(false)
	const [busy, setBusy] = useState(false)
	const [failed, setFailed] = useState(false)
	const onComputer = app.returnsTo === "this computer"
	const disconnect = async () => {
		setBusy(true)
		setFailed(false)
		try {
			const response = await fetch("/api/auth/oauth2/delete-consent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: connected.id }),
				credentials: "same-origin",
			})
			if (!response.ok) throw new Error(String(response.status))
			onDisconnected()
			revalidator.revalidate()
		} catch {
			setFailed(true)
			setBusy(false)
		}
	}
	return (
		<li className="p-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3">
				<ConnectAppBadge app={app} />
				<div className="min-w-0 flex-1 basis-48">
					<p className="font-semibold text-gray-100">
						{app.name}
						{onComputer && <span className="ml-2 text-sm font-normal text-gray-500">On a computer</span>}
						{!app.verified && (
							<span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-950 px-2 py-0.5 align-middle text-xs font-medium text-amber-200 ring-1 ring-amber-800">
								<ExclamationTriangleIcon className="h-3 w-3" aria-hidden="true" /> Unverified
							</span>
						)}
					</p>
					<p className={`text-sm ${connected.canChange ? "text-amber-300" : "text-sky-300"}`}>
						{connected.canChange ? "Can see and change" : "Can see only"}
					</p>
					<p className="text-sm text-gray-500">
						Connected {formatDay(connected.connectedAt)} · {connected.lastUsedAt ? `Last used ${ago(connected.lastUsedAt, now)}` : "Not used yet"}
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
					<p className="min-w-0 flex-1 basis-56 text-sm text-red-100">
						{failed
							? "That didn't work. Try again in a moment."
							: `Disconnect ${app.name}${onComputer ? " on that computer" : ""}? It stops working with GoodWatch right away.`}
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={() => setConfirming(false)}
							disabled={busy}
							className="cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={disconnect}
							disabled={busy}
							className="flex min-w-28 cursor-pointer items-center justify-center rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600"
						>
							{busy ? <Spinner size="small" /> : "Disconnect"}
						</button>
					</div>
				</div>
			)}
		</li>
	)
}

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
function formatDay(iso: string) {
	return DAY.format(new Date(iso))
}

function ago(iso: string, now: number) {
	const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
	if (minutes < 2) return "just now"
	if (minutes < 60) return `${minutes} minutes ago`
	const hours = Math.round(minutes / 60)
	if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`
	const days = Math.round(hours / 24)
	if (days === 1) return "yesterday"
	if (days < 60) return `${days} days ago`
	return `on ${formatDay(iso)}`
}
