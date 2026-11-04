// The title page's Tropes section: two of the Tropes sub-page's signature cards, and the whole section one link into
// that sub-page. The block lights up on hover, the cards lift a little, the "All N tropes" line brightens. The
// title page's loader puts the cards into the page (tropesTeaserState); when it ran out of time they load here.
import { ChevronRightIcon } from "@heroicons/react/24/outline"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { fmt } from "~/ui/details/page-ui"
import { SubPageLink } from "~/ui/details/sub-page/SubPageLinks"
import { subPagePath } from "~/ui/details/sub-page/paths"
import { tropeNames } from "~/ui/details/title-words"
import { SIGNATURE_CARD, SignatureCardFace } from "./TropeCard"
import { useTropesTeaser } from "./model"
import { TEASER_CARDS } from "./tropes-data"

type Media = MovieResult | ShowResult

/** The rail's gist: the cards' trope names, or the title's first trope names until they are there. */
export function useTropesPeek(media: Media): string | null {
	const teaser = useTropesTeaser(media.mediaType, media.details.tmdb_id)
	const names = teaser.data?.cards.length
		? teaser.data.cards.map((t) => t.name)
		: tropeNames(media).names
	return names.length ? names.slice(0, 3).join(", ") : null
}

export function TropesSection({ media }: { media: Media }) {
	const teaser = useTropesTeaser(media.mediaType, media.details.tmdb_id)
	const fallback = tropeNames(media)
	const cards = teaser.data?.cards ?? []
	const total = teaser.data?.total || fallback.total
	const skip = { type: media.mediaType, id: media.details.tmdb_id }
	return (
		<div className="flex max-w-3xl flex-col gap-4">
			<SubPageLink
				to={subPagePath("tropes", media)}
				id="tropes-way-in"
				className="group -mx-3 block rounded-2xl px-3 py-3 outline-none ring-1 ring-transparent transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.035] hover:ring-white/10 focus-visible:outline-2 focus-visible:outline-amber-300"
			>
				{teaser.isPending ? (
					<span aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
						{Array.from({ length: TEASER_CARDS }, (_, i) => (
							<span
								// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
								key={i}
								className="block h-40 animate-pulse rounded-xl bg-white/[0.025] ring-1 ring-white/10"
							/>
						))}
					</span>
				) : cards.length ? (
					<span className="grid gap-3 sm:grid-cols-2">
						{cards.map((t) => (
							<span
								key={t.id}
								className={`${SIGNATURE_CARD} min-w-0 transition-[transform,background-color] duration-300 group-hover:-translate-y-0.5 group-hover:bg-white/[0.045] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0`}
							>
								<SignatureCardFace t={t} skip={skip} size={26} read={false} />
							</span>
						))}
					</span>
				) : (
					<span className="block text-[15px] text-gray-300">
						{fallback.names.slice(0, 6).join(", ")}
					</span>
				)}
				{total > 0 && (
					<span className="mt-4 flex w-fit items-center gap-2 text-[15px] font-semibold text-amber-300/90 group-hover:text-amber-300">
						<span>All {fmt(total)} tropes</span>
						<ChevronRightIcon
							className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
							aria-hidden="true"
						/>
					</span>
				)}
			</SubPageLink>
		</div>
	)
}
