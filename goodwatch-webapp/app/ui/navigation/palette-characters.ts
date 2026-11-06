// The search panel's Characters group: characters whose name, or a word of it, starts with the text, each with its
// TheTVDB portrait and "Bryan Cranston · Breaking Bad (2008)", leading to the title's At a glance page where the cast
// is. It comes from /api/character-portraits (one cached lookup per text) and sits after People (CommandPalette.tsx).
import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import {
	type CharacterRole,
	MIN_CHARACTER_QUERY,
	characterQuery,
} from "~/domain/character-portraits"
import { fetchCharacterMatches } from "~/ui/character-quick-view/portraits"
import { titlePath } from "~/utils/helpers"
import type { Option, PanelGroup } from "./palette-layout"

const DEBOUNCE_MS = 150

function useDebounced<T>(value: T, ms: number): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const t = setTimeout(() => setV(value), ms)
		return () => clearTimeout(t)
	}, [value, ms])
	return v
}

/** The title's At a glance page, where the cast lives. */
const characterHref = (role: CharacterRole) =>
	`${titlePath(role.mediaType, role.tmdbId, role.title)}/at-a-glance`

const characterOption = (role: CharacterRole): Option => ({
	key: `character-${role.mediaType}-${role.tmdbId}-${role.character}`,
	label: role.character,
	sub: `${role.personName} · ${role.title}${role.year ? ` (${role.year})` : ""}`,
	href: characterHref(role),
	group: "characters",
	characterImage: role.image,
})

/** The Characters group for the typed text, or null while there is none. */
export function useCharacterGroup(text: string): PanelGroup | null {
	const q = useDebounced(characterQuery(text) ?? "", DEBOUNCE_MS)
	const typed = characterQuery(text) !== null
	const found = useQuery({
		queryKey: ["character-search", q],
		queryFn: () => fetchCharacterMatches(q),
		enabled: q.length >= MIN_CHARACTER_QUERY,
		placeholderData: (previous) => previous,
	})
	return useMemo<PanelGroup | null>(() => {
		const characters = found.data ?? []
		if (!typed || !characters.length) return null
		return {
			key: "characters",
			label: "Characters",
			total: characters.length,
			items: characters.map(characterOption),
		}
	}, [typed, found.data])
}
