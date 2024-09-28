import { useEffect, useRef, useState } from "react"

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

export interface UseScrollSectionsProps<T extends string> {
	sections: Record<T, Section>
}

export const useScrollSections = <T extends string>({
	sections,
}: UseScrollSectionsProps<T>) => {
	const [activeSections, setActiveSections] = useState<string[]>([])
	const sectionRefs = useRef<Record<T, HTMLDivElement | null>>(
		{} as Record<T, null>,
	)

	const sectionProps = Object.fromEntries<PropsForSection<T>>(
		Object.keys(sections).map((id) => {
			return [
				id as T,
				{
					id: id as T,
					className: "scroll-mt-32",
					ref: (element: HTMLDivElement) => {
						sectionRefs.current[id as T] = element
					},
				},
			]
		}),
	) as SectionProps<T>

	const navigateToSection = (section: Section) => {
		sectionRefs.current[section.id as T]?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		})
	}

	// internal scroll observers

	useEffect(() => {
		const options = {
			root: null,
			rootMargin: "0px",
			threshold: [0.03],
		}

		const callback = (entries: IntersectionObserverEntry[]) => {
			for (const entry of entries) {
				const { id } = entry.target
				if (entry.isIntersecting) {
					setActiveSections((prev) => {
						if (!prev.includes(id)) {
							return [...prev, id]
						}
						return prev
					})
				} else {
					setActiveSections((prev) =>
						prev.filter((sectionId) => sectionId !== id),
					)
				}
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
	}, [sections])

	return { activeSections, sectionProps, navigateToSection }
}
