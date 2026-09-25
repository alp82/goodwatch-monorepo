// "Share your top 5" on Taste: a list prefilled from the person's highest-rated titles, one click from the editor.
// It only reads ratings; share lists don't change the taste profile or recommendations.
import { SparklesIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { topFivePath } from "~/ui/share-card/links"
import { type CardTitle, LIST_SIZE, THEMES } from "~/ui/share-card/model"
import { type RatedTitle, prefillKeys } from "~/ui/share-card/prefill"
import { readBrowserDraft } from "~/ui/share-list-editor/autosave"
import { GuestDraftCard } from "~/ui/share-lists/MyListsCard"
import { useGuestInteractions } from "~/utils/guest-progress"

const THEME = THEMES.ember

async function fetchTitles(url: string, signal: AbortSignal) {
	const response = await fetch(url, { signal })
	if (!response.ok)
		throw new Error(`Loading your top titles failed (${response.status})`)
	const { titles } = (await response.json()) as { titles: CardTitle[] }
	return titles.slice(0, LIST_SIZE)
}

/** Signed-in people: their five highest-rated titles, ranked on the server. */
function useAccountTopFive() {
	const { data } = useQuery({
		queryKey: ["share-list-top-rated"],
		queryFn: ({ signal }) => fetchTitles("/api/share-lists/top-rated", signal),
	})
	return { titles: data ?? [], path: topFivePath() }
}

/** Guests: their ratings from shared guest progress, ranked in the browser the same way the server ranks. */
function useGuestTopFive() {
	const interactions = useGuestInteractions()
	const keys = useMemo(() => {
		const ratings: RatedTitle[] = interactions
			.filter((i) => i.type === "score" && i.score)
			.map((i) => ({
				media_type: i.media_type,
				tmdb_id: i.tmdb_id,
				score: Number(i.score),
				ratedAt: i.timestamp,
			}))
		return prefillKeys(ratings)
	}, [interactions])
	const { data } = useQuery({
		queryKey: ["share-list-titles", keys.join(",")],
		enabled: keys.length > 0,
		queryFn: ({ signal }) =>
			fetchTitles(`/api/share-lists/titles?keys=${keys.join(",")}`, signal),
	})
	return { titles: keys.length ? (data ?? []) : [], path: topFivePath(keys) }
}

function TopFiveCard({ titles, path }: { titles: CardTitle[]; path: string }) {
	if (!titles.length) return null
	const missing = LIST_SIZE - titles.length
	return (
		<section className="relative overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/10">
			<div
				className="pointer-events-none absolute inset-0 opacity-30"
				style={{
					backgroundImage: `radial-gradient(ellipse at 15% 50%, ${THEME.accent}66 0%, transparent 60%)`,
				}}
				aria-hidden
			/>
			<div className="relative flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
				<Link
					to={path}
					className="flex shrink-0 items-end justify-center pl-2 sm:justify-start"
					aria-hidden
					tabIndex={-1}
				>
					{titles.map((t, i) => (
						<div
							key={t.key}
							className="relative -ml-3 w-14 shrink-0 first:ml-0 sm:w-16"
							style={{
								transform: `rotate(${(i - (titles.length - 1) / 2) * 4}deg) translateY(${Math.abs(i - (titles.length - 1) / 2) * 3}px)`,
							}}
						>
							{t.poster ? (
								<img
									src={t.poster.replace("/w500/", "/w185/")}
									alt=""
									className="aspect-[2/3] w-full rounded-md object-cover shadow-lg shadow-black/60 ring-1 ring-white/10"
								/>
							) : (
								<div className="flex aspect-[2/3] w-full items-center justify-center rounded-md bg-gray-800 p-1 text-center text-[9px] leading-tight text-gray-300 shadow-lg shadow-black/60">
									{t.title}
								</div>
							)}
							<span
								className="absolute -top-2 -left-1.5 flex size-6 items-center justify-center rounded-full text-xs font-black text-black shadow"
								style={{ backgroundColor: THEME.accent }}
							>
								{i + 1}
							</span>
						</div>
					))}
				</Link>
				<div className="min-w-0 flex-1">
					<p
						className="flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase"
						style={{ color: THEME.accent2 }}
					>
						<SparklesIcon className="size-4" aria-hidden /> Share your taste
					</p>
					<h2 className="mt-1 text-xl font-black text-gray-50">
						Share your top 5
					</h2>
					<p className="mt-1 text-sm text-gray-400">
						{missing > 0
							? `Your ${titles.length === 1 ? "highest-rated title is" : `${titles.length} highest-rated titles are`} in. Add ${missing} more, pick a design, and share the card.`
							: "Your five highest-rated titles are ready. Put them in order, pick a design, and share the card."}
					</p>
				</div>
				<Link
					to={path}
					className="shrink-0 rounded-full px-5 py-2.5 text-center font-black text-black transition hover:brightness-110"
					style={{
						backgroundImage: `linear-gradient(90deg, ${THEME.accent}, ${THEME.accent2})`,
					}}
				>
					Make my top 5
				</Link>
			</div>
		</section>
	)
}

/** For signed-in people on their Taste profile. Renders nothing until they have rated a title. */
export function ShareTopFiveCard() {
	return <TopFiveCard {...useAccountTopFive()} />
}

/**
 * For guests on Taste. A draft they already started comes first, so there's one list action at a time: continue the
 * draft, or start a top 5 from their ratings.
 */
export function GuestShareListEntry() {
	const [hasDraft, setHasDraft] = useState<boolean | null>(null)
	useEffect(() => setHasDraft(!!readBrowserDraft()?.items.length), [])
	const topFive = useGuestTopFive()
	if (hasDraft === null) return null
	if (hasDraft) return <GuestDraftCard />
	return (
		<div className="mx-auto mt-4 max-w-4xl">
			<TopFiveCard {...topFive} />
		</div>
	)
}
