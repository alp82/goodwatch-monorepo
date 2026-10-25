import type { ActionFunctionArgs } from "@remix-run/node"
import { getUserIdFromRequest } from "~/utils/auth"
import { correctionStore } from "~/server/feedback/correction-runtime.server"
import { undoCorrection } from "~/server/feedback/undo.server"
export const action = ({ request, params }: ActionFunctionArgs) =>
	undoCorrection(request, params.correctionId ?? "", {
		memberId: async (request) =>
			(await getUserIdFromRequest({ request, fresh: true })) ?? null,
		decide: correctionStore.decide,
	})
export const loader = () =>
	new Response(null, {
		status: 405,
		headers: { Allow: "POST", "Cache-Control": "no-store" },
	})
