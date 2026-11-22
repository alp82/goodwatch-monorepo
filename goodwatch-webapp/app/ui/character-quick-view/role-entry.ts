import type { CharacterRole } from "~/domain/character-portraits"
import { titlePath } from "~/utils/helpers"
import type { CharacterEntry } from "./context"

/** The quick view's entry for a person's role; its link goes to the title. */
export function roleEntry(
	role: CharacterRole,
	person: { id?: number | null; name: string; profilePath?: string | null },
): CharacterEntry {
	return {
		anchor: `role-${role.mediaType}-${role.tmdbId}-${role.character}`,
		character: role.character,
		image: role.image,
		personName: person.name || role.personName,
		personId: person.id ?? role.personTmdbId,
		actorProfilePath: person.profilePath ?? null,
		actorImage: role.actorImage,
		title: {
			mediaType: role.mediaType,
			tmdbId: role.tmdbId,
			name: role.title,
			year: role.year,
			posterPath: role.posterPath,
		},
		href: titlePath(role.mediaType, role.tmdbId, role.title),
		moreFrom: "title",
	}
}
