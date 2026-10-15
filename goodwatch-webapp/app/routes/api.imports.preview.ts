import { type ActionFunctionArgs, json } from "@remix-run/node"
import { z } from "zod"
import {
	IMPORT_MAX_BYTES,
	IMPORT_SOURCES,
	IMPORT_SOURCE_FILE,
} from "~/domain/imports"
import { withMember } from "~/server/imports/http.server"
import { previewImport } from "~/server/imports/service.server"
import { NativeImportError } from "~/server/imports/store.server"
const sourceSchema = z.enum(IMPORT_SOURCES)
const MAX_MULTIPART_BYTES = IMPORT_MAX_BYTES + 1024 * 1024
export const action = ({ request }: ActionFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		if (request.method !== "POST")
			return json({ error: "Method not allowed" }, { status: 405, headers })
		const length = Number(request.headers.get("Content-Length"))
		if (Number.isFinite(length) && length > MAX_MULTIPART_BYTES)
			throw new NativeImportError(413, "That export is larger than 20 MB.")
		const reader = request.body?.getReader()
		const parts: Uint8Array[] = []
		let total = 0
		if (!reader)
			throw new NativeImportError(
				400,
				"Choose an import source and export file.",
			)
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			total += value.byteLength
			if (total > MAX_MULTIPART_BYTES) {
				await reader.cancel()
				throw new NativeImportError(413, "That export is larger than 20 MB.")
			}
			parts.push(value)
		}
		let form: FormData
		try {
			form = await new Request(request.url, {
				method: "POST",
				headers: { "Content-Type": request.headers.get("Content-Type") ?? "" },
				body: Buffer.concat(parts.map((part) => Buffer.from(part))),
			}).formData()
		} catch {
			throw new NativeImportError(
				400,
				"We couldn't read that upload. Choose the export file for your selected source.",
			)
		}
		const source = sourceSchema.safeParse(form.get("source"))
		const file = form.get("file")
		if (!source.success || !(file instanceof File))
			throw new NativeImportError(
				400,
				"Choose an import source and export file.",
			)
		const wishlist = form.get("wishlist")
		if (
			wishlist !== null &&
			(!(wishlist instanceof File) || source.data !== "movielens")
		)
			throw new NativeImportError(
				400,
				"Only MovieLens accepts an optional wishlist CSV file.",
			)
		if (
			file.size + (wishlist instanceof File ? wishlist.size : 0) >
			IMPORT_MAX_BYTES
		)
			throw new NativeImportError(413, "That export is larger than 20 MB.")
		const bytes = new Uint8Array(await file.arrayBuffer())
		return json(
			{
				import: await previewImport(
					userId,
					source.data,
					[file.name, ...(wishlist instanceof File ? [wishlist.name] : [])]
						.join(" + ")
						.replace(/\s+/g, " ")
						.trim()
						.slice(0, 200) ||
						`${source.data}.${IMPORT_SOURCE_FILE[source.data]}`,
					bytes,
					wishlist instanceof File
						? new Uint8Array(await wishlist.arrayBuffer())
						: undefined,
				),
			},
			{ headers },
		)
	})
