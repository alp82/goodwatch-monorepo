import { PencilSquareIcon } from "@heroicons/react/20/solid"
import { useEffect, useMemo, useState } from "react"
// The profile's Scores tab: every score grouped by tier. The spread on top is the tier navigator: a bar jumps to its tier
// (#tier-N, also Overview's link). Movies/Shows/All and a sort apply to every tier; a large tier shows its first 24 until
// opened. The owner gets the import call to action and the way to the editable scores page; a signed-in visitor sees
// their own scores in each poster's pill and can keep to the titles both rated. The posters don't repeat the owner's
// score: their tier's heading says it.
import type { LibraryKind } from "~/domain/my-library"
import type {
	ProfileScoresPage,
	ProfileShell,
	ProfileTitle,
} from "~/domain/profile"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { scoreLabels } from "~/utils/ratings"
import { ImportCta } from "../ImportCta"
import {
	OwnerPageLink,
	ProfilePoster,
	ScoreChip,
	Segmented,
	SortSelect,
	SpreadBars,
	TILE,
	count,
} from "../parts"

type Kind = LibraryKind
const TIER_SIZES: [string | null, string][] = [
	["(min-width: 1280px)", "120px"],
	["(min-width: 768px)", "12vw"],
	["(min-width: 640px)", "16vw"],
	[null, "25vw"],
]
type Sort = "recent" | "gw" | "title"
const FIRST = 24

function sortTitles(titles: ProfileTitle[], sort: Sort) {
	const list = [...titles]
	if (sort === "gw") return list.sort((a, b) => (b.gw ?? 0) - (a.gw ?? 0))
	if (sort === "title")
		return list.sort((a, b) => a.title.localeCompare(b.title))
	return list.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
}

export function ScoresPage({
	shell,
	page,
	you,
}: {
	shell: ProfileShell
	page: ProfileScoresPage
	you: Record<string, number> | null
}) {
	const [kind, setKind] = useState<Kind>("all")
	const [sort, setSort] = useState<Sort>("recent")
	const [open, setOpen] = useState<Set<number>>(new Set())
	const [both, setBoth] = useState(false)
	const owner = shell.viewer === "owner"
	const all = useMemo(() => page.tiers.flatMap((t) => t.titles), [page.tiers])
	const movies = all.filter((t) => t.mediaType === "movie").length
	const sharedCount = you ? all.filter((t) => you[t.key] != null).length : 0
	const agree = you
		? all.filter(
				(t) =>
					you[t.key] != null &&
					Math.abs((you[t.key] ?? 0) - (t.score ?? 0)) <= 1,
			).length
		: 0

	const tiers = useMemo(
		() =>
			page.tiers
				.map((tier) => ({
					...tier,
					titles: sortTitles(
						kind === "all"
							? tier.titles
							: tier.titles.filter((t) => t.mediaType === kind),
						sort,
					).filter((t) => !both || you?.[t.key] != null),
				}))
				.filter((tier) => tier.titles.length),
		[page.tiers, kind, sort, both, you],
	)
	// Unfiltered, a tier counts all its titles, also those past the page's limit (tier.total).
	const whole = kind === "all" && !both
	const sizeOf = (tier: (typeof tiers)[number]) =>
		whole ? Math.max(tier.total ?? 0, tier.titles.length) : tier.titles.length
	const spread = useMemo(
		() =>
			Array.from({ length: 10 }, (_, i) => {
				const tier = tiers.find((t) => t.score === i + 1)
				return tier ? sizeOf(tier) : 0
			}),
		[tiers, whole],
	)
	const jump = (score: number) =>
		document
			.getElementById(`tier-${score}`)
			?.scrollIntoView({ behavior: "smooth", block: "start" })
	// Overview links to #tier-N: open there once the page is drawn.
	useEffect(() => {
		const hash = window.location.hash.slice(1)
		if (hash.startsWith("tier-"))
			document.getElementById(hash)?.scrollIntoView({ block: "start" })
	}, [])

	if (!all.length)
		return (
			<>
				<ImportCta shell={shell} what="ratings" />
				<p className={`${TILE} px-6 py-14 text-center text-gray-400`}>
					{owner
						? "No scores yet."
						: `@${shell.handle} hasn't scored anything yet.`}
				</p>
			</>
		)

	return (
		<>
			<div
				className={`${TILE} grid gap-4 p-4 pt-7 md:grid-cols-[1fr_auto] md:items-end`}
			>
				<div>
					<SpreadBars
						spread={spread}
						average={shell.counts.average}
						onPick={jump}
						height="h-16 md:h-20"
					/>
					<p className="mt-2 text-xs text-gray-500">
						Pick a bar to jump to its tier.
					</p>
				</div>
				{owner && (
					<OwnerPageLink to="/my-library/scores">
						<PencilSquareIcon className="size-4 text-amber-400" aria-hidden />
						Edit scores
					</OwnerPageLink>
				)}
			</div>
			<ImportCta shell={shell} what="ratings" />
			{you && sharedCount > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-xl bg-sky-400/[0.07] px-4 py-3 text-sm text-sky-100 ring-1 ring-sky-400/25">
					<span className="min-w-0 flex-1">
						You rated <b>{count(sharedCount)}</b> of these too, and score within
						a point of @{shell.handle} on <b>{count(agree)}</b>. Your scores
						show in each poster's pill, as{" "}
						<ScorePill
							score={8}
							mark={null}
							size="S"
							className="align-middle"
						/>
						.
					</span>
					<button
						type="button"
						aria-pressed={both}
						onClick={() => setBoth(!both)}
						className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${both ? "bg-sky-400 text-gray-950 ring-sky-400" : "text-sky-200 ring-sky-400/40 hover:bg-sky-400/10"}`}
					>
						{both
							? "Showing titles you both rated"
							: "Only titles you both rated"}
					</button>
				</div>
			)}

			<div className="sticky top-[6.5rem] z-20 -mx-4 flex flex-wrap items-center gap-3 bg-gray-950/90 px-4 py-2 sm:-mx-6 sm:px-6 md:top-28 lg:-mx-8 lg:px-8">
				<Segmented
					label="Movies or shows"
					value={kind}
					onChange={setKind}
					options={[
						["all", `All ${count(all.length)}`],
						["movie", `Movies ${count(movies)}`],
						["show", `Shows ${count(all.length - movies)}`],
					]}
				/>
				<span className="grow" />
				<SortSelect
					value={sort}
					onChange={setSort}
					options={[
						["recent", "Last watched"],
						["gw", "GoodWatch score"],
						["title", "Title"],
					]}
				/>
			</div>

			{tiers.map((tier) => {
				const opened = open.has(tier.score)
				const shown = opened ? tier.titles : tier.titles.slice(0, FIRST)
				return (
					<section
						key={tier.score}
						id={`tier-${tier.score}`}
						className="scroll-mt-44"
					>
						<h2 className="mb-3 flex items-center gap-3 border-b border-white/10 pb-2">
							<span className="flex h-10 w-10 shrink-0 scale-125 items-center justify-center">
								<ScoreChip score={tier.score} />
							</span>
							<span className={`${DISPLAY} text-2xl`}>
								{scoreLabels[tier.score]}
							</span>
							<span className="text-sm font-bold tabular-nums text-gray-500">
								{count(sizeOf(tier))}
							</span>
						</h2>
						<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
							{shown.map((title) => (
								<li key={title.key} className="min-w-0">
									<ProfilePoster title={title} sizes={TIER_SIZES} />
								</li>
							))}
						</ul>
						{opened && whole && sizeOf(tier) > tier.titles.length && (
							<p className="mt-2 text-sm text-gray-500">
								and {count(sizeOf(tier) - tier.titles.length)} more
							</p>
						)}
						{tier.titles.length > FIRST && (
							<button
								type="button"
								onClick={() =>
									setOpen((now) => {
										const next = new Set(now)
										if (opened) next.delete(tier.score)
										else next.add(tier.score)
										return next
									})
								}
								className="mt-3 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1]"
							>
								{opened
									? "Show fewer"
									: `Show all ${count(tier.titles.length)}`}
							</button>
						)}
					</section>
				)
			})}
		</>
	)
}
