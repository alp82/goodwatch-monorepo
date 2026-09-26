import { useEffect } from "react"

// Calls `onOutside` for a mouse press outside every element in `refs`.
export function useClickOutside(refs: React.RefObject<HTMLElement | null>[], onOutside: () => void) {
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			const target = e.target as Node
			const mounted = refs.filter((ref) => ref.current)
			if (mounted.length && !mounted.some((ref) => ref.current?.contains(target))) onOutside()
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	})
}
