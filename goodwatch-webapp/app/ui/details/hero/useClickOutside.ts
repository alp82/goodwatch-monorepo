import { useEffect } from "react"

// Calls `onOutside` for a mouse press anywhere outside `ref`.
export function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onOutside()
		}
		document.addEventListener("mousedown", handler)
		return () => document.removeEventListener("mousedown", handler)
	})
}
