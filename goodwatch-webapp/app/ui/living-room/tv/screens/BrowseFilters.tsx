import { Frame, Item, keySize, useTvView } from "../kit"
import { BROWSE_KEYS, bestMatchActive, browseQuery } from "../tv-browse"
import { discoverOptions } from "../tv-discover"
import type { TvScreen } from "../tv-machine"

/** Interaction-only filter step. Each button cycles a short, named list; Done applies it. */
export default function BrowseFilters({
	screen,
	items,
	summary,
	controls,
	hasTaste = false,
}: {
	screen: Extract<TvScreen, { name: "discover" | "search" }>
	items: readonly string[]
	summary?: string
	controls?: Record<string, string>
	hasTaste?: boolean
}) {
	const { canvas } = useTvView(),
		P = canvas.edition === "phone"
	const params = new URLSearchParams(browseQuery(screen))
	const words: Record<string, Record<string, string>> = {
		type: { all: "Movies & shows", movie: "Movies", show: "Shows" },
		services: { mine: "On my services", all: "Everywhere" },
		unseen: { "1": "Not seen yet", "0": "Include seen" },
		sort: {
			popular: "Popular",
			top: "Top rated",
			newest: "Newest",
			relevance: "Relevance",
			match: "Best match",
		},
		foryou: { "1": "On", "0": "Off" },
	}
	const names: Record<string, string> = {
		type: "Type",
		services: "Services",
		unseen: "Seen",
		sort: "Sort",
		foryou: "For you",
		moods: "Mood",
		themes: "Theme",
		styles: "Style",
	}
	for (const tab of ["moods", "themes", "styles"] as const)
		words[tab] = Object.fromEntries(
			discoverOptions(tab).map((o) => [o.key, o.name]),
		)
	const label = (key: string) => {
		const v =
			key === "foryou" && bestMatchActive(params, controls, hasTaste)
				? "1"
				: (params.get(key) ?? controls?.[key] ?? null)
		if (v === null && ["services", "unseen", "foryou"].includes(key))
			return `${names[key]}: Default`
		const value =
			v ??
			(key === "sort"
				? screen.name === "search"
					? "relevance"
					: "popular"
				: key === "type"
					? "all"
					: "")
		return `${names[key]}: ${words[key]?.[value] ?? "Any"}`
	}
	return (
		<Frame name="Filters & sorting" items={items} dim={0.88}>
			<div className="flex h-full min-h-0 flex-col gap-3">
				<div className="flex shrink-0 items-center gap-4">
					<Item
						id="browse:done"
						className="tvc-btn px-6 text-[24px]"
						style={{ height: keySize(canvas, 56) }}
					>
						Done
					</Item>
					<p
						className={`${P ? "text-[18px]" : "text-[22px]"} leading-tight text-white/75`}
					>
						Press to change. Done applies.
						<br />
						For you blends taste into the selected sort.
					</p>
				</div>
				<div
					data-tv-scroll
					className={`grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-2 ${P ? "grid-cols-2" : "grid-cols-3"}`}
				>
					{BROWSE_KEYS.map((key) => (
						<Item
							key={key}
							id={`filter:${key}`}
							className="tvc-btn px-4 text-left text-[23px] leading-tight"
							style={{ minHeight: keySize(canvas, 68) }}
						>
							{label(key)}
						</Item>
					))}
					<Item
						id="browse:reset"
						className="tvc-btn px-4 text-[23px]"
						style={{ minHeight: keySize(canvas, 68) }}
					>
						Reset filters
					</Item>
				</div>
			</div>
		</Frame>
	)
}
