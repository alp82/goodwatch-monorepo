// A cast member with their character: the TheTVDB portrait that belongs to them (matched by actor name, see
// domain/character-portraits.ts), the character's name, and the character quick view's entry. The cast list and the
// Starring faces build their people with castCharacter() and draw the actor and the character with the thumbs here.
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import { TmdbImage } from "~/ui/TmdbImage"
import type { CharacterEntry } from "~/ui/character-quick-view/context"
import { PortraitImg } from "~/ui/character-quick-view/parts"
import type {
	CharacterPortrait,
	TitlePortraits,
} from "~/ui/character-quick-view/portraits"
import { initials } from "~/ui/details/page-ui"
import { type PeopleRow, episodesWords } from "~/ui/details/people/usePeople"
import { personPath } from "~/utils/helpers"
import { tmdbImageUrl } from "~/utils/tmdb-image"

type Media = MovieResult | ShowResult

const TIER: Record<string, string> = {
	main: "Main cast",
	recurring: "Recurring",
	guest: "Guest star",
	top: "Top billed",
	more: "",
}

export interface CastCharacter {
	row: PeopleRow
	portrait?: CharacterPortrait
	/** The character the portrait and the line are about. */
	character: string
	/** The quick view's entry; null without any picture to show bigger. */
	entry: CharacterEntry | null
	/** "Bryan Cranston as Walter White", or the name alone. */
	label: string
}

/** A cast row as a person with their character, for the list or strip drawn at `where`. */
export function castCharacter(
	media: Media,
	row: PeopleRow,
	portraits: TitlePortraits,
	where: string,
): CastCharacter {
	const portrait = portraits.of({
		id: row.id,
		name: row.name,
		roles: row.roles,
	})
	const character = portrait?.character || row.roles[0] || ""
	const image =
		portrait?.image ??
		(row.profilePath ? tmdbImageUrl(row.profilePath, "h632") : null)
	const eps = media.mediaType === "show" ? episodesWords(row.episodes) : null
	return {
		row,
		portrait,
		character,
		label: character ? `${row.name} as ${character}` : row.name,
		entry: image
			? {
					anchor: `${where}-${media.mediaType}-${media.details.tmdb_id}-${row.id}`,
					character: character || row.name,
					image,
					personName: row.name,
					personId: row.id,
					actorProfilePath: row.profilePath,
					actorImage: portrait?.actorImage ?? null,
					title: {
						mediaType: media.mediaType,
						tmdbId: media.details.tmdb_id,
						name: media.details.title,
						year: media.details.release_year,
						posterPath: media.details.poster_path,
					},
					facts: [TIER[row.group], eps].filter((x): x is string => Boolean(x)),
					href: personPath(row.id, row.name),
				}
			: null,
	}
}

/** The title's first cast (from the page's own data) as people rows. */
export const pageCastRows = (media: Media, count?: number): PeopleRow[] =>
	(count === undefined ? media.cast : media.cast.slice(0, count)).map((c) => ({
		id: c.id,
		name: c.name,
		profilePath: c.profile_path,
		roles: c.characters,
		episodes: null,
		group: "",
	}))

const FILL = "absolute inset-0 h-full w-full object-cover object-top"

/** The actor's photo: TMDB's, else TheTVDB's, else initials. Fills its `relative` box. */
export function ActorImage({ p, width }: { p: CastCharacter; width: number }) {
	if (p.row.profilePath)
		return (
			<TmdbImage
				kind="profile"
				path={p.row.profilePath}
				width={width}
				alt=""
				className={FILL}
			/>
		)
	if (p.portrait?.actorImage)
		return <PortraitImg src={p.portrait.actorImage} alt="" className={FILL} />
	return (
		<span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-gray-500">
			{initials(p.row.name)}
		</span>
	)
}

/** The character's portrait; nothing without one. Fills its `relative` box. */
export function CharacterImage({ p }: { p: CastCharacter }) {
	if (!p.portrait) return null
	return <PortraitImg src={p.portrait.image} alt={p.label} className={FILL} />
}
