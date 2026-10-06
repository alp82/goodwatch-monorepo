import { useEffect, useRef, useState, useSyncExternalStore } from "react"

export interface PropsForSection<T> {
	id: T
	className: string
	ref: (element: HTMLDivElement) => void
}

export type SectionProps<T extends string> = Record<T, PropsForSection<T>>

export interface Section {
	id: string
	label: string
}

/**
 * The sections that are on screen now. It lives outside React state on purpose: the page that owns the sections
 * doesn't render again when the list changes, only the components that read it with `useActiveSections` do.
 */
export interface ActiveSections {
	subscribe: (listener: () => void) => () => void
	get: () => readonly string[]
}

const NO_SECTIONS: readonly string[] = []

export function createActiveSections(): ActiveSections & {
	enter: (id: string) => void
	leave: (id: string) => void
} {
	let active = NO_SECTIONS
	const listeners = new Set<() => void>()
	const set = (next: readonly string[]) => {
		active = next
		for (const listener of listeners) listener()
	}
	return {
		subscribe: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
		get: () => active,
		enter: (id) => {
			if (!active.includes(id)) set([...active, id])
		},
		leave: (id) => {
			if (active.includes(id)) set(active.filter((other) => other !== id))
		},
	}
}

const noSections = () => NO_SECTIONS

/** The ids of the sections on screen. Empty in the server's HTML and until the observer's first report. */
export const useActiveSections = (active: ActiveSections) =>
	useSyncExternalStore(active.subscribe, active.get, noSections)

export interface UseScrollSectionsProps<T extends string> {
	sections: Record<T, Section>
}

export const useScrollSections = <T extends string>({
	sections,
}: UseScrollSectionsProps<T>) => {
	const [activeSections] = useState(createActiveSections)
	const sectionRefs = useRef<Record<T, HTMLDivElement | null>>(
		{} as Record<T, null>,
	)

	const sectionProps = Object.fromEntries<PropsForSection<T>>(
		Object.keys(sections).map((id) => {
			return [
				id as T,
				{
					id: id as T,
					className:
						"scroll-mt-52 sm:scroll-mt-56 md:scroll-mt-60 2xl:scroll-mt-48",
					ref: (element: HTMLDivElement) => {
						sectionRefs.current[id as T] = element
					},
				},
			]
		}),
	) as SectionProps<T>

	const navigateToSection = (section: Section) => {
		// Scroll to the section smoothly
		sectionRefs.current[section.id as T]?.scrollIntoView({
			behavior: "smooth",
			block: "start",
			inline: "nearest",
		})

		// Update the URL hash without causing a page refresh
		if (history.pushState) {
			history.pushState(null, "", `#${section.id}`)
		} else {
			// Fallback for older browsers
			window.location.hash = section.id
		}
	}

	// internal scroll observers

	useEffect(() => {
		const options = {
			root: null,
			rootMargin: "-256px 0px -128px 0px",
			threshold: [0.05],
		}

		const callback = (entries: IntersectionObserverEntry[]) => {
			for (const entry of entries) {
				const { id } = entry.target
				if (entry.isIntersecting) activeSections.enter(id)
				else activeSections.leave(id)
			}
		}

		const observer = new IntersectionObserver(callback, options)

		for (const id of Object.keys(sections)) {
			const element = sectionRefs.current[id as T]
			if (element) {
				observer.observe(element)
			}
		}

		return () => {
			// Cleanup the observer on unmount
			for (const id of Object.keys(sections)) {
				const element = sectionRefs.current[id as T]
				if (element) {
					observer.unobserve(element)
				}
			}
		}
	}, [sections, activeSections])

	return {
		activeSections: activeSections as ActiveSections,
		sectionProps,
		navigateToSection,
	}
}
