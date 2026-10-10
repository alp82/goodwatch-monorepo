import {
	type ActionFunctionArgs,
	type LoaderFunctionArgs,
	json,
} from "@remix-run/node"
import { z } from "zod"
import { getFeatureMode, isEnabled } from "~/server/features.server"
import {
	type WatchLogAnswer,
	applyWatchLogAction,
	getMovieWatchLog,
} from "~/server/watch-log.server"
import { getUserIdFromRequest } from "~/utils/auth"

// A movie's watch log, for members:
// - GET /api/watch-log?tmdb_id=603 answers { watches }, newest first, undated ones below.
// - POST { tmdb_id, action } does one thing in the log and answers { status, refused, watches }: watch, editDate,
//   delete, removeAll, restore (Undo of a delete).
// The member is the session's and the movie is the request's: no row says whose it is or which title it belongs to.
// Not found while REC_TRACKING hides the log from the viewer. A guest is told to sign in.

const headers = { "Cache-Control": "private, no-store" }
const answer = (body: unknown, status = 200) => json(body, { status, headers })

const movieId = z.coerce.number().int().positive().max(2_000_000_000)
const watchId = z.string().min(1).max(80)
const day = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const logged = z.union([
	z.object({ precision: z.literal("day"), day }).strict(),
	z.object({ precision: z.literal("unknown") }).strict(),
])
const when = z.union([
	z.object({ precision: z.literal("moment") }).strict(),
	logged,
])
const restored = z
	.object({
		id: watchId,
		at: z.number().int().nullable(),
		precision: z.enum(["moment", "day", "unknown"]),
		origin: z.enum(["single", "import"]),
		importId: z.string().min(1).max(80).nullable(),
		// What the log showed beside the row. It is read from the import again, never from here.
		source: z.string().max(80).nullable().optional(),
		createdAt: z.number().int().positive(),
	})
	.strict()
const actionSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("watch"),
			// The id the browser made for this watch: sent twice, it is recorded once.
			watchId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{7,79}$/),
			when: when.optional(),
		})
		.strict(),
	z.object({ type: z.literal("editDate"), watchId, when: logged }).strict(),
	z
		.object({
			type: z.literal("delete"),
			watchId,
			back: z
				.object({
					wantToSeeAddedAt: z.string().datetime().nullable().optional(),
					notInterested: z.boolean().optional(),
				})
				.strict()
				.optional(),
		})
		.strict(),
	z.object({ type: z.literal("removeAll") }).strict(),
	z
		.object({
			type: z.literal("restore"),
			rows: z.array(restored).min(1).max(200),
		})
		.strict(),
])
const bodySchema = z.object({ tmdb_id: movieId, action: actionSchema })

/** The member the request is from, or the response to send instead. */
async function member(
	request: Request,
): Promise<{ userId: string } | { response: Response }> {
	if (getFeatureMode("tracking") === "off")
		return { response: answer({ error: "Not found" }, 404) }
	const userId = await getUserIdFromRequest({ request })
	if (!userId)
		return { response: answer({ error: "Sign in to see your watches" }, 401) }
	if (!isEnabled("tracking", { userId }))
		return { response: answer({ error: "Not found" }, 404) }
	return { userId }
}

export async function loader({ request }: LoaderFunctionArgs) {
	const viewer = await member(request)
	if ("response" in viewer) return viewer.response
	const id = movieId.safeParse(
		new URL(request.url).searchParams.get("tmdb_id") || undefined,
	)
	if (!id.success) return answer({ error: "Send tmdb_id" }, 400)
	return answer({ watches: await getMovieWatchLog(viewer.userId, id.data) })
}

export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST")
		return answer({ error: "Method not allowed" }, 405)
	const viewer = await member(request)
	if ("response" in viewer) return viewer.response
	let body: z.infer<typeof bodySchema>
	try {
		body = bodySchema.parse(await request.json())
	} catch {
		return answer({ error: "Send { tmdb_id, action }" }, 400)
	}
	return answer(
		(await applyWatchLogAction(
			viewer.userId,
			body.tmdb_id,
			body.action,
		)) satisfies WatchLogAnswer,
	)
}
