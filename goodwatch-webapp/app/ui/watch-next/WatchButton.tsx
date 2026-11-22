import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { TitleCard } from "~/server/title-cards.server"
import { titleToDashed } from "~/utils/helpers"
import { canonicalMediaTitle } from "~/utils/media-presentation"
import type { ServiceOffer } from "./services"
import { logoUrl } from "./style"

export const titleHref = (title: Pick<TitleCard, "media_type" | "tmdb_id" | "title">) =>
	`/${title.media_type}/${title.tmdb_id}-${titleToDashed(canonicalMediaTitle(title))}`

/** The hero's main button: the first service's logo and "Watch on …", to the title page. The start page uses it too. */
export function WatchButton({
	title,
	offers,
}: {
	title: TitleCard
	offers: ServiceOffer[] | null
}) {
	const offer = offers?.[0]
	return (
		<Link
			to={titleHref(title)}
			className="inline-flex h-12 items-center gap-2.5 rounded-lg bg-white pl-2 pr-5 text-base font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200"
		>
			{offer ? <img src={logoUrl(offer.logo_path)} alt="" className="h-8 w-8 rounded-md" /> : null}
			<PlayIcon className={`h-5 w-5 ${offer ? "" : "ml-2"}`} aria-hidden />
			{offer ? `Watch on ${offer.name}` : "Where to watch"}
		</Link>
	)
}
