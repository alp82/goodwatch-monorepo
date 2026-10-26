import type { ActionFunctionArgs } from "@remix-run/node"
import { recordTitleDemand } from "~/server/poster-impressions.server"
import { rateLimiter } from "~/server/rate-limit.server"
import { hasSiteOrigin } from "~/server/site-origin.server"
import { increasePriority } from "~/server/utils/priority"
import { getRedisCluster } from "~/utils/cache"
import { query } from "~/utils/crate"

export async function action({ request }: ActionFunctionArgs) {
	return recordTitleDemand(request, { hasSiteOrigin, getRedisCluster, rateLimiter, query, increasePriority })
}
