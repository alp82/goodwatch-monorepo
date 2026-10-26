import { type ActionFunctionArgs, json } from "@remix-run/node"
import { protectMediaResponse } from "~/server/media-read-health.server"
import { loadProfileShell } from "~/server/profile/page.server"
import { readJsonLimited } from "~/server/profile/request.server"
import { seesTropes } from "~/server/profile/tropes-model"
import { loadProfileTropeDescriptions } from "~/server/profile/tropes.server"
import { descriptionIds } from "~/utils/profile-trope-descriptions"

export async function action({ request, params }: ActionFunctionArgs) {
	const headers = new Headers({
		"Cache-Control": "private, no-store",
		Vary: "Cookie",
	})
	const loaded = await loadProfileShell(request, params.handle ?? "")
	if (loaded instanceof Response) return loaded
	if (!seesTropes(loaded.shell))
		return json(
			{ entries: {}, catalogVersion: "", pending: false },
			{ headers },
		)
	if (request.method !== "POST")
		return json({ error: "Method not allowed" }, { status: 405, headers })
	const body = await readJsonLimited(request, 262_144)
	if (!body.ok)
		return json(
			{ error: "Invalid or oversized body" },
			{ status: body.problem === "too-large" ? 413 : 400, headers },
		)
	const ids = descriptionIds(body.value)
	if (!ids)
		return json(
			{ error: "At most 60 bounded trope IDs" },
			{ status: 400, headers },
		)
	try {
		const result = await loadProfileTropeDescriptions(
			loaded.ownerId,
			loaded.shell,
			ids,
		)
		protectMediaResponse(headers, result)
		return json(result, { headers })
	} catch {
		// A failed optional catalog read must not replace successful SSR/client definitions with null text.
		return json(
			{ error: "Descriptions temporarily unavailable" },
			{ status: 503, headers },
		)
	}
}
