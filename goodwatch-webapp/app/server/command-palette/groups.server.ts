import { runsSearch } from "~/server/role.server"
import { palettePeopleSnapshot } from "~/server/search-people/people.server"
import { matchedAlias } from "~/server/search-ranking/aliases.server"
import { matchingRows } from "~/server/search-ranking/name-prefix.server"
import {
	getSearchIndex,
	loadedSearchIndexBuild,
} from "~/server/search-ranking/search-index.server"
import { fold } from "~/server/search-ranking/text-rules.server"
import { getDisplayFields } from "~/server/title-cards.server"
import {
	PALETTE_GROUP_ORDER,
	type PaletteGroup,
	type PaletteTitle,
	paletteTitlePath,
} from "~/utils/command-palette"
import { personPath } from "~/utils/helpers"
import { catalogEntries, startPaletteCatalog } from "./catalog.server"
import { discover, matchGroup } from "./matching.server"
import { blog, lists, moods } from "./static.server"

let peopleSnapshot: ReturnType<typeof palettePeopleSnapshot> | undefined
let peopleEntries: import("./matching.server").Entry[] = []
export function vocabularyGroups(prefix: string): PaletteGroup[] {
	startPaletteCatalog()
	const snapshot = palettePeopleSnapshot()
	if (peopleSnapshot !== snapshot) {
		peopleSnapshot = snapshot
		peopleEntries = snapshot.map((p) => ({
			names: [p.name],
			popularity: p.popularity,
			item: {
				key: `person-${p.id}`,
				label: p.name,
				sub:
					p.department === "Acting"
						? "Actor"
						: p.department === "Directing"
							? "Director"
							: p.department || undefined,
				href: personPath(p.id, p.name),
				image: { kind: "portrait" as const, path: p.profile ?? undefined },
			},
		}))
	}
	const people = peopleEntries
	const groups = [
		matchGroup("people", "People", people, prefix, "/people"),
		matchGroup(
			"tropes",
			"Tropes",
			catalogEntries("tropes"),
			prefix,
			discover({ q: prefix }),
		),
		matchGroup("moods", "Moods", moods, prefix, "/discover"),
		matchGroup(
			"genres",
			"Genres",
			catalogEntries("genres"),
			prefix,
			"/discover",
		),
		matchGroup(
			"sequels",
			"Sequels",
			catalogEntries("sequels"),
			prefix,
			discover({ q: prefix }),
		),
		matchGroup(
			"services",
			"Streaming services",
			catalogEntries("services"),
			prefix,
			"/new",
		),
		matchGroup("lists", "Lists", lists, prefix, "/movies"),
		matchGroup("members", "Members", catalogEntries("members"), prefix),
		matchGroup("blog", "Blog", blog, prefix, "/blog"),
	]
	return groups.filter((g): g is PaletteGroup => !!g)
}
export function titleGroups(
	prefix: string,
	titles: PaletteTitle[],
	counts?: { movie: number; show: number; estimated: boolean },
): PaletteGroup[] {
	return (["movie", "show"] as const).flatMap((type) => {
		const found = titles.filter((t) => t.mediaType === type)
		if (!found.length) return []
		return [
			{
				key: type === "movie" ? ("movies" as const) : ("shows" as const),
				label: type === "movie" ? "Movies" : "Shows",
				total: counts?.[type] ?? found.length,
				estimated: counts?.estimated || undefined,
				href: discover({ q: prefix, type }),
				items: found.slice(0, 12).map((title, i) => ({
					key: `title-${type}-${title.tmdbId}`,
					label: title.title,
					href: paletteTitlePath(title),
					title,
					match: 1 - i / 100,
					image: {
						kind: "poster" as const,
						path: title.posterPath ?? undefined,
					},
				})),
			},
		]
	})
}
export async function indexGroups(prefix: string): Promise<PaletteGroup[]> {
	if (!runsSearch() || !loadedSearchIndexBuild()) return []
	const index = await getSearchIndex()
	const { rows, total, aliases } = matchingRows(index, fold(prefix), 256)
	const movie = rows.filter(
		(row) => index.titleTable.pointIds[row] < 2_000_000_000_000,
	)
	const show = rows.filter(
		(row) => index.titleTable.pointIds[row] >= 2_000_000_000_000,
	)
	const selected = [...movie.slice(0, 18), ...show.slice(0, 18)]
	const displays = await getDisplayFields(
		selected.map((r) => index.titleTable.pointIds[r]),
	)
	const titles: PaletteTitle[] = []
	for (const row of selected) {
		const d = displays.get(index.titleTable.pointIds[row])
		if (!d?.poster_path || d.goodwatch_overall_score_normalized_percent == null)
			continue
		const alias = aliases.get(row)
		titles.push({
			mediaType: d.media_type,
			tmdbId: d.tmdb_id,
			title: d.title,
			year: d.release_year ? String(d.release_year) : "",
			posterPath: d.poster_path,
			canonical_title: d.canonical_title,
			presentation: d.presentation,
			...(alias === undefined
				? {}
				: { matchedAlias: matchedAlias(index.aliases, alias) }),
		})
	}
	const exact = rows.length === total
	const count = (n: number) =>
		exact ? n : Math.max(n, Math.round((total * n) / rows.length))
	return titleGroups(prefix, titles, {
		movie: count(movie.length),
		show: count(show.length),
		estimated: !exact,
	})
}
export const ordered = (groups: PaletteGroup[]) =>
	groups.sort(
		(a, b) =>
			PALETTE_GROUP_ORDER.indexOf(a.key) - PALETTE_GROUP_ORDER.indexOf(b.key),
	)
