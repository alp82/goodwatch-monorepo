// POST /api/imdb-import/preview: reads an IMDb ratings export and stores a preview. Writes no ratings.
import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import { IMDB_IMPORT_MAX_BYTES, type ImdbImportResponse } from "~/domain/imdb-import"
import { ImdbImportError } from "~/server/imdb-import/file.server"
import { parseJson, withMember } from "~/server/imdb-import/http.server"
import { createPreview } from "~/server/imdb-import/preview.server"

const requestSchema = z.object({
	fileName: z.string(),
	csv: z.string(),
})

const TOO_LARGE = `That file is larger than ${Math.round(IMDB_IMPORT_MAX_BYTES / 1024 / 1024)} MB, which is more than an IMDb ratings file should be.`
// JSON escapes quotes and line breaks, so the body is somewhat larger than the file it carries.
const MAX_BODY_BYTES = IMDB_IMPORT_MAX_BYTES * 2

export function action({ request }: ActionFunctionArgs) {
	return withMember(request, async (userId, headers) => {
		if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers })
		if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) throw new ImdbImportError(413, TOO_LARGE)
		const body = await request.text()
		if (body.length > MAX_BODY_BYTES) throw new ImdbImportError(413, TOO_LARGE)
		const parsed = requestSchema.safeParse(parseJson(body))
		if (!parsed.success) throw new ImdbImportError(400, "We couldn't read that upload. Choose the ratings file you downloaded from IMDb.")
		const { csv } = parsed.data
		if (Buffer.byteLength(csv, "utf8") > IMDB_IMPORT_MAX_BYTES) throw new ImdbImportError(413, TOO_LARGE)
		const fileName = parsed.data.fileName.replace(/\s+/g, " ").trim().slice(0, 200) || "ratings.csv"
		return json<ImdbImportResponse>({ import: await createPreview(userId, fileName, csv) }, { headers })
	})
}
