// PROTOTYPE - throwaway (#489, prototype C). The prototype's own controls for /prototype/new-on-services, in white
// with a fuchsia ring so that nobody takes them for part of a design: who looks, how much arrived, and the state
// panel, which also shows the page as a search result (address, title, description). The pill that switches the
// variation is the shared ui/prototype/PrototypeSwitcher.
import { useState } from "react"
import type { PageProps } from "./bits"
import {
	CASES,
	type DataCase,
	MEMBER,
	VIEWERS,
	type Viewer,
	dayName,
	groupBy,
	serviceNames,
	wantedOf,
} from "./model"

const white =
	"h-9 max-w-[44vw] cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-black"

export function Controls({
	page,
	variant,
	hidden,
}: { page: PageProps; variant: string; hidden: boolean }) {
	const { choice, set } = page
	const [state, setState] = useState(false)
	if (process.env.NODE_ENV === "production") return null
	if (hidden)
		return (
			<button
				type="button"
				onClick={() => set({ chrome: "" })}
				aria-label="Show the prototype controls"
				data-chrome
				className="fixed bottom-[84px] left-2 z-[1050] h-6 w-6 cursor-pointer rounded-full bg-white text-[10px] font-black text-fuchsia-600 opacity-60 ring-2 ring-fuchsia-500 lg:bottom-3"
			>
				P
			</button>
		)
	return (
		<div
			className="fixed inset-x-2 bottom-[136px] z-[1050] flex flex-col items-start gap-1.5 lg:inset-x-auto lg:bottom-4 lg:left-4"
			data-chrome
		>
			{state && <StatePanel page={page} variant={variant} />}
			<div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/95 p-1 shadow-2xl ring-2 ring-fuchsia-500">
				<select
					aria-label="Who looks"
					value={choice.viewer}
					onChange={(e) =>
						set({ viewer: e.target.value, services: "", country: "" })
					}
					data-viewer
					className={white}
				>
					{Object.entries(VIEWERS).map(([key, name]) => (
						<option key={key} value={key}>
							{name}
						</option>
					))}
				</select>
				<select
					aria-label="How much arrived"
					value={choice.data}
					onChange={(e) => set({ data: e.target.value })}
					data-case
					className={white}
				>
					{Object.entries(CASES).map(([key, name]) => (
						<option key={key} value={key}>
							{name}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={() => setState((s) => !s)}
					className={`${white} ${state ? "!bg-fuchsia-200" : ""}`}
					data-state-toggle
				>
					State
				</button>
				<button
					type="button"
					onClick={() => set({ chrome: "off" })}
					className={white}
					title="Hide these controls"
				>
					Hide
				</button>
			</div>
		</div>
	)
}

/** The full state on every switch, and the page as a search result. */
function StatePanel({ page, variant }: { page: PageProps; variant: string }) {
	const { choice, everything, seo } = page
	const wanted = wantedOf(everything)
	return (
		<div
			className="max-h-[60vh] w-[min(94vw,44rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500"
			data-state
		>
			<p>
				<b>Variation:</b> {variant} · <b>viewer:</b>{" "}
				{VIEWERS[choice.viewer as Viewer]} · <b>data:</b>{" "}
				{CASES[choice.data as DataCase]}
			</p>
			<p className="mt-1">
				<b>Country:</b> {choice.country} · <b>services:</b>{" "}
				{serviceNames(choice.services)}
				{choice.saved ? " (the member's saved ones)" : ""} · <b>kind:</b>{" "}
				{choice.kind}
			</p>
			{choice.viewer !== "visitor" && (
				<p className="mt-1">
					<b>The member saved:</b> {serviceNames(MEMBER.services)} in{" "}
					{MEMBER.country} · <b>waits for:</b>{" "}
					{choice.viewer === "member"
						? `${Object.keys(MEMBER.wants).length} titles of this list`
						: "nothing of this list"}
				</p>
			)}
			<p className="mt-1">
				<b>Arrived:</b> {everything.length} titles ·{" "}
				{groupBy(everything, (a) => a.days)
					.map(([days, list]) => `${dayName(days)}: ${list.length}`)
					.join(", ") || "none"}
			</p>
			<p className="mt-1">
				<b>Wanted, day exact:</b>{" "}
				{wanted
					.map(
						(a) =>
							`${a.title} (${a.days} d${a.want?.episode ? `, ${a.want.episode}` : ""})`,
					)
					.join(", ") || "none"}
			</p>
			<div className="mt-2 rounded-lg border border-black/15 p-2" data-seo>
				<p className="font-mono text-[11px] text-green-800">
					goodwatch.app{seo.address}
				</p>
				<p className="text-sm font-semibold text-blue-800">{seo.title}</p>
				<p className="text-neutral-700">{seo.description}</p>
				<p className="mt-1 text-neutral-500">
					<b>Heading:</b> {seo.heading} · <b>Listed by search engines:</b>{" "}
					{seo.indexed}
				</p>
				<p className="text-neutral-500">
					<b>Og image:</b> {seo.ogImage}
				</p>
			</div>
		</div>
	)
}
