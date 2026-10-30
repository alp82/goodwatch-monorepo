import { getUserIdFromRequest } from "~/utils/auth"
import { loadTropeRecommendations } from "~/server/trope-recs/index.server"
import { recommendationsResource } from "~/server/trope-recs/resource"

export const loader = recommendationsResource({
	authenticate: (request) => getUserIdFromRequest({ request }),
	load: loadTropeRecommendations,
})
