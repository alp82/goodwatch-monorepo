import { useEffect, useRef, useState } from "react"
import { kindSeg, type Kind } from "~/domain/browse/address"
import type { AtlasData, AtlasGenre, AtlasGenreSummary } from "~/server/browse/genres.server"

function selection(data: AtlasData) {
	const panels = new Map<string, AtlasGenre>()
	if (data.initial) panels.set(data.initial.place.slug, data.initial)
	// A navigation can reach an older serving instance during a rolling deploy.
	if (data.initial === undefined) {
		const complete = (genre: AtlasGenreSummary): genre is AtlasGenre =>
			"picks" in genre && "kinds" in genre && "titles" in genre
		for (const genre of data.genres.filter(complete)) panels.set(genre.place.slug, genre)
	}
	return { data, at: data.genres[0]?.place.slug ?? "", panels, failed: "" }
}

export function useGenrePanels(data: AtlasData, kind: Kind) {
	const [view, setView] = useState(() => selection(data))
	const active = useRef<{ slug: string; controller: AbortController; selected: boolean }>()
	const timer = useRef<ReturnType<typeof setTimeout>>()

	// A replacement loader result can carry a different catalog, locale, or viewer.
	if (view.data !== data) setView(selection(data))
	function cancelIntent() {
		clearTimeout(timer.current)
	}
	useEffect(() => {
		return () => {
			clearTimeout(timer.current)
			active.current?.controller.abort()
			active.current = undefined
		}
	}, [data])

	async function load(slug: string, selected: boolean) {
		if (active.current?.slug === slug) {
			if (selected) active.current.selected = true
			return
		}
		if (active.current?.selected && !selected) return
		active.current?.controller.abort()
		active.current = undefined
		if (view.panels.has(slug)) return

		const controller = new AbortController()
		active.current = { slug, controller, selected }
		try {
			const response = await fetch(
				`/api/browse/genre-panel/${kindSeg(kind)}/${encodeURIComponent(slug)}`,
				{
					headers: { Accept: "application/json" },
					signal: controller.signal,
				},
			)
			if (!response.ok) throw new Error("Genre panel unavailable")
			const { panel }: { panel: AtlasGenre | null } = await response.json()
			if (panel?.place.slug !== slug) throw new Error("Genre panel unavailable")
			if (!controller.signal.aborted) {
				setView((old) => {
					if (old.data !== data) return old
					const panels = new Map(old.panels)
					panels.set(slug, panel)
					return { ...old, panels, failed: old.failed === slug ? "" : old.failed }
				})
			}
		} catch {
			if (!controller.signal.aborted)
				setView((old) => (old.data === data && old.at === slug ? { ...old, failed: slug } : old))
		} finally {
			if (active.current?.controller === controller) active.current = undefined
		}
	}

	function pick(slug: string) {
		cancelIntent()
		setView((old) => ({ ...old, at: slug, failed: "" }))
		void load(slug, true)
	}

	function intent(slug: string) {
		cancelIntent()
		if (view.panels.has(slug) || active.current?.slug === slug) return
		timer.current = setTimeout(() => void load(slug, false), 100)
	}

	return {
		at: view.at,
		panel: view.panels.get(view.at),
		failed: view.failed === view.at,
		pick,
		intent,
		cancelIntent,
	}
}
