import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { resolveMediaContext } from "~/server/media-context.server"
import { getUserIdFromRequest } from "~/utils/auth"
import type { GetMediaPreferencesResponse } from "~/utils/media-language"

/** Saved state belongs to this device/member, never to shared HTML or a catalog cache. */
export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	const { effectiveContext, record, setCookie } = await resolveMediaContext(
		request,
		userId,
	)
	const headers = new Headers({ "Cache-Control": "private, no-store" })
	if (setCookie) headers.set("Set-Cookie", setCookie)
	return json<GetMediaPreferencesResponse>(
		{
			effectiveContext,
			mediaPreferences: record,
			destination: userId ? "account" : "device",
		},
		{ headers },
	)
}
