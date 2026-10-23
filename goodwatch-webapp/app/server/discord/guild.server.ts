import { within } from "./respond.server.ts"
export interface GuildSettings {
	guild_id: string
	country: string
	service_ids: number[]
	digest_channel_id: string | null
	updated_by: string
	updated_at: number
}
const cacheOptions = {
	name: "discord-guild-v1",
	ttlMinutes: 5,
	staleMinutes: 0,
}
export interface GuildStorage {
	read: (id: string) => Promise<GuildSettings | null>
	write: (settings: GuildSettings) => Promise<void>
	cached: (
		id: string,
		target: () => Promise<GuildSettings | null>,
	) => Promise<GuildSettings | null>
	reset: (id: string) => Promise<boolean>
	log: (line: string) => void
}
const runtime: GuildStorage = {
	read: async (id) => {
		const { query } = await import("../../utils/crate")
		return (
			(
				await query<GuildSettings>(
					"SELECT guild_id, country, service_ids, digest_channel_id, updated_by, updated_at FROM discord_guild WHERE guild_id = ?",
					[id],
				)
			)[0] ?? null
		)
	},
	write: async (s) => {
		const { execute } = await import("../../utils/crate")
		await execute(
			`INSERT INTO discord_guild (guild_id, country, service_ids, digest_channel_id, updated_by, updated_at)
   VALUES (?, ?, CAST(? AS ARRAY(INTEGER)), NULLIF(?, ''), ?, ?) ON CONFLICT (guild_id) DO UPDATE SET
   country = excluded.country, service_ids = excluded.service_ids, digest_channel_id = excluded.digest_channel_id,
   updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
			[
				s.guild_id,
				s.country,
				s.service_ids as unknown as string, // Crate supports array parameters; the shared wrapper type omits them.
				s.digest_channel_id ?? "",
				s.updated_by,
				s.updated_at,
			],
		)
	},
	cached: async (id, target) => {
		const { cached, declareResettableCache } = await import("../../utils/cache")
		declareResettableCache(cacheOptions)
		const result = await cached({
			...cacheOptions,
			params: { guildId: id },
			target: async () => ({ settings: await target() }),
		})
		return result.settings
	},
	reset: async (id) => {
		const { resetCacheConfirmed, declareResettableCache } = await import(
			"../../utils/cache"
		)
		declareResettableCache(cacheOptions)
		return resetCacheConfirmed({
			name: cacheOptions.name,
			params: { guildId: id },
		})
	},
	log: (line) => console.warn(line),
}
export function createGuildStore(storage: GuildStorage) {
	let available = true,
		logged = false
	const missing = (error: unknown) => {
		const message = error instanceof Error ? error.message : String(error)
		if (
			!/discord_guild/i.test(message) ||
			!/RelationUnknown|unknown relation|does not exist/i.test(message)
		)
			return false
		available = false
		if (!logged) {
			storage.log("DISCORD: discord_guild table unavailable")
			logged = true
		}
		return true
	}
	return {
		available: () => available,
		get: async (id: string): Promise<GuildSettings | null> => {
			try {
				return await within(
					storage.cached(id, async () => {
						const row = await storage.read(id)
						available = true
						return row
					}),
					600,
					null,
				)
			} catch (error) {
				if (!missing(error)) storage.log("DISCORD: guild settings read failed")
				return null
			}
		},
		save: async (settings: GuildSettings): Promise<boolean> => {
			try {
				const written = await within(
					storage.write(settings).then(() => true),
					2000,
					false,
				)
				if (!written) return false
				available = true
				try {
					if (!(await within(storage.reset(settings.guild_id), 300, false)))
						storage.log("DISCORD: guild settings cache reset failed")
				} catch {
					storage.log("DISCORD: guild settings cache reset failed")
				}
				return true
			} catch (error) {
				if (!missing(error)) storage.log("DISCORD: guild settings write failed")
				return false
			}
		},
	}
}
const store = createGuildStore(runtime)
export const getGuildSettings = store.get
export const saveGuildSettings = store.save
export const guildSettingsAvailable = store.available
