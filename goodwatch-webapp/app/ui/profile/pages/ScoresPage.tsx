import { useEffect, useState } from "react"
import { useSearchParams, useRevalidator } from "@remix-run/react"
import { useInfiniteQuery } from "@tanstack/react-query"
import {
	SCORES_PAGE_SIZE,
	scoresParams,
	type ScoresChoice,
} from "~/domain/profile-scores"
import useLocale from "~/utils/locale"
// The profile's Scores tab: every score grouped by tier. The spread on top is the tier navigator: a bar jumps to its tier
// (#tier-N, also Overview's link). Movies/Shows/All and a sort apply to every tier; a large tier shows its first 24 until
// opened. The owner gets the import call to action and the way to the editable scores page; a signed-in visitor sees
// their own scores in each poster's pill and can keep to the titles both rated. The posters don't repeat the owner's
// score: their tier's heading says it. On the owner's own page the pill shows the GoodWatch score instead.
import type { ProfileScoresPage, ProfileShell } from "~/domain/profile"
import { FOLLOW_PHONE_BAR, STICKY_SUBBAR } from "~/ui/layers"
import { DISPLAY } from "~/ui/my-pages/bits"
import { ScorePill } from "~/ui/poster-card/ScorePill"
import { scoreLabels } from "~/utils/ratings"
import { ImportCta } from "../ImportCta"
import {
	ProfilePoster,
	ScoreChip,
	Segmented,
	SortSelect,
	SpreadBars,
	TILE,
	count,
} from "../parts"

const TIER_SIZES: [string | null, string][] = [
	["(min-width: 1280px)", "120px"],
	["(min-width: 768px)", "12vw"],
	["(min-width: 640px)", "16vw"],
	[null, "25vw"],
]
export function ScoresPage({
	shell,
	page,
	you,
	viewerKey,
	revision,
}: {
	shell: ProfileShell
	page: ProfileScoresPage
	you: Record<string, number> | null
	viewerKey: string | null
	revision: string
}) {
	const [params, setParams] = useSearchParams()
	const { kind, sort, both } = page.choice
	const owner = shell.viewer === "owner"
	const sharedCount = page.shared?.count ?? 0
	const agree = page.shared?.agree ?? 0
	const tiers = page.tiers
	const spread = Array.from(
		{ length: 10 },
		(_, i) => tiers.find((t) => t.score === i + 1)?.total ?? 0,
	)
	const setChoice = (patch: Partial<ScoresChoice>) => {
		const next = new URLSearchParams(params)
		for (const key of ["type", "sort", "both"]) next.delete(key)
		for (const [key, value] of scoresParams({ ...page.choice, ...patch }))
			next.set(key, value)
		setParams(next, { preventScrollReset: true })
	}
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

	if (!page.counts.all && !both)
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
			</div>
			<ImportCta shell={shell} what="ratings" />
			{you && (sharedCount > 0 || both) && (
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
						onClick={() => setChoice({ both: !both })}
						className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${both ? "bg-sky-400 text-gray-950 ring-sky-400" : "text-sky-200 ring-sky-400/40 hover:bg-sky-400/10"}`}
					>
						{both
							? "Showing titles you both rated"
							: "Only titles you both rated"}
					</button>
				</div>
			)}

			<div
				className={`sticky top-[calc(4rem_+_var(--visitor-bar-h,0px))] ${STICKY_SUBBAR} ${FOLLOW_PHONE_BAR} -mx-4 flex flex-wrap items-center gap-3 bg-gray-950/90 px-4 py-2 sm:-mx-6 sm:px-6 lg:top-28 lg:-mx-8 lg:px-8`}
			>
				<Segmented
					label="Movies or shows"
					value={kind}
					onChange={(kind) => setChoice({ kind })}
					options={[
						["all", `All ${count(page.counts.all)}`],
						["movie", `Movies ${count(page.counts.movie)}`],
						["show", `Shows ${count(page.counts.show)}`],
					]}
				/>
				<span className="grow" />
				<SortSelect
					value={sort}
					onChange={(sort) => setChoice({ sort })}
					options={[
						{ key: "recent", label: "Last watched", hint: "Most recent first" },
						{
							key: "gw",
							label: "GoodWatch score",
							hint: "Highest scored first",
						},
						{ key: "title", label: "Title", hint: "A to Z" },
					]}
				/>
			</div>

			{!tiers.length && (
				<p className="py-8 text-gray-400">No titles match these filters.</p>
			)}
			{tiers.map((tier, index) => (
				<ScoreTier
					key={`${scoresParams(page.choice)}:${tier.score}`}
					initial={tier}
					first={index === 0}
					you={you}
					shell={shell}
					choice={page.choice}
					viewerKey={viewerKey}
					revision={revision}
				/>
			))}
		</>
	)
}

function ScoreTier({
	first,
	initial,
	you,
	shell,
	choice,
	viewerKey,
	revision,
}: {
	first: boolean
	initial: ProfileScoresPage["tiers"][number]
	you: Record<string, number> | null
	shell: ProfileShell
	choice: ScoresChoice
	viewerKey: string | null
	revision: string
}) {
	const { locale } = useLocale()
	const revalidator = useRevalidator()
	const [collapsed, setCollapsed] = useState(false)
	const query = scoresParams(choice).toString()
	const result = useInfiniteQuery({
		queryKey: [
			"profile-scores",
			shell.handle,
			viewerKey,
			query,
			locale.language,
			revision,
			initial.score,
		],
		initialPageParam: 0,
		initialData: { pages: [{ tier: initial, you }], pageParams: [0] },
		queryFn: async ({ pageParam, signal }) => {
			const params = scoresParams(choice)
			params.set("tier", String(initial.score))
			params.set("offset", String(pageParam))
			params.set("revision", revision)
			params.set("displayLanguage", locale.language)
			const response = await fetch(
				`/api/profile/${encodeURIComponent(shell.handle)}/scores?${params}`,
				{ signal },
			)
			if (response.status === 409)
				throw new Error("Scores changed. Refresh scores to continue.")
			if (!response.ok)
				throw new Error("Could not load more scores. Retry to continue.")
			const data = (await response.json()) as {
				page: ProfileScoresPage
				you: Record<string, number> | null
			}
			const tier = data.page.tiers.find((t) => t.score === initial.score)
			if (!tier)
				throw new Error("These scores changed. Refresh the page to continue.")
			return { tier, you: data.you }
		},
		getNextPageParam: (last) => last.tier.next ?? undefined,
	})
	const pages = result.data.pages
	// Keep cached batches across title navigation. Deduplicate if a rating moved while the reader was away.
	const titles = [
		...new Map(
			pages.flatMap((p) => p.tier.titles).map((t) => [t.key, t]),
		).values(),
	]
	const shown = collapsed ? titles.slice(0, SCORES_PAGE_SIZE) : titles
	const total = pages[0].tier.total
	const remaining = Math.max(0, total - shown.length)
	return (
		<section
			id={`tier-${initial.score}`}
			className="scroll-mt-44"
			aria-label={`${initial.score} · ${scoreLabels[initial.score]}`}
		>
			<h2 className="mb-3 flex items-center gap-3 border-b border-white/10 pb-2">
				<span className="flex h-10 w-10 shrink-0 scale-125 items-center justify-center">
					<ScoreChip score={initial.score} />
				</span>
				<span className={`${DISPLAY} text-2xl`}>
					{scoreLabels[initial.score]}
				</span>
				<span className="text-sm font-bold tabular-nums text-gray-500">
					{count(total)}
				</span>
			</h2>
			<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 md:grid-cols-8 xl:grid-cols-10">
				{shown.map((title, index) => (
					<li key={title.key} className="min-w-0">
						<ProfilePoster
							title={title}
							sizes={TIER_SIZES}
							posterPriority={first && index < 4 ? "high" : "lazy"}
							skipOffscreen={!first || index >= 4}
							skipScore={shell.viewer === "owner"}
						/>
					</li>
				))}
			</ul>
			{total > SCORES_PAGE_SIZE && (
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<p className="text-sm tabular-nums text-gray-400" aria-live="polite">
						{count(shown.length)} of {count(total)}
					</p>
					{(collapsed || result.hasNextPage) && (
						<button
							type="button"
							disabled={result.isFetching}
							onClick={() => {
								if (collapsed) setCollapsed(false)
								else void result.fetchNextPage()
							}}
							className="min-h-11 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-bold text-gray-100 ring-1 ring-white/15 hover:bg-white/[0.1] disabled:opacity-50"
						>
							{result.isFetching
								? "Loading…"
								: result.isError
									? "Retry"
									: collapsed
										? "Show loaded titles"
										: `Show ${Math.min(SCORES_PAGE_SIZE, remaining)} more`}
						</button>
					)}
					{!collapsed && titles.length > SCORES_PAGE_SIZE && (
						<button
							type="button"
							onClick={() => setCollapsed(true)}
							className="min-h-11 px-3 text-sm font-bold text-gray-400 hover:text-white"
						>
							Show fewer
						</button>
					)}
				</div>
			)}
			{result.isError && (
				<p role="alert" className="mt-2 text-sm text-red-300">
					{result.error.message}{" "}
					<button
						type="button"
						className="underline"
						onClick={() => revalidator.revalidate()}
					>
						Refresh scores
					</button>
				</p>
			)}
		</section>
	)
}
