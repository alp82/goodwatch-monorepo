// PROTOTYPE - throwaway (#625). The prototype's own controls for /prototype/arrival-dates, in white with a fuchsia
// ring so that nobody takes them for part of a design: who looks, the data case, the country, the service, and the
// state panel. The state panel shows how each service is checked under the variation's data option, every title's
// real day next to what the page says, and the page as a search result. Adapted from prototype C's chrome.tsx.
import { useState } from "react"
import type { PageProps } from "./bits"
import {
	CASES,
	COUNTRIES,
	DATA_OPTIONS,
	MEMBER,
	SERVICES,
	VARIANTS,
	VIEWERS,
	cadenceOf,
	isMember,
	modeOf,
	serviceNames,
	whenStamp,
} from "./model"

const white =
	"h-9 max-w-[44vw] cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-black"

export function Controls({
	page,
	hidden,
}: { page: PageProps; hidden: boolean }) {
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
	const one = choice.services.length === 1 ? choice.services[0] : ""
	return (
		<div
			className="fixed inset-x-2 bottom-[136px] z-[1050] flex flex-col items-start gap-1.5 lg:inset-x-auto lg:bottom-20 lg:left-4"
			data-chrome
		>
			{state && <StatePanel page={page} />}
			<div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white/95 p-1 shadow-2xl ring-2 ring-fuchsia-500">
				<select
					aria-label="Who looks"
					value={choice.viewer}
					onChange={(e) =>
						set({
							viewer: e.target.value,
							services: "",
							service: "",
							country: "",
						})
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
					aria-label="Data case"
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
				<select
					aria-label="Country"
					value={choice.country}
					onChange={(e) => set({ country: e.target.value })}
					data-country
					className={white}
				>
					{Object.entries(COUNTRIES).map(([key, country]) => (
						<option key={key} value={key}>
							{country.name}
						</option>
					))}
				</select>
				<select
					aria-label="Service"
					value={one}
					onChange={(e) => set({ services: e.target.value, service: "" })}
					data-service-choice
					className={white}
				>
					<option value="">
						{isMember(choice.viewer) ? "Saved services" : "Every service"}
					</option>
					{COUNTRIES[choice.country].services.map((key) => (
						<option key={key} value={key}>
							{SERVICES[key].name}
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
function StatePanel({ page }: { page: PageProps }) {
	const { choice, arrivals, seo } = page
	const cadences = choice.services.map(
		(s) =>
			`${SERVICES[s].name}: ${cadenceOf(choice.variant, choice.country, s)}`,
	)
	return (
		<div
			className="max-h-[60vh] w-[min(94vw,44rem)] overflow-auto rounded-xl bg-white p-3 text-xs text-black shadow-2xl ring-2 ring-fuchsia-500"
			data-state
		>
			<p>
				<b>Variation:</b> {choice.variant} ({VARIANTS[choice.variant]}) ·{" "}
				<b>data option:</b> {DATA_OPTIONS[choice.variant]} · <b>page mode:</b>{" "}
				{modeOf(choice)}
			</p>
			<p className="mt-1">
				<b>Viewer:</b> {VIEWERS[choice.viewer]} · <b>case:</b>{" "}
				{CASES[choice.data]} · <b>country:</b> {choice.country} ·{" "}
				<b>services:</b> {serviceNames(choice.services)}
				{choice.saved ? " (the member's saved ones)" : ""}
			</p>
			<p className="mt-1">
				<b>How each service is checked:</b> {cadences.join(", ")}
			</p>
			{choice.viewer !== "visitor" && (
				<p className="mt-1">
					<b>The member saved:</b> {serviceNames(MEMBER.services)} in{" "}
					{MEMBER.country} · <b>waits for:</b>{" "}
					{choice.viewer === "member"
						? `${Object.keys(MEMBER.wants).length} titles, checked daily`
						: "nothing of this list"}
				</p>
			)}
			<p className="mt-1">
				<b>Listed ({arrivals.length}), real day → what the page says:</b>{" "}
				{arrivals
					.map(
						(a) =>
							`${a.title} (${a.days} d → ${whenStamp(a.when) || "no day"}${a.want ? ", wanted" : ""})`,
					)
					.join("; ") || "none"}
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
