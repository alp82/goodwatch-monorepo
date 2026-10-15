import { setTimeout as delay } from "node:timers/promises"
import { z } from "zod"
import {
	IMPORT_MAX_ROWS,
	type ImportObservation,
	type ParsedImport,
} from "../../domain/imports.ts"
import {
	TMDB_TIMEOUT_DEFAULT_MS,
	timeoutSetting,
	withBackendTimeout,
} from "../../utils/backend-timeout.ts"

/** Only fixed messages cross this boundary: fetch errors and TMDB bodies can contain credentials. */
export class TmdbError extends Error {
	readonly status: number
	retryAfterMs?: number
	code?: number
	constructor(
		message = "TMDB could not complete this connection. Please try again.",
		status = 502,
	) {
		super(message)
		this.status = status
	}
}
const isMissingToken = (error: unknown): error is TmdbError =>
	error instanceof TmdbError &&
	((error.status === 401 && error.code === 35) ||
		(error.status === 404 && error.code === 37))
const ratingDate = z.string().datetime({ offset: true })
const pageSchema = z.object({
	page: z.number().int().positive(),
	total_pages: z.number().int().nonnegative(),
	total_results: z.number().int().nonnegative(),
	results: z.array(
		z.object({
			id: z.number().int().positive(),
			title: z.string().optional(),
			name: z.string().optional(),
			release_date: z.string().optional(),
			first_air_date: z.string().optional(),
			account_rating: z
				.object({ value: z.unknown(), created_at: z.unknown().optional() })
				.optional(),
		}),
	),
})

export function createTmdbClient(options: {
	appToken: string
	fetch?: typeof fetch
	sleep?: (ms: number) => Promise<unknown>
}) {
	const send = options.fetch ?? fetch
	const sleep = options.sleep ?? delay
	async function request(
		path: string,
		token: string,
		method = "GET",
		body?: object,
		version: 3 | 4 = 4,
	): Promise<unknown> {
		for (let attempt = 0; ; attempt++) {
			let wait = 0
			try {
				return await withBackendTimeout(
					"TMDB",
					timeoutSetting("TMDB_TIMEOUT_MS", TMDB_TIMEOUT_DEFAULT_MS),
					async (signal) => {
						const response = await send(
							`https://api.themoviedb.org/${version}/${path}`,
							{
								method,
								signal,
								redirect: "error",
								headers: {
									Authorization: `Bearer ${token}`,
									"Content-Type": "application/json",
								},
								...(body ? { body: JSON.stringify(body) } : {}),
							},
						)
						if (response.status === 429) {
							const retry = response.headers.get("Retry-After")
							const seconds = retry === null ? Number.NaN : Number(retry)
							wait = Number.isFinite(seconds)
								? seconds * 1000
								: retry
									? Date.parse(retry) - Date.now()
									: 1000 * 2 ** attempt
							await response.body?.cancel()
						}
						if (!response.ok) {
							const error = new TmdbError(undefined, response.status)
							// Preserve only a numeric provider code; response text may contain credentials.
							if (response.status !== 429) {
								const body = z
									.object({ status_code: z.number().int() })
									.safeParse(await response.json().catch(() => null))
								if (body.success) error.code = body.data.status_code
							}
							throw error
						}
						return await response.json()
					},
				)
			} catch (error) {
				if (error instanceof TmdbError && error.status === 429 && attempt < 3) {
					// Never retry earlier than Retry-After. Large waits fail safely instead of holding a request forever.
					if (wait > 30_000) {
						const busy = new TmdbError(
							"TMDB is busy. Please try again later.",
							429,
						)
						busy.retryAfterMs = wait
						throw busy
					}
					await sleep(Number.isFinite(wait) ? Math.max(0, wait) : 1000)
					continue
				}
				if (error instanceof TmdbError && error.status === 429 && wait > 0)
					error.retryAfterMs = wait
				throw error instanceof TmdbError ? error : new TmdbError()
			}
		}
	}
	return {
		async createRequest(redirectTo: string): Promise<string> {
			if (!options.appToken)
				throw new TmdbError("TMDB Connect is not configured yet.", 503)
			const result = z
				.object({ success: z.literal(true), request_token: z.string().min(1) })
				.safeParse(
					await request("auth/request_token", options.appToken, "POST", {
						redirect_to: redirectTo,
					}),
				)
			if (!result.success) throw new TmdbError()
			return result.data.request_token
		},
		async exchange(
			requestToken: string,
		): Promise<{ accessToken: string; accountId: string }> {
			const result = z
				.object({
					success: z.unknown(),
					access_token: z.string().min(1),
					account_id: z.unknown().optional(),
				})
				.safeParse(
					await request("auth/access_token", options.appToken, "POST", {
						request_token: requestToken,
					}),
				)
			if (!result.success) throw new TmdbError()
			// Preserve any issued token even if the account metadata is malformed, so the flow can revoke it.
			return {
				accessToken: result.data.access_token,
				accountId:
					result.data.success === true &&
					typeof result.data.account_id === "string"
						? result.data.account_id
						: "",
			}
		},
		async revoke(accessToken: string, accountId?: string): Promise<void> {
			for (let attempt = 0; ; attempt++) {
				try {
					const result = z.object({ status_code: z.literal(13) }).safeParse(
						await request("auth/access_token", options.appToken, "DELETE", {
							access_token: accessToken,
						}),
					)
					if (!result.success) throw new TmdbError()
					return
				} catch (error) {
					if (accountId && isMissingToken(error)) {
						// Confirm both that the application bearer works and that the member token no longer reads its account.
						try {
							const auth = z
								.object({ success: z.literal(true) })
								.safeParse(
									await request(
										"authentication",
										options.appToken,
										"GET",
										undefined,
										3,
									),
								)
							if (auth.success) {
								try {
									await request(
										`account/${encodeURIComponent(accountId)}/movie/rated?page=1`,
										accessToken,
									)
								} catch (probeError) {
									if (isMissingToken(probeError)) return
									throw probeError
								}
							}
						} catch (validationError) {
							if (
								validationError instanceof TmdbError &&
								validationError.status === 429
							)
								throw validationError
						}
					}
					if (error instanceof TmdbError && error.status === 429) throw error
					if (attempt === 2)
						throw new TmdbError(
							"TMDB has not confirmed disconnection. GoodWatch will retry automatically. If this continues, ask TMDB support to revoke GoodWatch’s access.",
						)
					await sleep(1000 * 2 ** attempt)
				}
			}
		},
		async readAccount(
			accountId: string,
			accessToken: string,
		): Promise<ParsedImport> {
			const observations: ImportObservation[] = []
			const deadline = Date.now() + 5 * 60_000
			const timestamps = new Map<string, number>()
			let invalidDates = 0
			const warnings = [
				"TMDB half-step ratings round up to whole numbers: 7.5 becomes 8; 0.5 becomes 1.",
				"Episode ratings on TMDB were not read. TMDB has no watch history; rating dates are not viewing dates.",
			]
			for (const mediaType of ["movie", "show"] as const) {
				for (const [list, kind] of [
					["rated", "rating"],
					["watchlist", "want"],
					["favorites", "favorite"],
				] as const) {
					let pages = 1
					let expected = 0
					const ids = new Set<number>()
					for (let page = 1; page <= pages; page++) {
						if (Date.now() > deadline)
							throw new TmdbError(
								"This TMDB account took too long to read. Please try again.",
							)
						await sleep(30)
						const result = pageSchema.safeParse(
							await request(
								`account/${encodeURIComponent(accountId)}/${mediaType === "show" ? "tv" : "movie"}/${list}?page=${page}&sort_by=created_at.asc`,
								accessToken,
							),
						)
						if (!result.success)
							throw new TmdbError(
								"TMDB returned an unreadable account list. Please try again.",
							)
						const data = result.data
						if (data.page !== page)
							throw new TmdbError(
								"TMDB returned an unexpected page. Please try again.",
							)
						if (
							data.total_pages * 20 > IMPORT_MAX_ROWS ||
							data.total_results > IMPORT_MAX_ROWS
						)
							throw new TmdbError(
								"That account produces more than 50,000 import items.",
								400,
							)
						if (page === 1) {
							pages = data.total_pages
							expected = data.total_results
						} else if (
							data.total_pages !== pages ||
							data.total_results !== expected
						) {
							warnings.push(
								`The TMDB ${mediaType} ${list} count changed while reading. Review this partial import or connect again.`,
							)
						}
						for (const item of data.results) {
							if (ids.has(item.id))
								throw new TmdbError(
									"TMDB returned duplicate account items. Please try again.",
								)
							ids.add(item.id)
							const value = item.account_rating?.value
							const score =
								typeof value === "number" &&
								value >= 0.5 &&
								value <= 10 &&
								Number.isInteger(value * 2)
									? Math.round(value)
									: null
							const date = item.account_rating?.created_at
							const addedAt =
								typeof date === "string" && ratingDate.safeParse(date).success
									? new Date(date).toISOString()
									: null
							if (kind === "rating" && date != null && !addedAt) invalidDates++
							if (kind === "rating" && addedAt)
								timestamps.set(
									addedAt.slice(0, 10),
									(timestamps.get(addedAt.slice(0, 10)) ?? 0) + 1,
								)
							const release =
								mediaType === "movie" ? item.release_date : item.first_air_date
							observations.push({
								key: `tmdb:${kind}:${mediaType}:${item.id}`,
								kind,
								mediaType,
								title: (item.title ?? item.name ?? "").slice(0, 500),
								year:
									release && /^\d{4}-/.test(release)
										? Number(release.slice(0, 4))
										: null,
								tmdbId: item.id,
								imdbId: null,
								addedAt: kind === "rating" ? addedAt : null,
								...(kind === "rating"
									? {
											score,
											...(score === null
												? {
														problem: {
															outcome: "invalid" as const,
															reason:
																"The TMDB rating is not a half step from 0.5 to 10.",
														},
													}
												: {}),
										}
									: {}),
							})
							if (observations.length > IMPORT_MAX_ROWS)
								throw new TmdbError(
									"That account produces more than 50,000 import items.",
									400,
								)
						}
					}
					if (ids.size !== expected)
						warnings.push(
							`Read ${ids.size} of ${expected} TMDB ${mediaType} ${list} items. The list may have changed; review this partial import or connect again.`,
						)
				}
			}
			if (invalidDates)
				warnings.push(`${invalidDates} invalid rating dates were left undated.`)
			const cluster = Math.max(0, ...timestamps.values())
			if (cluster >= 100)
				warnings.push(
					`${cluster} ratings share one UTC calendar day on TMDB. These may be migration dates; the original rating dates were preserved.`,
				)
			return { source: "tmdb", observations, warnings }
		},
	}
}
export type TmdbClient = ReturnType<typeof createTmdbClient>
