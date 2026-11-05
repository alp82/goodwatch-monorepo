import { createHash } from "node:crypto"
// Whole palette catalog snapshots, refreshed serially in the background; requests only read memory.
// Spec: docs/implementation/grouped-search-panel.md
import { BRANDS } from "~/domain/new-on-services"
import { parseVisibility } from "~/domain/profile"
import { asMediaKey, parseAvatarChoice } from "~/domain/profile-settings"
import { searchStatement } from "~/server/combined-search/catalog.server"
import { resolveAvatar } from "~/server/profile/avatar-choice.server"
import { publicProfileSearchable } from "~/server/profile/search-eligibility.server"
import { runsSearch } from "~/server/role.server"
import {
	palettePeopleSnapshot,
	startPeopleIndex,
} from "~/server/search-people/people.server"
import { parseMediaKey } from "~/types/user-data"
import { backgroundStatement, scheduleCatalog } from "./background.server"
import { type Entry, discover } from "./matching.server"
import { tropeEntries } from "./tropes.server"

/** SELECT only; the catalog transport avoids logging row contents or queries per request. */
export async function rows<T extends unknown[]>(sql: string): Promise<T[]> {
	if (!/^SELECT\b/i.test(sql))
		throw new Error("Palette catalog must be read-only")
	return (await searchStatement(sql)).rows as T[]
}
function json(raw: string | undefined): unknown {
	try {
		return raw ? JSON.parse(raw) : undefined
	} catch {
		return undefined
	}
}
async function backgroundRows<T extends unknown[]>(sql: string): Promise<T[]> {
	return (await backgroundStatement(sql)).rows as T[]
}
const loaders = {
	async tropes(): Promise<Entry[]> {
		const [catalog, totals, pages] = [
			await backgroundRows<[string, string, string | null]>(
				"SELECT name, url, substr(description, 1, 300) FROM trope_catalog LIMIT 100000",
			),
			await backgroundRows<[string, number]>(
				"SELECT url, count(*) FROM trope WHERE url IS NOT NULL GROUP BY url LIMIT 200000",
			),
			await backgroundRows<[string, string | null]>(
				"SELECT url, title FROM trope_catalog_page LIMIT 100000",
			),
		]
		return tropeEntries(catalog, new Map(totals), new Map(pages))
	},
	async genres(): Promise<Entry[]> {
		const found = await backgroundRows<[string, string]>(
			"SELECT name, media_type FROM genre LIMIT 1000",
		)
		const types = new Map<string, Set<string>>()
		for (const [name, type] of found)
			types.set(name, (types.get(name) ?? new Set()).add(type))
		return [...types].map(([name, set]) => ({
			names: [name],
			popularity: 1,
			item: {
				key: `genre-${name}`,
				label: name,
				sub:
					set.size > 1
						? "Movies and shows"
						: set.has("movie")
							? "Movies only"
							: "Shows only",
				href: discover({ genres: name, services: "all" }),
			},
		}))
	},
	async services(): Promise<Entry[]> {
		const found = await backgroundRows<
			[number, string, string | null, number | null]
		>(
			"SELECT tmdb_id, name, logo_path, order_default FROM streaming_service LIMIT 10000",
		)
		const byId = new Map<
			number,
			{ name: string; logo: string | null; order: number }
		>()
		for (const [id, name, logo, order] of found)
			if (!byId.has(id) || (order ?? 999) < (byId.get(id)?.order ?? 999))
				byId.set(id, { name, logo, order: order ?? 999 })
		const branded = new Set(BRANDS.flatMap((b) => b.ids))
		const names = new Set(BRANDS.map((b) => b.name.toLowerCase()))
		const entries: Entry[] = BRANDS.map((b) => ({
			names: [b.name, b.slug],
			popularity: 1000,
			item: {
				key: `brand-${b.slug}`,
				label: b.name,
				href: `/new/${b.slug}`,
				image: { kind: "logo", path: byId.get(b.logo)?.logo ?? undefined },
			},
		}))
		for (const [id, service] of byId) {
			if (branded.has(id) || names.has(service.name.toLowerCase())) continue
			names.add(service.name.toLowerCase())
			entries.push({
				names: [service.name],
				popularity: -service.order,
				item: {
					key: `service-${id}`,
					label: service.name,
					href: discover({ services: String(id) }),
					image: { kind: "logo", path: service.logo ?? undefined },
				},
			})
		}
		return entries
	},
	async sequels(): Promise<Entry[]> {
		const [series, films] = [
			await backgroundRows<[number, string, string | null]>(
				"SELECT tmdb_id, name, poster_path FROM movie_series LIMIT 50000",
			),
			await backgroundRows<[number, string, number | null]>(
				"SELECT movie_series_id, title, release_year FROM movie WHERE movie_series_id IS NOT NULL ORDER BY release_year, tmdb_id LIMIT 200000",
			),
		]
		const byId = new Map<number, { title: string; year: number | null }[]>()
		for (const [id, title, year] of films) {
			const list = byId.get(id) ?? []
			list.push({ title, year })
			byId.set(id, list)
		}
		return series.map(([id, name, poster]) => {
			const list = byId.get(id) ?? []
			const years = list.flatMap((f) => (f.year == null ? [] : [f.year]))
			const span = years.length
				? `${years[0]}${years[0] === years.at(-1) ? "" : `–${years.at(-1)}`}`
				: ""
			const label = name.replace(/ Collection$/, "")
			return {
				names: [name, label],
				popularity: list.length,
				item: {
					key: `sequel-${id}`,
					label,
					sub: list.length
						? `${list.length} film${list.length === 1 ? "" : "s"}${span ? `, ${span}` : ""}: ${list
								.slice(0, 3)
								.map((f) => f.title)
								.join(", ")}${list.length > 3 ? ", …" : ""}`
						: undefined,
					href: discover({ q: label.replace(/^The /, "") }),
					image: { kind: "poster" as const, path: poster ?? undefined },
				},
			}
		})
	},
	async members(): Promise<Entry[]> {
		const [profiles, settings, totals, versions] = [
			await backgroundRows<[string, string, string | number | null]>(
				"SELECT user_id, handle, created_at FROM user_profile WHERE handle IS NOT NULL AND deleted_at IS NULL LIMIT 100000",
			),
			await backgroundRows<[string, string, string]>(
				"SELECT user_id, key, value FROM user_setting WHERE key IN ('profile_visibility', 'profile_public_notice_seen', 'profile_avatar', 'profile_provider_photo') LIMIT 500000",
			),
			await backgroundRows<[string, number]>(
				"SELECT user_id, count(*) FROM user_score WHERE user_id IN (SELECT user_id FROM user_profile WHERE handle IS NOT NULL) GROUP BY user_id LIMIT 100000",
			),
			await backgroundRows<[string, string]>(
				"SELECT user_id, version FROM doc.user_avatar LIMIT 100000",
			),
		]
		const avatarVersions = new Map(versions)
		const byUser = new Map<string, Record<string, string>>()
		for (const [id, key, value] of settings) {
			const map = byUser.get(id) ?? {}
			map[key] = value
			byUser.set(id, map)
		}
		const counts = new Map(totals)
		const eligible = profiles.flatMap(([id, handle, created]) => {
			const stored = byUser.get(id) ?? {}
			// Exactly the guest-search eligibility from profile/page.server.ts readProfileShell (shell.indexable).
			if (
				!publicProfileSearchable(
					parseVisibility(json(stored.profile_visibility)),
					counts.get(id) ?? 0,
					created == null ? null : new Date(created).toISOString(),
					stored.profile_public_notice_seen === "yes",
				)
			)
				return []
			return [{ id, handle, stored }]
		})
		const posterChoices = eligible.flatMap(({ stored }) => {
			const choice = parseAvatarChoice(json(stored.profile_avatar))
			const key = choice?.kind === "poster" ? asMediaKey(choice.title) : null
			return key ? [parseMediaKey(key)] : []
		})
		const posters = new Map<string, string>()
		for (const type of ["movie", "show"] as const) {
			const ids = [
				...new Set(
					posterChoices
						.filter((k) => k.mediaType === type)
						.map((k) => k.tmdbId),
				),
			]
			if (!ids.length) continue
			const found = await backgroundRows<[number, string | null]>(
				`SELECT tmdb_id, poster_path FROM ${type} WHERE tmdb_id IN (${ids.join(",")}) LIMIT ${ids.length}`,
			)
			for (const [id, poster] of found)
				if (poster) posters.set(`${type}-${id}`, poster)
		}
		return Promise.all(
			eligible.map(async ({ id, handle, stored }): Promise<Entry> => {
				const choice = parseAvatarChoice(json(stored.profile_avatar)) ?? {
					kind: "initial",
					color: "amber",
				}
				const avatar = await resolveAvatar(
					id,
					handle,
					choice,
					stored.profile_provider_photo ?? null,
					{
						photoVersion: avatarVersions.get(id) ?? null,
						poster:
							choice.kind === "poster"
								? (posters.get(choice.title) ?? null)
								: null,
					},
				)
				return {
					names: [handle, handle.replace(/_/g, " ")],
					popularity: 1,
					item: {
						key: `member-${handle}`,
						label: `@${handle}`,
						href: `/u/${handle}`,
						image: {
							kind: "avatar",
							path: avatar.url ?? undefined,
							hue: avatar.color,
							initial: handle[0]?.toUpperCase(),
						},
					},
				}
			}),
		)
	},
}
export type CatalogKey = keyof typeof loaders
const state = new Map<
	CatalogKey,
	{ entries: Entry[]; at: number; digest: string }
>()
const digest = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex")
let peopleSnapshot: ReturnType<typeof palettePeopleSnapshot> | undefined
let peopleDigest = ""
export function catalogVersion() {
	const people = palettePeopleSnapshot()
	if (people !== peopleSnapshot) {
		peopleSnapshot = people
		peopleDigest = digest(people)
	}
	return `${peopleDigest}:${[...state]
		.map(
			([key, value]) =>
				`${key}:${key === "members" && Date.now() - value.at > 10 * 60_000 ? "expired" : value.digest}`,
		)
		.sort()
		.join(",")}`
}
/** Requests never launch or wait for a catalog read. Old member privacy decisions expire after ten minutes. */
export function catalogEntries(key: CatalogKey): Entry[] {
	const snapshot = state.get(key)
	return !snapshot ||
		(key === "members" && Date.now() - snapshot.at > 10 * 60_000)
		? []
		: snapshot.entries
}
export function popularTropes() {
	return [...catalogEntries("tropes")]
		.sort(
			(a, b) =>
				b.popularity - a.popularity || a.item.key.localeCompare(b.item.key),
		)
		.slice(0, 12)
		.map((entry) => ({ ...entry.item, match: 1 }))
}
export function startPaletteCatalog() {
	for (const key of [
		"genres",
		"services",
		"members",
		"tropes",
		"sequels",
	] as const) {
		// Page roles need only the before-typing Tropes tab.
		if (!runsSearch() && key !== "tropes") continue
		const interval =
			key === "members"
				? 5 * 60_000
				: key === "genres" || key === "services"
					? 60 * 60_000
					: 6 * 60 * 60_000
		scheduleCatalog(key, interval, async () => {
			const entries = await loaders[key]()
			entries.sort((a, b) => a.item.key.localeCompare(b.item.key))
			const content = digest(entries)
			const old = state.get(key)
			state.set(key, {
				entries: old?.digest === content ? old.entries : entries,
				digest: content,
				at: Date.now(),
			})
		})
	}
	startPeopleIndex()
}
startPaletteCatalog()
