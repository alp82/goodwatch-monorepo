// The mood picker tiles' pictures (/api/start-picker-pictures), asked for when the picker opens: once per page load
// when an answer comes, again on the next open when none did (a failure, or the catalog still loading). None until
// they arrive.
import { useEffect, useState } from "react"
import type { PickerPicturesResponse } from "~/routes/api.start-picker-pictures"

let asked: Promise<Record<string, string>> | null = null

/** `open`: whether the picker is open now; each open without pictures asks again. */
export function usePickerPictures(open: boolean): Record<string, string> {
	const [pictures, setPictures] = useState<Record<string, string>>({})
	useEffect(() => {
		if (!open) return
		asked ??= fetch("/api/start-picker-pictures")
			.then((r) =>
				r.ok ? (r.json() as Promise<PickerPicturesResponse>) : null,
			)
			.then((body) => body?.pictures ?? {})
			.catch(() => ({}))
		const asking = asked
		let live = true
		asking.then((p) => {
			// An empty answer is asked for again on the next open.
			if (!Object.keys(p).length && asked === asking) asked = null
			if (live && Object.keys(p).length) setPictures(p)
		})
		return () => {
			live = false
		}
	}, [open])
	return pictures
}
