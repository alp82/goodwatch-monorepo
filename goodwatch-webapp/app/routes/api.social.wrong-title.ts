import type { ActionFunctionArgs } from "@remix-run/node"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import { getSocialStore } from "~/server/talked-about-now/social-store.server"
import { handleWrongTitle } from "~/server/talked-about-now/wrong-title.server"
import { getUserIdFromRequest } from "~/utils/auth"

// POST /api/social/wrong-title: see server/talked-about-now/wrong-title.server.ts.
export async function action({ request }: ActionFunctionArgs) {
	return handleWrongTitle(request, {
		store: () => getSocialStore(),
		enabled: async () => talkedAboutNowEnabled("title", await getUserIdFromRequest({ request })),
	})
}

export function loader() {
	return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
