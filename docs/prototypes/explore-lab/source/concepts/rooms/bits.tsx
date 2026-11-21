// PROTOTYPE - throwaway (prototype/explore-r7, concept rooms). Two small pieces of a room page.
import { Link } from "@remix-run/react"
import { poster } from "../../kit/ui"
import { QUICK_T } from "../../kit/ui/motion"

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"

/**
 * The trail to this page as structured data only. The rooms row already shows where you are, so the owner found the
 * visible crumbs unnecessary; search engines still get the trail.
 */
export function CrumbsData({ items }: { items: { label: string; to?: string }[] }) {
	const json = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((c, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: c.label,
			...(c.to ? { item: c.to } : {}),
		})),
	}
	return (
		<script
			type="application/ld+json"
			// oxlint-disable-next-line react/no-danger -- structured data, built from our own labels (< escaped)
			dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }}
		/>
	)
}

/**
 * A service's way to this week's arrivals, as a full-width row that teases them: the arrivals' posters fanned out on
 * the right (they spread a little on hover), the way in on the left. Without known arrivals it is the same row with
 * the service's logo.
 */
export function ArrivalsRow({
	href,
	name,
	logo,
	fresh,
	arrivals,
}: {
	href: string
	name: string
	logo?: string | null
	/** "week": this week's arrivals; "newest": no arrivals known, so the service's newest well-known titles. */
	fresh: "week" | "newest"
	arrivals: { key: string; title: string; poster_path: string | null }[]
}) {
	const shown = arrivals.filter((a) => a.poster_path).slice(0, 7)
	const lead = shown.slice(0, 3).map((a) => a.title)
	return (
		<Link
			to={href}
			prefetch="intent"
			className={`group relative flex min-h-[11rem] items-center overflow-hidden rounded-3xl bg-gradient-to-r from-[#1b2233] via-[#161c2a] to-[#121826] ring-1 ring-white/10 hover:ring-white/25 ${QUICK_T} ${FOCUS}`}
		>
			<span className="relative z-10 flex max-w-xl flex-col gap-2 px-6 py-6 sm:px-8">
				<span className="text-xs font-bold tracking-[0.14em] text-amber-300 uppercase">
					{fresh === "week" ? "New this week" : `Fresh on ${name}`}
				</span>
				<span className="font-display text-2xl leading-tight font-bold tracking-tight text-white sm:text-3xl">
					{fresh === "week" ? `What just landed on ${name}` : `What's new on ${name}`}
				</span>
				<span className="text-[15px] text-gray-300">
					{lead.length
						? `${fresh === "week" ? "" : "Lately: "}${lead.join(", ")}${arrivals.length > lead.length ? ", and more." : "."}`
						: "Every title that arrived this week, best first."}
				</span>
				<span className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-amber-300 group-hover:text-amber-200">
					{`See what's new on ${name}`}
					<span aria-hidden className={`group-hover:translate-x-0.5 ${QUICK_T}`}>
						›
					</span>
				</span>
			</span>
			<span
				aria-hidden
				className="pointer-events-none absolute inset-y-0 right-0 hidden w-[55%] sm:block"
			>
				{shown.length > 0 ? (
					shown.map((a, i) => (
						<img
							key={a.key}
							src={poster(a.poster_path ?? "", "w185")}
							alt=""
							loading="lazy"
							decoding="async"
							className="absolute top-1/2 h-40 w-[6.75rem] rounded-lg object-cover shadow-2xl ring-1 shadow-black/60 ring-black/40 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
							style={{
								right: `${1.5 + i * 4.2}rem`,
								zIndex: 10 - i,
								transform: `translateY(-50%) rotate(${(i % 2 ? -1 : 1) * (2 + i)}deg)`,
								["--spread" as string]: `${i * 0.6}rem`,
							}}
						/>
					))
				) : logo ? (
					<img
						src={poster(logo, "w154")}
						alt=""
						className="absolute top-1/2 right-10 h-24 w-24 -translate-y-1/2 rounded-3xl opacity-80 ring-1 ring-white/10"
					/>
				) : null}
				<span className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#171d2b] to-transparent" />
			</span>
		</Link>
	)
}
