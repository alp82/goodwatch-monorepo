import { overlayTitles } from "./media-overlay.server.ts"
import { presentationLanguage } from "../utils/media-presentation.ts"
import { isbot } from "isbot"
import { resolveMediaContext } from "./media-context.server.ts"
import { getUserIdFromRequest } from "../utils/auth.ts"

/** Explicit URL dimension for public API payloads. Absent values retain the canonical English API contract. */
export const payloadLanguage = (request: Request) =>
	presentationLanguage(new URL(request.url).searchParams.get("displayLanguage"))
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
	localizeTitlePayload as localizeCore,
	type Kind,
} from "../utils/media-payload-core.ts"
export function localizeTitlePayload<T>(
	payload: T,
	language: string,
	hint?: Kind,
	overlay: typeof overlayTitles = overlayTitles,
) {
	return localizeCore(payload, language, hint, overlay)
}

/** Route boundary for JSON catalog responses. Base data caches stay canonical; explicit URLs partition public payloads. */
export function presentCatalogLoader<A extends { request: Request }, R>(
	load: (args: A) => R | Promise<R>,
	options: { live?: boolean; hint?: Kind } = {},
) {
	return async (args: A): Promise<R> => {
		const result = await load(args)
		if (isbot(args.request.headers.get("user-agent"))) {
			if (!new URL(args.request.url).pathname.startsWith("/api/")) return result
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
		const language =
			options.live &&
			(!new URL(args.request.url).pathname.startsWith("/api/") ||
				!new URL(args.request.url).searchParams.has("displayLanguage"))
				? await liveMediaLanguage(args.request)
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
			return new Response(
				JSON.stringify(
					await localizeTitlePayload(value, language, options.hint),
				),
				{ status: result.status, headers },
			) as R
		}
		return await localizeTitlePayload(result, language, options.hint)
	}
}
