import { isbot } from "isbot"
import { getUserIdFromRequest } from "../utils/auth.ts"
import { presentationLanguage } from "../utils/media-presentation.ts"
import { timeRequestWork, withRequestTiming } from "../utils/request-work.ts"
import { resolveMediaContext } from "./media-context.server.ts"
import { overlayTitles } from "./media-overlay.server.ts"
import {
	protectMediaResponse,
	withMediaReadHealth,
} from "./media-read-health.server.ts"

/** Explicit URL dimension for public API payloads. Absent values retain the canonical English API contract. */
export const payloadLanguage = (request: Request) =>
	presentationLanguage(new URL(request.url).searchParams.get("displayLanguage"))
/** Presence of this query dimension opts a client into the additive media presentation contract. */
export const apiDisplayLanguage = (request: Request) =>
	!isbot(request.headers.get("user-agent")) &&
	new URL(request.url).searchParams.has("displayLanguage")
		? payloadLanguage(request)
		: undefined
/** A canonical bot response cannot populate a human's localized public URL. */
export const mediaApiCacheControl = (request: Request, livePolicy: string) => {
	const headers = new Headers({
		"Cache-Control": isbot(request.headers.get("user-agent"))
			? "private, no-store"
			: livePolicy,
	})
	protectMediaResponse(headers)
	return headers.get("Cache-Control")!
}
export async function localizeApiTitlePayload<T>(
	payload: T,
	request: Request,
	hint?: Kind,
) {
	const language = apiDisplayLanguage(request)
	return language ? localizeTitlePayload(payload, language, hint) : payload
}
export async function liveMediaLanguage(
	request: Request,
	userId?: string | null,
) {
	if (isbot(request.headers.get("user-agent"))) return "en"
	return (
		await resolveMediaContext(
			request,
			userId === undefined ? await getUserIdFromRequest({ request }) : userId,
		)
	).effectiveContext.language
}
import {
	type Kind,
	localizeTitlePayload as localizeCore,
} from "../utils/media-payload-core.ts"
export function localizeTitlePayload<T>(
	payload: T,
	language: string,
	hint?: Kind,
	overlay: typeof overlayTitles = overlayTitles,
	options: { maxTitles?: number } = {},
) {
	return withMediaReadHealth(
		() => localizeCore(payload, language, hint, overlay, options),
		{ inheritFailure: true, overlay: true },
	)
}

/** Route boundary for JSON catalog responses. Base data caches stay canonical; explicit URLs partition public payloads. */
export function presentCatalogLoader<A extends { request: Request }, R>(
	load: (args: A) => R | Promise<R>,
	options: { live?: boolean; hint?: Kind } = {},
) {
	return withRequestTiming(
		(args: A): Promise<R> =>
			withMediaReadHealth(async () => {
				// Presentation can resolve the member while canonical catalog data loads.
				const languageWork =
					options.live &&
					!isbot(args.request.headers.get("user-agent")) &&
					!new URL(args.request.url).pathname.startsWith("/api/")
						? liveMediaLanguage(args.request)
						: undefined
				languageWork?.catch(() => {})
				const result = await timeRequestWork(args.request, "data", async () =>
					load(args),
				)
				if (isbot(args.request.headers.get("user-agent"))) {
					if (!new URL(args.request.url).pathname.startsWith("/api/"))
						return result
					if (result instanceof Response) {
						const headers = new Headers(result.headers)
						headers.set("Cache-Control", "private, no-store")
						return new Response(result.body, {
							status: result.status,
							headers,
						}) as R
					}
					return new Response(JSON.stringify(result), {
						headers: {
							"Content-Type": "application/json",
							"Cache-Control": "private, no-store",
						},
					}) as R
				}
				const api = new URL(args.request.url).pathname.startsWith("/api/")
				if (api && !apiDisplayLanguage(args.request)) return result
				const language = api
					? payloadLanguage(args.request)
					: options.live
						? await (languageWork ?? liveMediaLanguage(args.request))
						: payloadLanguage(args.request)
				if (result instanceof Response) {
					if (
						result.status !== 200 ||
						!result.headers.get("content-type")?.includes("application/json")
					)
						return result
					const value = await result.json()
					const headers = new Headers(result.headers)
					headers.delete("content-length")
					const presented = await localizeTitlePayload(
						value,
						language,
						options.hint,
					)
					protectMediaResponse(headers, presented)
					return new Response(JSON.stringify(presented), {
						status: result.status,
						headers,
					}) as R
				}
				return await localizeTitlePayload(result, language, options.hint)
			}),
	)
}
