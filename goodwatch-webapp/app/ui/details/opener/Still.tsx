import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import { HeroBackdropImage } from "~/ui/details/hero/Trailer"

type Media = MovieResult | ShowResult

/** The trailer card's still: another of the title's backdrops than the band's, so the card doesn't repeat the image it lies on. */
export function cardStillPath(media: Media): string | null {
	const band = media.details.backdrop_path
	const all = media.images?.backdrops ?? []
	return all.find((b) => b.file_path && b.file_path !== band)?.file_path ?? null
}

const CARD_SIZES: [string | null, string][] = [
	["(min-width: 1024px)", "320px"],
	[null, "200px"],
]

/**
 * The player's still, letterboxed (the card's look, and the stage's before a press): the card's own backdrop, or,
 * with only the band's image, a tight dark crop of it (another part of the frame), so the two never read as one.
 * `small`: the card's file only; the stage lays a larger one over it, so the growing stage is never empty.
 */
export function Still({
	media,
	small = false,
}: { media: MovieResult | ShowResult; small?: boolean }) {
	const path = cardStillPath(media)
	return (
		<div aria-hidden="true" className="absolute inset-0">
			{path ? (
				<>
					<TmdbImage
						kind="backdrop"
						path={path}
						sizes={CARD_SIZES}
						maxWidth={780}
						alt=""
						className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-[50%_40%]"
						draggable={false}
					/>
					{!small && (
						<TmdbImage
							kind="backdrop"
							path={path}
							sizes={[[null, "100vw"]]}
							maxWidth={1280}
							alt=""
							className="absolute inset-0 h-full w-full scale-[1.06] object-cover object-[50%_40%]"
							draggable={false}
						/>
					)}
				</>
			) : small ? (
				media.details.backdrop_path && (
					<TmdbImage
						kind="backdrop"
						path={media.details.backdrop_path}
						sizes={CARD_SIZES}
						maxWidth={780}
						alt=""
						className="absolute inset-0 h-full w-full origin-[70%_35%] scale-[2.3] object-cover brightness-[.55] saturate-[.85]"
						draggable={false}
					/>
				)
			) : (
				// The band's own image (already loaded, full width), cropped the card's way.
				<HeroBackdropImage
					media={media}
					className="absolute inset-0 h-full w-full origin-[70%_35%] scale-[2.3] object-cover brightness-[.55] saturate-[.85]"
				/>
			)}
			<span className="absolute inset-x-0 top-0 h-[11%] bg-black" />
			<span className="absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-black via-black/85 to-transparent" />
		</div>
	)
}
