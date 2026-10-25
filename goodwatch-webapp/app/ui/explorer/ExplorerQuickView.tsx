// A title of the Explorer's map in the quick view (ui/quick-view): its island above the name, its genres in the
// meta line, why it fits the viewer (the map's own reason line), the viewer's services, and the story. The poster
// lifts from the map's canvas, where the engine knows its box. One title at a time: the map has no order to step.
import type { ExplorerCard, ExplorerTitle } from "~/domain/explorer"
import { type Box, QuickView } from "~/ui/quick-view/QuickView"
import { QuickViewCard } from "~/ui/quick-view/QuickViewCard"
import { SignUpPrompt } from "~/ui/sign-up-prompt/SignUpPrompt"
import type { TitleChange } from "~/ui/title-actions/TitleControl"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { titlePath } from "./Caption"

export function ExplorerQuickView({
	title,
	where,
	card,
	wide,
	boxOf,
	focusOf,
	onChange,
	onClose,
}: {
	title: ExplorerTitle
	/** The island it's on, and its color. */
	where: { name: string; color: string }
	/** The card from the server: why, services, the story, sign-up; null while it loads. */
	card: ExplorerCard | null
	wide: boolean
	/** The poster's box on the screen, from the map's engine. */
	boxOf: () => Box | null
	/** The map, which takes the focus back. */
	focusOf: () => HTMLElement | null
	onChange: (change: TitleChange) => void
	onClose: () => void
}) {
	const meta = [
		title.year ? String(title.year) : "",
		title.mediaType === "show" ? "Show" : "Movie",
		title.genres.slice(0, 2).join(" and ").toLowerCase(),
	]
		.filter(Boolean)
		.join(" · ")
	return (
		<QuickView
			count={1}
			index={0}
			onIndex={() => {}}
			onClose={onClose}
			ordered={false}
			wide={wide}
			anchorOf={() => null}
			boxOf={boxOf}
			focusOf={focusOf}
			posterOf={() => ({ path: title.poster, name: title.title })}
		>
			{() => (
				<QuickViewCard
					title={{
						media: {
							mediaType: title.mediaType,
							details: {
								tmdb_id: title.tmdbId,
								title: title.title,
								poster_path: title.poster,
								release_year: title.year,
							},
						},
						href: titlePath(title),
						meta,
						lang: mediaFieldLanguage(title),
						poster: title.poster,
						backdrop: title.backdrop,
						goodwatch: title.score,
						eyebrow: (
							<span className="inline-flex items-center gap-1.5">
								<span
									className="size-2 rounded-full"
									style={{ background: where.color }}
								/>
								{where.name}
							</span>
						),
						match: card?.signUp ? null : title.match,
						reason: card ? (
							card.why
						) : (
							<p className="text-[14px] text-gray-500">
								Looking at why it fits you…
							</p>
						),
						note: card?.signUp ? (
							<SignUpPrompt feature="tasteMatch" size="inline" />
						) : undefined,
						services: card
							? card.services.map((s) => ({
									id: s.id,
									name: s.name,
									logo_path: s.logo,
								}))
							: null,
						story: card ? card.title.overview : undefined,
						onChange,
					}}
				/>
			)}
		</QuickView>
	)
}
