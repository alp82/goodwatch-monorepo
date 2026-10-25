// A pick in the quick view (ui/quick-view): the picks in their order, "#3 for you", the loved title or the steer the
// pick answers, its reason chips, and what the details query adds (backdrop, runtime, services, story). Its code
// loads on first use (LazyQuickView in ForYouPage.tsx); the neighbours' images are decoded ahead.
import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo } from "react"
import type { ForYouDetail } from "~/domain/for-you-page/contract"
import type { Ranked } from "~/domain/for-you-page/rank"
import { QuickView } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import {
	type PoolTitle,
	detailQuery,
	posterSrc,
	titleAt,
	useForYou,
} from "./context"

/** One title's detail from the details query; undefined while it loads or after it failed. */
function useDetail(key: string): ForYouDetail | null | undefined {
	const { loadDetail } = useForYou()
	return useQuery(detailQuery(key, loadDetail)).data
}

const metaOf = (t: PoolTitle, runtime: number | null | undefined) =>
	[
		t.year,
		t.kind === "show" ? "Show" : "Movie",
		t.kind === "movie" && runtime ? `${runtime} min` : null,
	]
		.filter(Boolean)
		.join(" · ")

/** A loved title that carries one of the pick's reasons ("Because you loved X"). */
function useLoved(r: Ranked) {
	const { taste, attr } = useForYou()
	return useMemo(() => {
		for (const reason of r.reasons) {
			const best = (attr(reason.key)?.carriers ?? [])
				.map((k) => taste.loved[k])
				.filter((s) => s && s.score >= 8)
				.sort((a, b) => b.score - a.score)[0]
			if (best) return best
		}
		return undefined
	}, [r, taste.loved, attr])
}

const decoded = new Set<string>()
/** Fetches and decodes images ahead, once each. */
function preload(urls: (string | undefined)[]) {
	for (const url of urls) {
		if (!url || decoded.has(url)) continue
		decoded.add(url)
		const img = new Image()
		img.decoding = "async"
		img.src = url
		void img.decode?.().catch(() => {})
	}
}

function PickCard({
	r,
	rank,
	answer,
}: { r: Ranked; rank: number; answer: string | null }) {
	const { pool } = useForYou()
	const t = titleAt(pool, r.index)
	const detail = useDetail(t.key)
	const loved = useLoved(r)
	const name = detail?.title || t.name
	return (
		<QuickViewCard
			title={{
				media: {
					mediaType: t.kind,
					details: {
						tmdb_id: t.tmdbId,
						title: name,
						poster_path: t.poster,
						release_year: t.year,
					},
				},
				href: t.href,
				meta: metaOf(t, detail?.runtime),
				poster: t.poster,
				backdrop: detail?.backdrop,
				goodwatch: t.score,
				eyebrow: `#${rank} for you`,
				match: pool.steps[r.index] || null,
				reason: loved ? (
					<p className="flex min-w-0 items-center gap-2.5 text-[15px] leading-snug text-gray-300">
						{loved.poster && (
							<img
								src={posterSrc(loved.poster, "w92")}
								alt=""
								className="h-8 w-[1.375rem] shrink-0 rounded-[3px] object-cover ring-1 ring-white/15"
							/>
						)}
						<span className="min-w-0 truncate">
							Because you loved{" "}
							<span className="font-bold text-white">{loved.title}</span>
						</span>
					</p>
				) : answer ? (
					<p className="truncate text-[15px] leading-snug font-semibold text-amber-300">
						{answer}
					</p>
				) : null,
				chips: r.reasons.slice(0, 3).map((x) => x.key),
				// A failed or signed-out details query shows the title without them.
				services: detail === undefined ? null : (detail?.services ?? []),
				story: detail === undefined ? undefined : (detail?.overview ?? null),
			}}
		/>
	)
}

export function ForYouQuickView({
	list,
	openId,
	onOpen,
	onClose,
	answer,
	wide,
	bottom,
	bar,
}: {
	list: Ranked[]
	openId: string
	onOpen: (r: Ranked) => void
	onClose: () => void
	answer: (r: Ranked) => string | null
	/** Desktop: the lifted card; phones: the drawer. */
	wide: boolean
	/** Phones: px from the screen's bottom to the taste bar's top; the drawer stops there. */
	bottom: number
	/** The taste bar, which stays usable below the drawer. */
	bar?: React.RefObject<HTMLElement>
}) {
	const { pool, detail } = useForYou()
	const index = list.findIndex((r) => pool.keys[r.index] === openId)
	const anchorOf = useCallback(
		(i: number) => {
			const r = list[i]
			if (!r) return null
			// The one that is laid out: a phone's strip and the desktop rows each have their own.
			const all = document.querySelectorAll<HTMLElement>(
				`[data-pop-id="${CSS.escape(pool.keys[r.index])}"]`,
			)
			return [...all].find((el) => el.getClientRects().length > 0) ?? null
		},
		[list, pool],
	)
	// The neighbours' posters and backdrops, decoded ahead.
	useEffect(() => {
		for (const n of [list[index + 1], list[index - 1]]) {
			if (!n) continue
			const t = titleAt(pool, n.index)
			const d = detail(t.key)
			preload([
				posterSrc(t.poster, "w185"),
				posterSrc(t.poster, "w500"),
				d?.backdrop
					? `https://image.tmdb.org/t/p/w780${d.backdrop}`
					: undefined,
			])
		}
	}, [index, list, pool, detail])
	// The pick left the list (the picks were steered under the drawer): the view goes with it.
	useEffect(() => {
		if (index < 0) onClose()
	}, [index, onClose])
	if (index < 0) return null
	return (
		<QuickView
			count={list.length}
			index={index}
			onIndex={(i) => onOpen(list[i])}
			onClose={onClose}
			ordered
			wide={wide}
			anchorOf={anchorOf}
			posterOf={(i) => {
				const t = titleAt(pool, list[i].index)
				return { path: t.poster, name: t.name }
			}}
			bottom={wide ? 0 : bottom}
			scope={() => [bar?.current]}
		>
			{(i) => <PickCard r={list[i]} rank={i + 1} answer={answer(list[i])} />}
		</QuickView>
	)
}
