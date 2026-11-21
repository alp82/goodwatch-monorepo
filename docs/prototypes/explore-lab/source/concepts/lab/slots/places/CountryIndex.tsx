// PROTOTYPE - throwaway (prototype/explore-r7, slot "places"). Every country with a page, findable without a wall:
// a search box and a row of regions (Europe, Africa, South America, ...), then the countries as flag-filled shapes.
// The page owns the query and the region, so the map can follow both (a region flies the map there; a search quiets
// the countries it leaves out).
import { Link } from "@remix-run/react"
import { FOCUS } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import { FlagShape } from "../../../../kit/world-map/FlagShape"
import { REGIONS, type RegionId, regionOf } from "./geo"

export interface IndexCountry {
	code: string
	name: string
	href: string
	/** One line about it, if the kit has one. */
	line?: string | null
}

/** Folds case and accents, so "cote" finds Côte d'Ivoire. */
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export const matches = (c: IndexCountry, query: string) => {
	const q = fold(query.trim())
	return !q || fold(c.name).includes(q) || c.code.toLowerCase() === q
}

export function CountryIndex({
	countries,
	query,
	onQuery,
	region,
	onRegion,
	hot,
	onHot,
	title = "Every country",
}: {
	countries: readonly IndexCountry[]
	query: string
	onQuery: (q: string) => void
	region: RegionId | null
	onRegion: (r: RegionId | null) => void
	hot: string | null
	onHot: (code: string | null) => void
	title?: string
}) {
	const counts = new Map<RegionId, number>()
	for (const c of countries) counts.set(regionOf(c.code), (counts.get(regionOf(c.code)) ?? 0) + 1)
	const shown = countries.filter(
		(c) => matches(c, query) && (query.trim() || !region || regionOf(c.code) === region),
	)
	// Without a search or a region: grouped under their regions, so the list reads like an atlas's index.
	const grouped = !query.trim() && !region
	const groups = grouped
		? REGIONS.map((r) => ({ r, list: shown.filter((c) => regionOf(c.code) === r.id) })).filter(
				(g) => g.list.length > 0,
			)
		: [{ r: null, list: shown }]

	return (
		<section aria-label={title} className="space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
				<h2 className="font-display text-2xl font-bold tracking-tight text-white">
					{title}
					<span className="ml-2 align-middle text-sm font-semibold text-gray-500 tabular-nums">
						{countries.length}
					</span>
				</h2>
				<label className="relative block w-full sm:w-72">
					<span className="sr-only">Find a country</span>
					<svg
						aria-hidden
						viewBox="0 0 16 16"
						className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500"
						fill="none"
						stroke="currentColor"
						strokeWidth={1.8}
						strokeLinecap="round"
					>
						<circle cx="7" cy="7" r="4.5" />
						<path d="m10.5 10.5 3 3" />
					</svg>
					<input
						type="search"
						value={query}
						onChange={(e) => onQuery(e.currentTarget.value)}
						placeholder="Find a country"
						className={`w-full rounded-full bg-white/[0.06] py-2 pr-3 pl-9 text-sm text-white ring-1 ring-white/10 placeholder:text-gray-500 hover:ring-white/20 focus:bg-white/[0.08] focus:ring-amber-400/70 focus:outline-none ${QUICK_T}`}
					/>
				</label>
			</div>
			<div
				role="radiogroup"
				aria-label="Region"
				className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
			>
				{[{ id: null, label: "Everywhere" }, ...REGIONS].map((r) => {
					const n = r.id ? (counts.get(r.id) ?? 0) : countries.length
					if (r.id && !n) return null
					const on = region === r.id && !query.trim()
					return (
						<button
							key={r.id ?? "all"}
							type="button"
							// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the ARIA radio pattern on styled buttons
							role="radio"
							aria-checked={on}
							onClick={() => {
								onQuery("")
								onRegion(r.id)
							}}
							className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold whitespace-nowrap ring-1 ${QUICK_T} ${FOCUS} ${
								on
									? "bg-white text-gray-950 ring-white"
									: "bg-white/[0.04] text-gray-300 ring-white/10 hover:bg-white/[0.08] hover:text-white"
							}`}
						>
							{r.label}
							<span className={`ml-1.5 tabular-nums ${on ? "text-gray-500" : "text-gray-500"}`}>
								{n}
							</span>
						</button>
					)
				})}
			</div>
			{shown.length === 0 ? (
				<p className="py-6 text-sm text-gray-400">
					No country with enough titles matches “{query.trim()}”.
				</p>
			) : (
				<div className="space-y-6">
					{groups.map(({ r, list }) => (
						<div key={r?.id ?? "list"}>
							{r && (
								<h3 className="mb-1 border-b border-white/[0.08] pb-1.5 text-xs font-bold tracking-[0.14em] text-gray-500 uppercase">
									{r.label}
								</h3>
							)}
							<ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
								{list.map((c) => (
									<li key={c.code}>
										<Link
											to={c.href}
											prefetch="intent"
											onPointerEnter={(e) => e.pointerType === "mouse" && onHot(c.code)}
											onPointerLeave={(e) => e.pointerType === "mouse" && onHot(null)}
											onFocus={() => onHot(c.code)}
											onBlur={() => onHot(null)}
											className={`group flex items-center gap-3 rounded-lg px-1.5 py-2 ${QUICK_T} ${FOCUS} ${
												hot === c.code ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
											}`}
										>
											<span className="grid h-8 w-9 shrink-0 place-items-center">
												<FlagShape code={c.code} size={30} state={hot === c.code ? "on" : "hint"} />
											</span>
											<span className="min-w-0">
												<span className="block truncate text-[15px] font-semibold text-gray-200 group-hover:text-white">
													{c.name}
												</span>
												{c.line && (
													<span className="block truncate text-[12px] text-gray-500">{c.line}</span>
												)}
											</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			)}
		</section>
	)
}
