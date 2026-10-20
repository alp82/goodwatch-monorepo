import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { getDetailsForMovie, getDetailsForShow } from "~/server/details.server"
import { resolveMediaContext } from "~/server/media-context.server"
import { getUserIdFromRequest } from "~/utils/auth"
import {
	directOffers,
	type TvTitleExtras,
} from "~/ui/living-room/tv/title-extras"

/** Small interaction payload from the same country-specific details reader as the real title page. */
export async function loader({ request }: LoaderFunctionArgs) {
	const params = new URL(request.url).searchParams
	const type = params.get("type")
	const id = params.get("id") ?? ""
	if ((type !== "movie" && type !== "show") || !/^[1-9]\d{0,9}$/.test(id))
		throw new Response("Invalid title", { status: 400 })
	const userId = await getUserIdFromRequest({ request })
	const {
		effectiveContext: { country, language },
	} = await resolveMediaContext(request, userId)
	const media =
		type === "movie"
			? await getDetailsForMovie({ movieId: id, country, language })
			: await getDetailsForShow({ showId: id, country, language })
	const result: TvTitleExtras = {
		country,
		offers: directOffers(media),
		trailer: media.videos?.trailers?.[0]?.key ?? null,
		fingerprint: media.fingerprint
			? {
					title: media.details.title,
					titleLang: media.details.presentation?.title.language,
					mediaType: type,
					year: media.details.release_year,
					genres: media.details.genres,
					fingerprint: media.fingerprint,
				}
			: null,
	}
	return json(result, { headers: { "Cache-Control": "private, no-store" } })
}
