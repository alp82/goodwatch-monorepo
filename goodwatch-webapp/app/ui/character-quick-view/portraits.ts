// Character portraits in the browser, from /api/character-portraits:
//
//   const portraits = useTitlePortraits("show", 1396)   a title's portraits; empty until loaded
//   portraits.of({ id, name, roles })                    the portrait of a cast member, or undefined
//   const roles = usePersonRoles(17419, "Bryan Cranston") a person's characters, one per title, best known first
//   fetchCharacterMatches("walter")                      characters whose name starts with the text
import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import {
	type CharacterPortrait,
	type CharacterRole,
	pickRole,
	portraitLookup,
} from "~/domain/character-portraits"
import { titlePath } from "~/utils/helpers"
import type { CharacterEntry } from "./context"

export type { CharacterPortrait, CharacterRole }

const ENDPOINT = "/api/character-portraits"

async function read<T>(params: Record<string, string>): Promise<T> {
	const r = await fetch(`${ENDPOINT}?${new URLSearchParams(params)}`)
	if (!r.ok) throw new Error(`Character portraits answered ${r.status}`)
	return (await r.json()) as T
}

export interface TitlePortraits {
	ready: boolean
	all: CharacterPortrait[]
	of: ReturnType<typeof portraitLookup>
}

export function useTitlePortraits(
	mediaType: "movie" | "show",
	tmdbId: number,
	enabled = true,
): TitlePortraits {
	const q = useQuery({
		queryKey: ["character-portraits", mediaType, tmdbId],
		queryFn: () =>
			read<{ portraits: CharacterPortrait[] }>({
				type: mediaType,
				id: String(tmdbId),
			}).then((d) => d.portraits),
		enabled,
	})
	const all = q.data ?? []
	const of = useMemo(() => portraitLookup(q.data ?? []), [q.data])
	return { ready: q.isSuccess, all, of }
}

/** A person's characters, one per title, best known first (`limit` of them). */
export function fetchPersonRoles(
	personId: number | null | undefined,
	name: string,
	limit: number,
) {
	const params: Record<string, string> = {
		person: String(personId ?? 0),
		limit: String(limit),
	}
	if (name) params.name = name
	return read<{ name: string; characters: CharacterRole[] }>(params)
}

export interface PersonRoles {
	ready: boolean
	name: string
	list: CharacterRole[]
	/** That title's character, preferring the one named in `characters`. */
	of: (
		mediaType: string,
		tmdbId: number,
		characters?: string[],
	) => CharacterRole | undefined
}

/** Every role of a person (Discover's cast filter knows only the id; the name is looked up then). */
export function usePersonRoles(
	personId: number | null | undefined,
	name = "",
	enabled = true,
): PersonRoles {
	const q = useQuery({
		queryKey: ["character-person-roles", personId ?? 0, name],
		queryFn: () => fetchPersonRoles(personId, name, 200),
		enabled: enabled && Boolean(personId),
	})
	return useMemo(() => {
		const list = q.data?.characters ?? []
		const byTitle = new Map<string, CharacterRole[]>()
		for (const r of list) {
			const key = `${r.mediaType}-${r.tmdbId}`
			byTitle.set(key, [...(byTitle.get(key) ?? []), r])
		}
		return {
			ready: q.isSuccess,
			name: q.data?.name ?? name,
			list,
			of: (mediaType, tmdbId, characters) =>
				pickRole(byTitle.get(`${mediaType}-${tmdbId}`) ?? [], characters),
		}
	}, [q.data, q.isSuccess, name])
}

/** Characters whose name, or a word of it, starts with the text, most popular titles first. */
export function fetchCharacterMatches(text: string) {
	return read<{ characters: CharacterRole[] }>({ q: text }).then(
		(d) => d.characters,
	)
}

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
