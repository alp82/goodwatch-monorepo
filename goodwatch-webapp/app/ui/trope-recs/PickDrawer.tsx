// Why a pick, on a phone: the site's quick view drawer over the picks (wide screens keep PickSheet.tsx). The head and
// footer are every drawer's (the title page link, Seen and score, Want to See, Not interested); the reason line is the
// pick's place, match and how many of the member's tropes it carries; then its story, and one box per trope (at most
// eight, in their rank order) with how the trope shows up in it (TV Tropes text under a spoiler cover). Previous / next
// step through all picks and stop at the ends; only the open pick asks for its write-ups. The story, backdrop, runtime
// and services come from /api/for-you/details, twelve at a time. Loaded on first use (TropeRecsPage).
import { useQuery } from "@tanstack/react-query"
import type { ForYouDetail } from "~/domain/for-you-page/contract"
import type { RecKind } from "~/domain/trope-recs"
import { LicenseCredit } from "~/ui/profile/tropes/parts"
import { CARD, QuickView } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { useUser } from "~/utils/auth"
import { TropeBox } from "./PickSheet"
import type { RecTitle } from "./api"
import { cardTitle } from "./card"

const CHUNK = 12

async function fetchDetails(
	keys: string[],
): Promise<Record<string, ForYouDetail>> {
	const response = await fetch(
		`/api/for-you/details?keys=${keys.map(encodeURIComponent).join(",")}`,
	)
	if (!response.ok) throw new Error(`Pick details: ${response.status}`)
	return response.json()
}

/** The details of the twelve picks around `index`'s chunk. */
function useDetails(titles: RecTitle[], chunk: number) {
	const { user } = useUser()
	const keys = titles.slice(chunk * CHUNK, (chunk + 1) * CHUNK).map((t) => t.id)
	return useQuery({
		queryKey: ["trope-recs-details", user?.id ?? null, keys.join(",")],
		queryFn: () => fetchDetails(keys),
		enabled: keys.length > 0 && Boolean(user),
		staleTime: 10 * 60 * 1000,
	})
}

function Pick({
	titles,
	index,
	tropeCount,
	kind,
	onClose,
}: {
	titles: RecTitle[]
	index: number
	tropeCount: number
	kind: RecKind
	onClose: () => void
}) {
	const pick = titles[index]
	const details = useDetails(titles, Math.floor(index / CHUNK))
	const detail = details.data?.[pick.id]
	return (
		<QuickViewCard
			title={{
				media: { mediaType: pick.kind, details: cardTitle(pick) },
				href: pick.href,
				meta: [
					pick.year,
					pick.kind === "show" ? "Show" : "Movie",
					pick.kind === "movie" && detail?.runtime
						? `${detail.runtime} min`
						: null,
				]
					.filter(Boolean)
					.join(" · "),
				poster: pick.poster,
				backdrop: detail?.backdrop,
				goodwatch: pick.gwScore,
				reason: (
					<p className="text-sm text-gray-300">
						#{index + 1} · match{" "}
						<b className="text-white tabular-nums">{pick.match}</b> · carries{" "}
						{pick.matchedCount} of your {tropeCount} tropes
					</p>
				),
				services: details.isSuccess ? (detail?.services ?? []) : null,
				// A failed details read shows the pick without a story.
				story: details.isPending ? undefined : (detail?.overview ?? null),
				extra: (
					<section className="py-3">
						<ul className="grid gap-2">
							{pick.matchedTropes.map((trope) => (
								<TropeBox
									key={`${pick.id}|${trope.id}`}
									trope={trope}
									pick={pick}
									kind={kind}
									onClose={onClose}
								/>
							))}
						</ul>
						{pick.matchedCount > pick.matchedTropes.length && (
							<p className="mt-2 text-xs text-gray-500">
								And {pick.matchedCount - pick.matchedTropes.length} more of your
								tropes.
							</p>
						)}
						<LicenseCredit />
					</section>
				),
			}}
		/>
	)
}

export default function PickDrawer({
	titles,
	index,
	tropeCount,
	kind,
	onIndex,
	onClose,
}: {
	titles: RecTitle[]
	index: number
	tropeCount: number
	kind: RecKind
	onIndex: (index: number) => void
	onClose: () => void
}) {
	// The next chunk's details ahead of a step into it.
	useDetails(
		titles,
		Math.floor(index / CHUNK) + (index % CHUNK >= CHUNK - 3 ? 1 : 0),
	)
	return (
		<QuickView
			count={titles.length}
			index={index}
			onIndex={onIndex}
			onClose={onClose}
			ordered={titles.length > 1}
			// Like the sheet, the steps stop at the first and the last pick.
			wrap={false}
			wide={false}
			anchorOf={(i) =>
				titles[i]
					? document.querySelector<HTMLElement>(
							`[data-pick-id="${titles[i].id}"]`,
						)
					: null
			}
			posterOf={(i) => ({
				path: titles[i]?.poster ?? null,
				name: titles[i]?.name ?? "",
			})}
			// The tropes scroll in the body; the drawer takes what the screen gives it (its 85% cap).
			height={{ h: CARD.h, drawer: 760 }}
		>
			{(i) => (
				<Pick
					titles={titles}
					index={i}
					tropeCount={tropeCount}
					kind={kind}
					onClose={onClose}
				/>
			)}
		</QuickView>
	)
}
