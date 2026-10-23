// The member profile's loaders (/u/:handle and its tabs): who the profile belongs to, who is looking, and each page's
// view model, with every part the viewer may not see left empty. The routes call these and add their own headers.
// Spec: docs/implementation/member-profile/README.md
import { redirect } from "@remix-run/node"
import { scoreSpread } from "~/domain/my-scores"
import {
	type ProfileListCard,
	type ProfileListsPage,
	type ProfileOverview,
	type ProfileScoresPage,
	type ProfileSeenPage,
	type ProfileShell,
	type ProfileShowsPage,
	type ProfileTitle,
	type ProfileViewer,
	type ProfileWishlistPage,
	type ShowGroup,
	canSee,
} from "~/domain/profile"
import { isOnServices } from "~/server/availability-index.server"
import {
	type MyShows,
	type MyShowsRow,
	getMyShows,
} from "~/server/my-shows.server"
import { listsByUser } from "~/server/share-lists/store.server"
import { entryKey, resolveCardTitles } from "~/server/share-lists/titles.server"
import { getProfilePage } from "~/server/share-lists/view.server"
import { loadTaste } from "~/server/taste/index.server"
import { getMemberViewerContext } from "~/server/viewer.server"
import { type MediaKey, parseMediaKey } from "~/types/user-data"
import { profilePath } from "~/ui/share-card/links"
import { type CardTitle, cardDate } from "~/ui/share-card/model"
import type { ShareListSummary } from "~/ui/share-lists/ShareListTile"
import { getUserIdFromRequest } from "~/utils/auth"
import { SHARE_LIST_PAGE_CACHE_CONTROL } from "~/utils/auth-cookie"
import { titlePath } from "~/utils/helpers"
import { titleKey } from "~/utils/title-key"
import { avatarPath, avatarVersion } from "./avatar.server"
import {
	type ProfileLibrary,
	getProfileLibrary,
	titlesOf,
} from "./library.server"
import { getProfileSettings } from "./settings.server"

export { markProfileNoticeSeen } from "./settings.server"

/** A profile with at least this many public scores may be indexed (owner decision Q5). */
export const INDEX_MIN_SCORES = 20
const TMDB_POSTER = "https://image.tmdb.org/t/p/w185"

// A profile can come back (a handle claimed later), so never cache a missing one.
const notFound = () =>
	new Response("Not found", {
		status: 404,
		headers: { "Cache-Control": "private, no-store" },
	})

/** Anonymous views share the short lifetime of the share-list pages (docs/page-cache.md); member views stay private. */
export const profileCacheControl = (viewerId: string | null) =>
	viewerId == null ? SHARE_LIST_PAGE_CACHE_CONTROL : "private, no-store"

const iso = (value: Date | string | number | null | undefined) =>
	value == null ? null : new Date(value).toISOString()
const byDateDesc = (a: ProfileTitle, b: ProfileTitle) =>
	(b.date ?? "").localeCompare(a.date ?? "")
const round1 = (n: number) => Math.round(n * 10) / 10

export async function loadProfileShell(
	request: Request,
	handle: string,
): Promise<
	{ shell: ProfileShell; ownerId: string; viewerId: string | null } | Response
> {
	const page = await getProfilePage(handle)
	if (!page) throw notFound()
	const { profile } = page
	if (handle !== profile.handle) {
		// A differently cased handle moves to the lowercase one, keeping the tab and the query.
		const url = new URL(request.url)
		const rest = url.pathname.replace(/^\/u\/[^/]+/, "")
		return redirect(`${profilePath(profile.handle)}${rest}${url.search}`, 301)
	}
	const ownerId = profile.userId
	const viewerId = (await getUserIdFromRequest({ request })) ?? null
	const viewer: ProfileViewer =
		viewerId === ownerId ? "owner" : viewerId ? "member" : "guest"
	const [settings, library, photoVersion, ownLists] = await Promise.all([
		getProfileSettings(ownerId),
		getProfileLibrary(ownerId),
		avatarVersion(ownerId),
		viewer === "owner" ? listsByUser(ownerId) : Promise.resolve(page.lists),
	])
	const { visibility } = settings
	const see = (part: Parameters<typeof canSee>[1]) =>
		canSee(visibility, part, viewer)

	const scores = [...library.scored.values()].map((t) => t.score as number)
	const average = scores.length
		? round1(scores.reduce((a, b) => a + b, 0) / scores.length)
		: null

	// The picture: what the member picked, else the initial on amber.
	let avatarUrl: string | null = null
	let color: ProfileShell["avatar"]["color"] = "amber"
	const choice = settings.avatar
	if (choice.kind === "initial") color = choice.color
	else if (choice.kind === "photo" && photoVersion)
		avatarUrl = avatarPath(profile.handle, photoVersion)
	else if (choice.kind === "provider" && settings.providerPhoto)
		avatarUrl = settings.providerPhoto
	else if (choice.kind === "poster") {
		const poster = library.scored.get(choice.title as MediaKey)?.poster
		if (poster) avatarUrl = `${TMDB_POSTER}${poster}`
	}

	return {
		ownerId,
		viewerId,
		shell: {
			handle: profile.handle,
			viewer,
			visibility,
			avatar: { url: avatarUrl, color },
			cover: coverOf(
				library,
				settings.cover,
				settings.coverChosen,
				see("scores"),
			),
			bio: settings.bio,
			links: settings.links,
			since: library.since,
			counts: {
				seen: see("seen") ? library.seenKeys.length : 0,
				seenMovies: see("seen") ? library.seenMovies : 0,
				rated: see("scores") ? library.scored.size : 0,
				wishlist: see("wishlist")
					? Object.keys(library.data.wishlist).length
					: 0,
				lists: see("lists") ? ownLists.length : 0,
				hours: see("hours") ? library.hours : 0,
				episodes: see("hours") ? library.episodes : 0,
				average: see("scores") ? average : null,
			},
			spread: see("scores")
				? scoreSpread(scores)
				: Array.from({ length: 10 }, () => 0),
			indexable:
				visibility.scores === "everyone" &&
				library.scored.size >= INDEX_MIN_SCORES,
			showPublicNotice: viewer === "owner" && !settings.noticeSeen,
		},
	}
}

/** The chosen cover, or until the member chooses, the backdrop of their latest favorite (a 10, else a 9). */
function coverOf(
	library: ProfileLibrary,
	chosen: string | null,
	coverChosen: boolean,
	scoresVisible: boolean,
): ProfileShell["cover"] {
	if (coverChosen) {
		const title = chosen ? library.scored.get(chosen as MediaKey) : null
		return title?.backdrop
			? { backdrop: title.backdrop, title: title.title }
			: null
	}
	// The default comes from the scores, so it stays off when they're hidden from the viewer.
	if (!scoresVisible) return null
	const best = [...library.scored.values()]
		.filter((t) => (t.score ?? 0) >= 9 && t.backdrop)
		.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || byDateDesc(a, b))[0]
	return best?.backdrop ? { backdrop: best.backdrop, title: best.title } : null
}

const plainTitle = (t: ProfileTitle & { genres?: string[] }): ProfileTitle => {
	const { genres: _genres, ...title } = t
	return title
}

export async function loadProfileOverview(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileOverview> {
	const see = (part: Parameters<typeof canSee>[1]) =>
		canSee(shell.visibility, part, shell.viewer)
	const library = await getProfileLibrary(ownerId)
	const { data } = library
	const scored = [...library.scored.values()].map(plainTitle)

	const favorites = see("scores")
		? scored.filter((t) => t.score === 10).sort(byDateDesc)
		: []

	const activity = see("activity")
	const recentKeys = activity
		? library.seenKeys
				.filter((key) => data.watchState[key]?.watchedAt)
				.sort(
					(a, b) =>
						new Date(data.watchState[b]?.watchedAt ?? 0).getTime() -
						new Date(data.watchState[a]?.watchedAt ?? 0).getTime(),
				)
				.slice(0, 20)
		: []
	const recent = (
		await titlesOf(recentKeys, library, (key) =>
			iso(data.watchState[key]?.watchedAt),
		)
	).map((t) => (see("scores") ? t : { ...t, score: null }))

	const watching =
		activity && see("shows")
			? await ownerShows(ownerId).then((shows) =>
					showRows([...shows.continue, ...shows.pickUp]).slice(0, 20),
				)
			: []

	const newestKeys =
		activity && see("wishlist")
			? (Object.keys(data.wishlist) as MediaKey[])
					.sort(
						(a, b) =>
							new Date(data.wishlist[b].createdAt).getTime() -
							new Date(data.wishlist[a].createdAt).getTime(),
					)
					.slice(0, 20)
			: []
	const newestWishlist = (
		await titlesOf(newestKeys, library, (key) =>
			iso(data.wishlist[key]?.createdAt),
		)
	).map((t) => ({ ...t, score: null }))

	const lists: ProfileListCard[] = see("lists")
		? (await listCards(ownerId, shell)).map((list) => ({
				id: list.id,
				title: list.title,
				href: `${profilePath(shell.handle)}/lists/${list.id}`,
				posters: list.items.map((item) => item.poster),
			}))
		: []

	// Where the owner parts most with the GoodWatch score, after their usual generosity.
	const withGw = scored.filter((t) => t.gw != null && t.score != null)
	const offset = withGw.length
		? withGw.reduce(
				(sum, t) => sum + (t.score as number) - (t.gw as number) / 10,
				0,
			) / withGw.length
		: 0
	const hotTakes =
		see("scores") && see("taste")
			? withGw
					.map((title) => ({
						title,
						delta: round1(
							(title.score as number) - (title.gw as number) / 10 - offset,
						),
					}))
					.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
					.slice(0, 6)
			: []

	return { favorites, recent, watching, newestWishlist, lists, hotTakes }
}

export async function loadProfileScores(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileScoresPage> {
	if (!canSee(shell.visibility, "scores", shell.viewer)) return { tiers: [] }
	const library = await getProfileLibrary(ownerId)
	const tiers = new Map<number, ProfileTitle[]>()
	for (const t of library.scored.values()) {
		const score = t.score as number
		tiers.set(score, [...(tiers.get(score) ?? []), plainTitle(t)])
	}
	return {
		tiers: [...tiers.entries()]
			.sort((a, b) => b[0] - a[0])
			.map(([score, titles]) => ({ score, titles: titles.sort(byDateDesc) })),
	}
}

export async function loadProfileSeen(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileSeenPage> {
	if (!canSee(shell.visibility, "seen", shell.viewer))
		return { titles: [], total: 0 }
	const library = await getProfileLibrary(ownerId)
	const { data } = library
	// Only a logged watch dates a title here: an imported score's date says when it was imported, not watched.
	const titles = await titlesOf(library.seenKeys, library, (key) =>
		iso(data.watchState[key]?.watchedAt),
	)
	const scoresVisible = canSee(shell.visibility, "scores", shell.viewer)
	const dated = titles.filter((t) => t.date).sort(byDateDesc)
	const undated = titles
		.filter((t) => !t.date)
		.sort((a, b) => a.title.localeCompare(b.title))
	return {
		titles: [...dated, ...undated].map((t) =>
			scoresVisible ? t : { ...t, score: null },
		),
		total: library.seenKeys.length,
	}
}

export async function loadProfileWishlist(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileWishlistPage> {
	if (!canSee(shell.visibility, "wishlist", shell.viewer))
		return { watchNow: null, titles: [], total: 0 }
	const library = await getProfileLibrary(ownerId)
	const { data } = library
	const keys = (Object.keys(data.wishlist) as MediaKey[]).sort(
		(a, b) =>
			new Date(data.wishlist[b].createdAt).getTime() -
			new Date(data.wishlist[a].createdAt).getTime(),
	)
	const titles = (
		await titlesOf(keys, library, (key) => iso(data.wishlist[key]?.createdAt))
	).map((t) => ({
		...t,
		score: null,
	}))
	return {
		watchNow: shell.viewer === "owner" ? await watchNow(ownerId, titles) : null,
		titles,
		total: keys.length,
	}
}

/** The owner's wishlist titles on their services, best match first (Q8). Empty without services. */
async function watchNow(
	ownerId: string,
	titles: ProfileTitle[],
): Promise<(ProfileTitle & { match: number | null })[]> {
	const ctx = await getMemberViewerContext(ownerId, "US")
	if (!ctx.services.length) return []
	const onServices = titles.filter(
		(t) =>
			isOnServices(
				ctx.country,
				ctx.services,
				titleKey(t.mediaType, t.tmdbId),
			) === true,
	)
	if (!onServices.length) return []
	const taste = await loadTaste(ctx.viewer)
	const keys = onServices.map((t) => titleKey(t.mediaType, t.tmdbId))
	const matches = taste.match(keys)
	const order = taste.percentile(keys)
	return onServices
		.map((t, i) => ({ ...t, match: matches[i], rank: order[i] ?? -1 }))
		.sort((a, b) => b.rank - a.rank)
		.slice(0, 12)
		.map(({ rank: _rank, ...t }) => t)
}

const GROUPS: ShowGroup[] = [
	"continue",
	"pickUp",
	"waiting",
	"start",
	"onHold",
	"dropped",
]

export async function loadProfileShows(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileShowsPage> {
	if (!canSee(shell.visibility, "shows", shell.viewer)) return { groups: [] }
	const shows = await ownerShows(ownerId)
	return {
		groups: GROUPS.map((group) => ({
			group,
			shows:
				group === "start"
					? shows.start.map((s) => ({
							...showTitle(s.id, s.title, s.poster_path, s.backdrop_path),
							watchedEpisodes: 0,
							airedEpisodes: s.episodes,
							next: null,
						}))
					: showRows(shows[group]),
		})).filter((g) => g.shows.length),
	}
}

export async function loadProfileLists(
	ownerId: string,
	shell: ProfileShell,
): Promise<ProfileListsPage> {
	if (!canSee(shell.visibility, "lists", shell.viewer)) return { lists: [] }
	return { lists: await listCards(ownerId, shell) }
}

/** The share lists the viewer may see, newest first: every list for the owner (with its visibility), public lists else. */
async function listCards(
	ownerId: string,
	shell: ProfileShell,
): Promise<ShareListSummary[]> {
	const owner = shell.viewer === "owner"
	const page = await getProfilePage(shell.handle)
	const lists = (owner ? await listsByUser(ownerId) : (page?.lists ?? [])).sort(
		(a, b) => b.createdAt.localeCompare(a.createdAt),
	)
	const titles: CardTitle[] = owner
		? await resolveCardTitles(lists.flatMap((l) => l.items))
		: (page?.titles ?? [])
	const byKey = new Map(titles.map((t) => [t.key, t]))
	return lists.map((list) => ({
		id: list.id,
		title: list.title,
		design: list.design,
		theme: list.theme,
		items: list.items
			.map((e) => byKey.get(entryKey(e)))
			.filter((t): t is CardTitle => t !== undefined),
		date: cardDate(new Date(list.createdAt)),
		...(owner ? { visibility: list.visibility } : {}),
	}))
}

// The owner's My shows, kept briefly: every visitor's Overview and Shows tab reads it.
const SHOWS_KEEP_MS = 2 * 60_000
const showsKept = new Map<string, { at: number; shows: Promise<MyShows> }>()

async function ownerShows(ownerId: string): Promise<MyShows> {
	const hit = showsKept.get(ownerId)
	if (hit && Date.now() - hit.at < SHOWS_KEEP_MS) return hit.shows
	const shows = (async () => {
		const ctx = await getMemberViewerContext(ownerId, "US")
		const taste = await loadTaste(ctx.viewer)
		return getMyShows({
			userId: ownerId,
			country: ctx.country,
			services: ctx.services,
			taste,
		})
	})()
	showsKept.set(ownerId, { at: Date.now(), shows })
	shows.catch(() => showsKept.delete(ownerId))
	if (showsKept.size > 2000) showsKept.clear()
	return shows
}

const showTitle = (
	id: number,
	title: string,
	poster: string | null,
	backdrop: string | null,
): ProfileTitle => {
	const key: MediaKey = `show-${id}`
	const { mediaType, tmdbId } = parseMediaKey(key)
	return {
		key,
		mediaType,
		tmdbId,
		title,
		year: null,
		poster,
		backdrop,
		href: titlePath(mediaType, tmdbId, title),
		score: null,
		gw: null,
		date: null,
	}
}

function showRows(rows: MyShowsRow[]) {
	return rows.map((row) => ({
		...showTitle(row.id, row.title, row.poster_path, row.backdrop_path),
		date:
			row.lastActivityAt == null
				? null
				: new Date(row.lastActivityAt).toISOString(),
		watchedEpisodes: row.watched,
		airedEpisodes: row.aired,
		next: row.next
			? `S${row.next.displaySeason ?? row.next.season} E${row.next.displayNumber ?? row.next.number}${row.next.name ? ` · ${row.next.name}` : ""}`
			: null,
	}))
}
