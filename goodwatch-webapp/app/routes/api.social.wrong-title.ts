import type { ActionFunctionArgs } from "@remix-run/node"
import { talkedAboutNowEnabled } from "~/server/talked-about-now/flags.server"
import { getSocialStore } from "~/server/talked-about-now/social-store.server"
import { forgetTalkedAboutNow } from "~/server/talked-about-now/start-row.server"
import { handleWrongTitle } from "~/server/talked-about-now/wrong-title.server"
import { getUserIdFromRequest } from "~/utils/auth"

// POST /api/social/wrong-title: see server/talked-about-now/wrong-title.server.ts.
export async function action({ request }: ActionFunctionArgs) {
	const response = await handleWrongTitle(request, {
		store: () => getSocialStore(),
		enabled: async () => talkedAboutNowEnabled("title", await getUserIdFromRequest({ request })),
	})
	// The start page's row (#557) keeps one answer for every visitor: it reads again before the report is answered.
	if (response.status === 200) forgetTalkedAboutNow()
	return response
}

export function loader() {
	return new Response(null, { status: 405, headers: { Allow: "POST" } })
}
