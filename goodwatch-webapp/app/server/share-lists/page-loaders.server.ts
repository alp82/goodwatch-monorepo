import { type LoaderFunctionArgs, json, redirect } from "@remix-run/node"
import { resolveCountry } from "~/server/country.server"
import type { RowService, ownServicesOf } from "~/server/row-services.server"
import type { ensureShareCard } from "~/server/share-card/images.server"
import type { getUserSettings } from "~/server/user-settings.server"
import { createMediaKey } from "~/types/user-data"
import { designByKey } from "~/ui/share-card/designs"
import {
	profilePath,
	publicOrigin,
	shareCardPreviewPath,
	shareCardPreviewSize,
	shareListPath,
} from "~/ui/share-card/links"
import { type CardTitle, cardDate, listByline } from "~/ui/share-card/model"
import type { ShareListSummary } from "~/ui/share-lists/ShareListTile"
import type { getUserIdFromRequest } from "~/utils/auth"
import { SHARE_LIST_PAGE_CACHE_CONTROL } from "~/utils/auth-cookie"
import { duplicateProviderMapping } from "~/utils/streaming-links"
import type { getOwnerScores } from "./owner-scores.server"
import type { getListView, listsByUser } from "./store.server"
import { entryKey, type resolveCardTitles } from "./titles.server"
import type { getProfilePage } from "./view.server"

// A list or profile can come back, so never cache a missing page.
const notFound = () =>
	new Response("Not found", {
		status: 404,
		headers: { "Cache-Control": "private, no-store" },
	})

type ShareListDependencies = {
	getListView: typeof getListView
	ensureShareCard: typeof ensureShareCard
	getUserIdFromRequest: typeof getUserIdFromRequest
	getUserSettings: typeof getUserSettings
	getOwnServices: typeof ownServicesOf
	getOwnerScores: typeof getOwnerScores
}

export function createShareListPageLoader(deps: ShareListDependencies) {
	return async ({ params, request }: LoaderFunctionArgs) => {
		const view = await deps.getListView(params.id ?? "")
		if (!view) throw notFound()
		deps.ensureShareCard(view)
		const { list, owner, titles: items } = view
		if (params.handle !== owner.handle)
			return redirect(shareListPath(owner.handle, list.id), 301)

		const viewerId = await deps.getUserIdFromRequest({ request })
		// Settings only refine the page (country, the viewer's services); the list still shows without them.
		const settings = viewerId
			? await deps.getUserSettings({ userId: viewerId }).catch((error) => {
					console.error("[share-list] user settings failed", error)
					return null
				})
			: null
		const { country } = resolveCountry({
			request,
			countryDefault: settings?.country_default,
		})
		// The rows show only the viewer's own services that stream a title, as every list of titles does: a guest and a
		// member without saved services see none, and the offers aren't read for them.
		const owned = new Set(
			(settings?.streaming_providers_default ?? "")
				.split(",")
				.filter(Boolean)
				.map(Number)
				.flatMap((id) => [id, ...(duplicateProviderMapping[id] ?? [])]),
		)
		const isOwner = viewerId === list.userId
		const [own, ownerScores] = await Promise.all([
			owned.size
				? deps
						.getOwnServices(
							{ country, services: [...owned] },
							list.items.map((e) => ({
								mediaType: e.media_type,
								tmdbId: e.tmdb_id,
							})),
						)
						.catch((error) => {
							console.error("[share-list] own services failed", error)
							return null
						})
				: null,
			// On someone else's list, the owner's score ends each row (as far as their profile shows it).
			isOwner
				? null
				: deps
						.getOwnerScores(
							list.userId,
							viewerId ? "member" : "guest",
							list.items,
						)
						.catch((error) => {
							console.error("[share-list] owner scores failed", error)
							return null
						}),
		])
		// Keyed by the list's own title keys ("movie:603").
		const services: Record<string, RowService[]> | null = own && {}
		if (own && services)
			for (const e of list.items) {
				const mine = own[createMediaKey(e.media_type, e.tmdb_id)]
				if (mine?.length) services[entryKey(e)] = mine
			}

		const design = designByKey(list.design)
		const origin = publicOrigin()
		const byline = listByline(owner.handle)
		return json(
			{
				list: {
					id: list.id,
					title: list.title,
					design: design.key,
					theme: list.theme,
					byline,
					date: cardDate(new Date(list.createdAt)),
					unlisted: list.visibility === "unlisted",
				},
				items,
				services,
				ownerScores,
				country,
				owner: { handle: owner.handle },
				isOwner,
				share: {
					url: `${origin}${shareListPath(owner.handle, list.id)}`,
					image: `${origin}${shareCardPreviewPath(list)}`,
					...shareCardPreviewSize(design),
				},
			},
			// Only anonymous public views share the short lifetime. Members and hidden lists stay private.
			{
				headers: {
					"Cache-Control":
						list.visibility === "public" && viewerId == null
							? SHARE_LIST_PAGE_CACHE_CONTROL
							: "private, no-store",
				},
			},
		)
	}
}

type ProfileDependencies = {
	getProfilePage: typeof getProfilePage
	getUserIdFromRequest: typeof getUserIdFromRequest
	listsByUser: typeof listsByUser
	resolveCardTitles: typeof resolveCardTitles
}

export function createProfilePageLoader(deps: ProfileDependencies) {
	return async ({ params, request }: LoaderFunctionArgs) => {
		const requested = params.handle ?? ""
		const page = await deps.getProfilePage(requested)
		if (!page) throw notFound()
		const { profile } = page
		if (requested !== profile.handle)
			return redirect(profilePath(profile.handle), 301)

		const viewerId = await deps.getUserIdFromRequest({ request })
		const isOwner = viewerId === profile.userId
		// Newest first for everyone, so the grid doesn't reorder when the owner changes a list.
		const lists = (
			isOwner ? await deps.listsByUser(profile.userId) : page.lists
		).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		// One catalog lookup for every card on the page.
		const titles = isOwner
			? await deps.resolveCardTitles(
					lists.flatMap((list) =>
						list.isCollection ? list.items.slice(0, 5) : list.items,
					),
				)
			: page.titles
		const byKey = new Map(titles.map((t) => [t.key, t]))
		const summaries: ShareListSummary[] = lists.map((list) => ({
			id: list.id,
			title: list.title,
			...(list.isCollection
				? { collection: true, itemCount: list.itemCount ?? list.items.length }
				: {}),
			design: list.design,
			theme: list.theme,
			items: (list.isCollection ? list.items.slice(0, 5) : list.items)
				.map((e) => byKey.get(entryKey(e)))
				.filter((t): t is CardTitle => t !== undefined),
			date: cardDate(new Date(list.createdAt)),
			...(isOwner ? { visibility: list.visibility } : {}),
		}))
		return json(
			{
				profile: { handle: profile.handle },
				lists: summaries,
				isOwner,
			},
			// Anonymous views share the short lifetime (see docs/page-cache.md). Member views stay private.
			{
				headers: {
					"Cache-Control":
						viewerId == null
							? SHARE_LIST_PAGE_CACHE_CONTROL
							: "private, no-store",
				},
			},
		)
	}
}
