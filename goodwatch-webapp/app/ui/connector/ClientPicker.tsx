// The app picker on /connect: one tile per app, and the selected app's guide below. The address bar keeps the app
// (/connect#cursor), so a link can open a guide directly; old links to #claude, #claude-code and #chatgpt still work.
import { type KeyboardEvent, useEffect, useRef, useState } from "react"
import { AppBadge, type AppKey } from "~/ui/connector/AppBadge"
import {
	CHECKED_ON,
	CLIENTS,
	type Client,
	ExternalLink,
} from "~/ui/connector/ClientGuides"
import { StatusTag } from "~/ui/connector/help-parts"

const isClient = (key: string): key is AppKey =>
	CLIENTS.some((client) => client.key === key)

export function ClientPicker() {
	const [selected, setSelected] = useState<AppKey>(CLIENTS[0].key)
	const tabs = useRef<Partial<Record<AppKey, HTMLButtonElement | null>>>({})
	const panel = useRef<HTMLDivElement>(null)

	// Opened with #cursor (or the hash changed later): show that guide and bring it into view.
	useEffect(() => {
		const fromHash = () => {
			const key = window.location.hash.slice(1)
			if (!isClient(key)) return
			setSelected(key)
			requestAnimationFrame(() =>
				panel.current?.scrollIntoView({ block: "start" }),
			)
		}
		fromHash()
		window.addEventListener("hashchange", fromHash)
		return () => window.removeEventListener("hashchange", fromHash)
	}, [])

	const select = (key: AppKey) => {
		setSelected(key)
		// Replace, not push: the back button leaves the page instead of stepping through apps.
		window.history.replaceState(window.history.state, "", `#${key}`)
	}

	// Arrow keys move along the tiles, as in any tab list.
	const onKeyDown = (event: KeyboardEvent, index: number) => {
		const step =
			event.key === "ArrowRight" || event.key === "ArrowDown"
				? 1
				: event.key === "ArrowLeft" || event.key === "ArrowUp"
					? -1
					: 0
		const to =
			event.key === "Home"
				? 0
				: event.key === "End"
					? CLIENTS.length - 1
					: step
						? (index + step + CLIENTS.length) % CLIENTS.length
						: null
		if (to === null) return
		event.preventDefault()
		const key = CLIENTS[to].key
		select(key)
		tabs.current[key]?.focus()
	}

	const client = CLIENTS.find(({ key }) => key === selected) ?? CLIENTS[0]

	return (
		<div className="flex flex-col gap-6">
			<div
				role="tablist"
				aria-label="Pick your app"
				className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3"
			>
				{CLIENTS.map((item, index) => {
					const on = item.key === selected
					return (
						<button
							key={item.key}
							ref={(node) => {
								tabs.current[item.key] = node
							}}
							type="button"
							role="tab"
							id={`tab-${item.key}`}
							aria-selected={on}
							aria-controls={`guide-${item.key}`}
							tabIndex={on ? 0 : -1}
							onClick={() => select(item.key)}
							onKeyDown={(event) => onKeyDown(event, index)}
							className={`flex cursor-pointer items-center gap-3 rounded-2xl p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:p-4 ${
								on
									? "bg-amber-950/40 ring-2 ring-amber-500"
									: "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.07]"
							}`}
						>
							<AppBadge app={item.key} size="sm" />
							<span className="min-w-0">
								<span
									className={`block font-semibold leading-tight ${on ? "text-white" : "text-gray-100"}`}
								>
									{item.name}
								</span>
								<span className="block truncate text-xs text-gray-400 sm:text-sm">
									{item.how}
								</span>
							</span>
						</button>
					)
				})}
			</div>

			<div
				ref={panel}
				className="scroll-mt-24 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-6"
			>
				{CLIENTS.map((item) => (
					<Guide key={item.key} client={item} hidden={item !== client} />
				))}
			</div>
		</div>
	)
}

function Guide({ client, hidden }: { client: Client; hidden: boolean }) {
	const { Guide: Steps } = client
	return (
		<section
			id={`guide-${client.key}`}
			role="tabpanel"
			aria-labelledby={`tab-${client.key}`}
			hidden={hidden}
			className="flex flex-col gap-5"
		>
			{/* The anchor old links point at (#claude, #chatgpt, #claude-code). */}
			<span id={client.key} className="sr-only" />
			<div className="flex items-start gap-4">
				<AppBadge app={client.key} />
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h3 className="text-2xl font-bold tracking-tight text-white">
							{client.name}
						</h3>
						<StatusTag status={client.status} />
					</div>
					<p className="mt-1 text-sm text-gray-400">{client.statusNote}</p>
				</div>
			</div>
			<Steps />
			<div className="flex flex-col gap-1 border-t border-white/10 pt-4 text-sm text-gray-400">
				<p>
					<span className="font-semibold text-gray-300">Who can use it: </span>
					{client.plans} Checked {CHECKED_ON}.
				</p>
				<p>
					Menus look different?{" "}
					<ExternalLink
						href={client.help}
					>{`${client.name}'s own help`}</ExternalLink>
				</p>
			</div>
		</section>
	)
}
