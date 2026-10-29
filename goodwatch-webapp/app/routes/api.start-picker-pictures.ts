// The start page mood picker's tile pictures (server/start-page/picker-pictures.server.ts): the same for everyone, so
// shared caches keep them. Asked for when the picker first opens.
import { json } from "@remix-run/node"
import { PUBLIC_DATA_CACHE_CONTROL } from "~/server/cache-identity.server"
import { loadPickerPictures } from "~/server/start-page/picker-pictures.server"
import { getDisplayFields } from "~/server/title-cards.server"
import { getTitleSnapshot } from "~/server/title-snapshot/index.server"

export type PickerPicturesResponse = { pictures: Record<string, string> }

export const loader = async () => {
	const pictures = await loadPickerPictures(
		getTitleSnapshot(),
		getDisplayFields,
	).catch((error) => {
		console.error("Start page: loading the picker's pictures failed", error)
		return null
	})
	// Without the snapshot (still loading) the tiles show their colors; nothing stores the empty answer.
	if (!pictures)
		return json<PickerPicturesResponse>(
			{ pictures: {} },
			{ headers: { "Cache-Control": "no-store" } },
		)
	return json<PickerPicturesResponse>(
		{ pictures },
		{ headers: { "Cache-Control": PUBLIC_DATA_CACHE_CONTROL } },
	)
}
