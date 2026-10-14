import {
	orderedMediaSave,
	currentMediaSaveRecord,
} from "./media-save-order.server.ts"
import { MediaPreferencesConflict } from "./media-preferences-store.server.ts"
import { randomUUID } from "node:crypto"
import {
	cacheContextState,
	cacheIdentity,
	requestLocale,
} from "./cache-identity.server.ts"
import { getUserSettings, resetUserSettingsCache } from "./user-settings.server"
import {
	readMediaPreferences,
	writeMediaPreferences,
} from "./media-preferences-store.server.ts"
import {
	parseLocalizationCookie,
	resolveEffectiveMediaContext,
	serializeLocalizationCookie,
	signInAdoption,
	type LocalizationRecord,
	type SaveLocalizationRequest,
	type SaveLocalizationResponse,
} from "../utils/media-language.ts"

/** Members bypass shared page caches; guests use the same pure cookie/header rule before cache lookup. */
const contexts = new WeakMap<
	Request,
	Map<string, Promise<Awaited<ReturnType<typeof resolveOnce>>>>
>()
export function resolveMediaContext(request: Request, userId?: string | null) {
	let byUser = contexts.get(request)
	if (!byUser) {
		byUser = new Map()
		contexts.set(request, byUser)
	}
	const key = userId ?? ""
	const remembered = byUser.get(key)
	if (remembered) return remembered
	const result = resolveOnce(request, userId)
	byUser.set(key, result)
	return result
}

async function resolveOnce(request: Request, userId?: string | null) {
	const cookie = parseLocalizationCookie(request.headers.get("Cookie"))
	let account: LocalizationRecord | null = userId
		? (await readMediaPreferences(userId)).record
		: null
	const adoption = userId ? signInAdoption(account, cookie) : null
	if (userId && adoption) {
		account = await writeMediaPreferences(userId, adoption, { adoptOnly: true })
		await invalidateMediaSettings(userId)
	}
	const settings = userId ? await getUserSettings({ userId }) : null
	const fallback = requestLocale(request)
	const fallbackState = cacheContextState(
		cacheIdentity(request),
		request.headers.get("Accept-Language"),
	)
	const effectiveContext = resolveEffectiveMediaContext({
		account,
		cookie,
		browserLanguages:
			!account && !cookie && fallback.source === "identity-header"
				? fallback.language
				: request.headers.get("Accept-Language"),
		urlCountry: new URL(request.url).searchParams.get("country"),
		legacyCountry: settings?.country_default,
		fallbackCountry: fallback.country,
		fallbackCountryProvenance: fallbackState.countryProvenance,
	})
	const record = account ?? cookie
	return {
		effectiveContext,
		record,
		setCookie:
			account && JSON.stringify(account) !== JSON.stringify(cookie)
				? serializeLocalizationCookie(account, mediaCookieIsSecure(request))
				: null,
	}
}

export async function saveMediaPreferences(
	request: Request,
	userId: string | null | undefined,
	input: SaveLocalizationRequest,
): Promise<{
	response: SaveLocalizationResponse
	setCookie: string
}> {
	return orderedMediaSave(
		userId ? `member:${userId}` : "guest",
		input.clientId,
		input.sequence,
		async (isLatest, remember) => {
			const writer = { clientId: input.clientId, sequence: input.sequence }
			const cookie = await currentSavedMediaPreferences(
				request,
				null,
				input.clientId,
			)
			if (
				!userId &&
				input.expectedVersion !== undefined &&
				input.expectedVersion !== (cookie?.version ?? null) &&
				cookie?.writer?.clientId !== input.clientId
			)
				throw new MediaPreferencesConflict()
			if (!userId && cookie?.writer?.clientId === input.clientId) {
				if (
					input.sequence < cookie.writer.sequence ||
					(input.sequence === cookie.writer.sequence &&
						(input.pair.country !== cookie.country ||
							input.pair.language !== cookie.language))
				)
					throw new MediaPreferencesConflict()
			}
			if (!isLatest()) throw new MediaPreferencesConflict()
			const record = userId
				? await writeMediaPreferences(userId, input.pair, {
						expectedVersion: input.expectedVersion,
						writer,
					})
				: cookie?.writer?.clientId === input.clientId &&
						cookie.writer.sequence === input.sequence
					? cookie
					: {
							...input.pair,
							schemaVersion: 1 as const,
							version: randomUUID(),
							writer,
						}
			remember(record)
			if (userId) {
				await invalidateMediaSettings(userId)
				// Another instance can supersede the row while cache invalidation is in flight.
				if (
					(await readMediaPreferences(userId)).record?.version !==
					record.version
				)
					throw new MediaPreferencesConflict()
			}
			const { country, language, version } = record
			return {
				response: {
					pair: { country, language },
					version,
					sequence: input.sequence,
					destination: userId ? "account" : "device",
					effectiveContext: resolveEffectiveMediaContext({
						...(userId ? { account: record } : { cookie: record }),
						browserLanguages: request.headers.get("Accept-Language"),
					}),
				},
				setCookie: serializeLocalizationCookie(
					record,
					mediaCookieIsSecure(request),
				),
			}
		},
	)
}

// A cache failure after a confirmed atomic write must not turn success into a misleading save failure.
async function invalidateMediaSettings(userId: string) {
	try {
		await resetUserSettingsCache({ user_id: userId })
	} catch (error) {
		console.error(
			"Saved media preferences; settings cache invalidation failed:",
			error,
		)
	}
}

export async function currentSavedMediaPreferences(
	request: Request,
	userId: string | null | undefined,
	clientId: string,
) {
	if (userId) return (await readMediaPreferences(userId)).record
	const cookie = parseLocalizationCookie(request.headers.get("Cookie"))
	const remembered = currentMediaSaveRecord("guest", clientId)
	if (!remembered || (cookie?.writer && cookie.writer.clientId !== clientId))
		return cookie
	if (
		cookie?.writer?.clientId === clientId &&
		cookie.writer.sequence > (remembered.writer?.sequence ?? 0)
	)
		return cookie
	return remembered
}

// The public request is HTTPS in production even when Coolify forwards HTTP to Remix.
function mediaCookieIsSecure(request: Request): boolean {
	return (
		process.env.NODE_ENV === "production" ||
		/^https:/i.test(process.env.APP_ORIGIN || request.url)
	)
}
