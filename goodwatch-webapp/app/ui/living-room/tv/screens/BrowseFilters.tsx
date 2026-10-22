import {
	Frame,
	Item,
	PageArrow,
	PageCount,
	keySize,
	phoneSpan,
	useListAnchor,
	usePage,
	useTvView,
} from "../kit"
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
	const ids = [...BROWSE_KEYS.map((key) => `filter:${key}`), "browse:reset"]
	// The phone (nothing scrolls): Done and the page's arrows over four filters, two by two. Each says its name over
	// its value, so neither is cut.
	// Four a page, two by two, upright; six, three by two, on a phone's wide canvas.
	const wide = phoneSpan(canvas) >= 600
	const page = usePage(ids, wide ? 6 : 4, useListAnchor("filters", ids))
	if (P) {
		const key = keySize(canvas, 54)
		return (
			<Frame name="Filters & sorting" items={items} dim={0.88}>
				<div className="flex h-full flex-col gap-[4px]">
					<div className="flex shrink-0 items-center gap-2" style={{ height: key }}>
						<Item id="browse:done" className="tvc-btn tvc-watch flex h-full items-center px-6 text-[20px]">
							Done
						</Item>
						<span className="min-w-0 flex-1 text-[17px] leading-tight text-white/70">
							A press changes one. Done applies.
						</span>
						<PageArrow to={page.prev} dir="prev" label="Previous filters" />
						<PageCount page={page.page} pages={page.pages} />
						<PageArrow to={page.next} dir="next" label="More filters" />
					</div>
					<div className={`grid min-h-0 flex-1 grid-rows-2 gap-x-[6px] gap-y-[4px] ${wide ? "grid-cols-3" : "grid-cols-2"}`}>
						{page.shown.map((id) => {
							const k = id.slice("filter:".length)
							const [name, value] =
								id === "browse:reset" ? ["Filters", "Reset all"] : label(k).split(": ")
							return (
								<Item
									key={id}
									id={id}
									label={`${name}: ${value}`}
									className="tvc-btn flex h-full flex-col justify-center rounded-[18px] px-4 text-left leading-tight"
								>
									<span className="text-[16px] font-semibold opacity-70">{name}</span>
									<span className="text-[19px]">{value}</span>
								</Item>
							)
						})}
					</div>
				</div>
			</Frame>
		)
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
