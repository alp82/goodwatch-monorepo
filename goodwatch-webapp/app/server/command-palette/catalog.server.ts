import { BRANDS } from "~/domain/new-on-services"
import { parseVisibility } from "~/domain/profile"
import { parseAvatarChoice } from "~/domain/profile-settings"
import { searchStatement } from "~/server/combined-search/catalog.server"
import { resolveAvatar } from "~/server/profile/avatar-choice.server"
import { publicProfileSearchable } from "~/server/profile/search-eligibility.server"
import { runsSearch } from "~/server/role.server"
import {
	palettePeopleSnapshot,
	startPeopleIndex,
} from "~/server/search-people/people.server"
import { type Entry, discover, excerpt } from "./matching.server"

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
const loaders = {
	async tropes(): Promise<Entry[]> {
		const [catalog, totals] = await Promise.all([
			rows<[string, string, string | null]>(
				"SELECT name, url, substr(description, 1, 1000) FROM trope_catalog LIMIT 100000",
			),
			rows<[string, number]>(
				"SELECT url, count(*) FROM trope WHERE url IS NOT NULL GROUP BY url LIMIT 200000",
			),
		])
		const counts = new Map(totals)
		const seen = new Set<string>()
		return catalog.flatMap(([name, url, description]) => {
			const count = counts.get(url) ?? 0
			if (!count || seen.has(url)) return []
			seen.add(url)
			return [
				{
					names: [name],
					popularity: count,
					item: {
						key: `trope-${url}`,
						label: name,
						sub: [
							excerpt(description),
							`${count.toLocaleString("en-US")} titles`,
						]
							.filter(Boolean)
							.join(" · "),
						href: discover({ q: name }),
					},
				},
			]
		})
	},
	async genres(): Promise<Entry[]> {
		const found = await rows<[string, string]>(
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
		const found = await rows<[number, string, string | null, number | null]>(
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
		const [series, films] = await Promise.all([
			rows<[number, string, string | null]>(
				"SELECT tmdb_id, name, poster_path FROM movie_series LIMIT 50000",
			),
			rows<[number, string, number | null]>(
				"SELECT movie_series_id, title, release_year FROM movie WHERE movie_series_id IS NOT NULL ORDER BY release_year, tmdb_id LIMIT 200000",
			),
		])
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
		const [profiles, settings, totals] = await Promise.all([
			rows<[string, string, string | number | null]>(
				"SELECT user_id, handle, created_at FROM user_profile WHERE handle IS NOT NULL AND deleted_at IS NULL LIMIT 100000",
			),
			rows<[string, string, string]>(
				"SELECT user_id, key, value FROM user_setting WHERE key IN ('profile_visibility', 'profile_public_notice_seen', 'profile_avatar', 'profile_provider_photo') LIMIT 500000",
			),
			rows<[string, number]>(
				"SELECT user_id, count(*) FROM user_score GROUP BY user_id LIMIT 100000",
			),
		])
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
				)
				return {
					names: [handle, handle.replace(/_/g, " ")],
					popularity: 1,
					item: {
						key: `member-${handle}`,
						label: `@${handle}`,
						href: `/u/${handle}`,
						image: { kind: "avatar", path: avatar.url ?? undefined },
					},
				}
			}),
		)
	},
}
export type CatalogKey = keyof typeof loaders
const state = new Map<
	CatalogKey,
	{ entries: Entry[]; at: number; pending?: Promise<void>; retryAt: number }
>()
let revision = 0
export const catalogVersion = () =>
	`${revision}:${palettePeopleSnapshot().length}:${[...state]
		.filter(([, value]) => value.at > 0)
		.map(([key]) => key)
		.sort()
		.join(",")}`
/** No request waits on a catalog read. Replace whole snapshots, retaining old data on transient failures. */
export function catalogEntries(key: CatalogKey): Entry[] {
	let entry = state.get(key)
	if (!entry) {
		entry = { entries: [], at: 0, retryAt: 0 }
		state.set(key, entry)
	}
	const age = key === "members" ? 60_000 : 6 * 60 * 60_000
	if (
		runsSearch() &&
		!entry.pending &&
		Date.now() - entry.at > age &&
		Date.now() >= entry.retryAt
	) {
		const current = entry
		entry.pending = loaders[key]()
			.then((entries) => {
				current.entries = entries
				current.at = Date.now()
				revision++
			})
			.catch(() => {
				console.warn(
					`Palette ${key} index refresh failed; retrying in one minute`,
				)
				current.retryAt = Date.now() + 60_000
			})
			.finally(() => {
				current.pending = undefined
			})
	}
	// Fail closed when a member snapshot cannot refresh; don't keep exposing stale privacy decisions.
	return key === "members" && Date.now() - entry.at > 120_000
		? []
		: entry.entries
}
export function startPaletteCatalog() {
	startPeopleIndex()
	for (const key of Object.keys(loaders) as CatalogKey[]) catalogEntries(key)
}
if (runsSearch()) {
	startPaletteCatalog()
	const timer = setInterval(startPaletteCatalog, 60_000)
	timer.unref()
}
