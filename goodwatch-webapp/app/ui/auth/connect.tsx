// What the account pages show while an app such as Claude waits for the member (#534, #570): a note above the form and,
// from lg up, the picture column says what is about to be connected.
import type { ConsentApp } from "~/utils/mcp-connect"
import { AppBadge } from "~/ui/connector/AppBadge"

export function ConnectAppBadge({ app, size = "md" }: { app: ConsentApp; size?: "sm" | "md" | "lg" }) {
	const dims = { sm: "h-9 w-9 text-sm rounded-xl", md: "h-12 w-12 text-lg rounded-2xl", lg: "h-16 w-16 text-2xl rounded-2xl" }[size]
	if (app.kind)
		return (
			<span className={`inline-flex ${size === "lg" ? "scale-[1.33]" : ""}`}>
				<AppBadge app={app.kind} size={size === "sm" ? "sm" : "md"} />
			</span>
		)
	return (
		<span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center bg-gray-700 font-bold text-gray-200 ${dims}`}>
			{app.name.slice(0, 1).toUpperCase()}
		</span>
	)
}

export function GoodWatchBadge({ size = "md" }: { size?: "md" | "lg" }) {
	const dims = size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg"
	return (
		<span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-gray-950 font-black text-amber-400 ring-1 ring-amber-500/40 ${dims}`}>
			GW
		</span>
	)
}

export function ConnectNote({ app }: { app: ConsentApp }) {
	return (
		<div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/70 p-3 text-sm text-gray-200">
			<ConnectAppBadge app={app} size="sm" />
			<p>
				Sign in to connect <strong className="text-white">{app.name}</strong> to your GoodWatch. You'll see what it can do
				on the next page.
			</p>
		</div>
	)
}

// The picture column while an app waits: what is about to be connected, instead of the slogan.
export function ConnectAside({ app }: { app: ConsentApp }) {
	return (
		<div className="max-w-md p-8 text-center text-white">
			<div className="mb-8 flex items-center justify-center gap-6">
				<ConnectAppBadge app={app} size="lg" />
				<span className="text-3xl text-gray-300" aria-hidden="true">
					⇄
				</span>
				<GoodWatchBadge size="lg" />
			</div>
			<h2 className="mb-4 text-4xl font-bold">Connect {app.name}</h2>
			<p className="text-xl text-gray-200">Log watches, rate titles and pick your next movie by chatting with {app.name}.</p>
		</div>
	)
}
