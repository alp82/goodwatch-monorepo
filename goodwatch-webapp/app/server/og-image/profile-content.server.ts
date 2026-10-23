// What the profile cards (/u/<handle>, /u/<handle>/<tab> and /u/<handle>/taste/<view>) show, as a signed-out visitor
// sees the profile: the same shell, tab loaders and portrait views the pages use, so a hidden part never reaches a
// card. A tab or view whose part is hidden or empty gets the main card. No counts and no viewer type (owner decision,
// 2026-10-23).
import sharp from "sharp"
import { type ProfileShell, seesPart } from "~/domain/profile"
import { readAvatar } from "~/server/profile/avatar.server"
import {
	loadProfileLists,
	loadProfileScores,
	loadProfileSeen,
	loadProfileShell,
	loadProfileShows,
	loadProfileWishlist,
} from "~/server/profile/page.server"
import { getProfilePortrait } from "~/server/profile/portrait.server"
import { getProfileSettings } from "~/server/profile/settings.server"
import { getTasteStats } from "~/server/profile/taste-stats.server"
import { familyOf } from "~/server/taste-portrait/families.server"
import type { PortraitTitle } from "~/server/taste-portrait/view"
import { AVATAR_GRADIENTS } from "~/ui/account/AccountAvatar"
import { PROFILE_CARD_COPY } from "~/ui/og-image/copy"
import {
	type CardAttribute,
	type CardPerson,
	type OgProfileContent,
	type OgProfileEveryoneContent,
	type OgProfileSidesContent,
	type OgProfileTabContent,
	PROFILE_CARD_TABS,
	PROFILE_CARD_VIEWS,
	type ProfileCardTab,
	type ProfileCardView,
	everyoneTakes,
	mediumWord,
	peakDecade,
	pickAttributes,
	pullWords,
	scoresLine,
	sidesPair,
} from "~/ui/og-image/profile-card-model"

const poster = (path: string | null | undefined) =>
	path
		? path.startsWith("http")
			? path
			: `https://image.tmdb.org/t/p/w342${path}`
		: null

/** The photo as a JPEG data URI: satori can't decode the WebP it's stored as. */
async function photoDataUri(userId: string): Promise<string | null> {
	const photo = await readAvatar(userId)
	if (!photo) return null
	const jpeg = await sharp(photo.data).jpeg({ quality: 85 }).toBuffer()
	return `data:image/jpeg;base64,${jpeg.toString("base64")}`
}

interface Loaded {
	ownerId: string
	shell: ProfileShell
	person: CardPerson
}

async function loadGuestView(handle: string): Promise<Loaded | null> {
	// No cookie: the profile as a signed-out visitor sees it.
	const loaded = await loadProfileShell(
		new Request(`https://goodwatch.app/u/${handle}`),
		handle,
	).catch((error) => {
		if (error instanceof Response) return null // 404
		throw error
	})
	if (!loaded || loaded instanceof Response) return null
	const { ownerId, shell } = loaded
	const settings = await getProfileSettings(ownerId)
	const gradient =
		AVATAR_GRADIENTS[shell.avatar.color] ?? AVATAR_GRADIENTS.amber
	const avatar =
		settings.avatar.kind === "photo" && shell.avatar.url
			? await photoDataUri(ownerId).catch(() => null)
			: shell.avatar.url
	return {
		ownerId,
		shell,
		person: {
			handle: shell.handle,
			avatar,
			avatarColors: [gradient.from, gradient.to, gradient.ink],
		},
	}
}

/** The fingerprint as the print draws it, or null when the taste is hidden or not formed. */
async function printOf({
	ownerId,
	shell,
}: Loaded): Promise<CardAttribute[] | null> {
	if (!seesPart(shell, "taste")) return null
	const view = await getProfilePortrait(ownerId, "fingerprint", {
		scores: seesPart(shell, "scores"),
	}).catch(() => null)
	if (!view || view.status !== "ready" || !view.attributes.length) return null
	return view.attributes.map((a) => ({
		key: a.key,
		label: a.label,
		family: a.family,
		edge: a.edge,
	}))
}

async function mainCard(view: Loaded): Promise<OgProfileContent> {
	const print = await printOf(view)
	const favorites = print
		? []
		: (await loadProfileScores(view.ownerId, view.shell)).tiers
				.filter((t) => t.score >= 9)
				.flatMap((t) => t.titles)
				.map((t) => poster(t.poster))
				.filter(Boolean)
				.slice(0, 6)
	return {
		kind: "profile",
		...view.person,
		print,
		picks: print ? pickAttributes(print) : [],
		posters: favorites,
	}
}

async function tabCard(
	view: Loaded,
	tab: ProfileCardTab,
): Promise<OgProfileTabContent | null> {
	const { ownerId, shell } = view
	const base = {
		kind: "profile-tab" as const,
		...view.person,
		title: PROFILE_CARD_COPY.tabs[tab],
	}
	switch (tab) {
		case "scores": {
			const line = scoresLine(shell.spread)
			if (!seesPart(shell, "scores") || !line) return null
			const { tiers } = await loadProfileScores(ownerId, shell)
			const best = tiers.filter((t) => t.score >= 9).flatMap((t) => t.titles)
			return {
				...base,
				line,
				visual: {
					type: "scores",
					spread: shell.spread,
					posters: best.slice(0, 6).map((t) => poster(t.poster)),
				},
			}
		}
		case "seen": {
			const { titles } = await loadProfileSeen(ownerId, shell)
			if (!titles.length || !shell.counts.seen) return null
			const movies = shell.counts.seenMovies / shell.counts.seen
			// The decade comes from the Taste tab's numbers (their rated titles), so it goes with the scores.
			const stats = seesPart(shell, "scores")
				? await getTasteStats(ownerId).catch(() => null)
				: null
			return {
				...base,
				line: PROFILE_CARD_COPY.seenLine(
					mediumWord(movies),
					peakDecade(stats?.eras.decades ?? []),
				),
				visual: {
					type: "posters",
					kicker: null,
					posters: titles.slice(0, 12).map((t) => poster(t.poster)),
					split: [
						{ name: PROFILE_CARD_COPY.movies, share: movies, color: "#fbbf24" },
						{
							name: PROFILE_CARD_COPY.shows,
							share: 1 - movies,
							color: "#38bdf8",
						},
					],
				},
			}
		}
		case "wishlist": {
			const { titles } = await loadProfileWishlist(ownerId, shell)
			if (!titles.length) return null
			return {
				...base,
				line: PROFILE_CARD_COPY.wishlistLine,
				visual: {
					type: "posters",
					kicker: PROFILE_CARD_COPY.latestAdditions,
					posters: titles.slice(0, 12).map((t) => poster(t.poster)),
					split: null,
				},
			}
		}
		case "shows": {
			const { groups } = await loadProfileShows(ownerId, shell)
			const group = groups.find((g) => g.group === "continue") ?? groups[0]
			if (!group?.shows.length) return null
			return {
				...base,
				line:
					group.group === "continue"
						? PROFILE_CARD_COPY.watchingLine
						: PROFILE_CARD_COPY.followingLine,
				visual: {
					type: "shows",
					shows: group.shows.slice(0, 6).map((s) => ({
						poster: poster(s.poster),
						progress: s.airedEpisodes
							? Math.min(1, s.watchedEpisodes / s.airedEpisodes)
							: 0,
					})),
				},
			}
		}
		case "lists": {
			const { lists } = await loadProfileLists(ownerId, shell)
			const shown = lists.filter((l) => l.items.length).slice(0, 2)
			if (!shown.length) return null
			return {
				...base,
				line: shown.map((l) => l.title).join(" · "),
				visual: {
					type: "lists",
					lists: shown.map((l) => ({
						title: l.title,
						posters: l.items.map((i) => poster(i.poster)),
					})),
				},
			}
		}
		case "taste": {
			const print = await printOf(view)
			if (!print) return null
			const sides = await getProfilePortrait(ownerId, "sides", {
				scores: seesPart(shell, "scores"),
			}).catch(() => null)
			const groups =
				sides?.status === "ready"
					? sides.sides.map((s) => ({
							name: s.name,
							size: s.count,
							average: seesPart(shell, "scores") ? s.average : null,
						}))
					: []
			const picks = pickAttributes(print)
			return {
				...base,
				line: PROFILE_CARD_COPY.tasteLine(pullWords(picks)),
				visual: { type: "taste", print, groups },
			}
		}
	}
}

/** A Taste tab section's card (the Taste tab's own rules: taste public, and scores for you vs everyone), or null. */
async function viewCard(
	view: Loaded,
	section: ProfileCardView,
): Promise<OgProfileEveryoneContent | OgProfileSidesContent | null> {
	const { ownerId, shell } = view
	if (!seesPart(shell, "taste")) return null
	const scores = seesPart(shell, "scores")
	const titleOf = (titles: Record<string, PortraitTitle>, key: number) =>
		titles[String(key)]
	if (section === "everyone") {
		// Without public scores the portrait has no rows, so there is no card; checked first to skip the load.
		if (!scores) return null
		const everyone = await getProfilePortrait(ownerId, "everyone", {
			scores,
		}).catch(() => null)
		if (!everyone) return null
		const rows = (list: typeof everyone.higher) =>
			list.map((r) => {
				const t = titleOf(everyone.titles, r.key)
				return {
					title: t?.title ?? "",
					poster: poster(t?.poster),
					mine: r.mine,
					everyone: r.everyone,
				}
			})
		const takes = everyoneTakes(
			{
				status: everyone.status,
				higher: rows(everyone.higher),
				lower: rows(everyone.lower),
			},
			scores,
		)
		return takes && { kind: "profile-everyone", ...view.person, takes }
	}
	const sides = await getProfilePortrait(ownerId, "sides", { scores }).catch(
		() => null,
	)
	if (!sides) return null
	const pair = sidesPair({
		status: sides.status,
		headline: sides.headline,
		sides: sides.sides.map((s) => ({
			id: s.id,
			name: s.name,
			// The group's colour is its first attribute's family, as on the Taste tab.
			family: familyOf(s.attributes[0]?.key ?? "") ?? "story",
			posters: s.here.map((key) => poster(titleOf(sides.titles, key)?.poster)),
		})),
	})
	return (
		pair && {
			kind: "profile-sides",
			...view.person,
			first: pair[0],
			second: pair[1],
		}
	)
}

/**
 * The card's content for a handle, a tab, and a Taste tab section (/u/<handle>/taste/<view>); null when no member has
 * the handle.
 */
export async function profileCardContent(
	handle: string,
	tab?: string,
	section?: string,
): Promise<
	| OgProfileContent
	| OgProfileTabContent
	| OgProfileEveryoneContent
	| OgProfileSidesContent
	| null
> {
	const view = await loadGuestView(handle)
	if (!view) return null
	if (section) {
		const known = PROFILE_CARD_VIEWS.find((v) => v === section)
		return (
			(tab === "taste" && known && (await viewCard(view, known))) ||
			mainCard(view)
		)
	}
	const known = PROFILE_CARD_TABS.find((t) => t === tab)
	return (known && (await tabCard(view, known))) || mainCard(view)
}
