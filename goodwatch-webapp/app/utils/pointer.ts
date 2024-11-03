import { useEffect, useRef } from "react"

export interface UseOutsideClickProps {
	onClickOutside: () => void
}

export const useOutsideClick = ({ onClickOutside }: UseOutsideClickProps) => {
	const ref = useRef<HTMLElement>(null)

	useEffect(() => {
		function handleClickOutside(
			event:
				| React.MouseEvent<HTMLElement, MouseEvent>
				| React.TouchEvent<HTMLElement>,
		) {
			if (ref.current && !ref.current.contains(event.target)) {
				onClickOutside()
			}
		}

		document.addEventListener("mousedown", handleClickOutside)
		document.addEventListener("touchstart", handleClickOutside)

		return () => {
			document.removeEventListener("mousedown", handleClickOutside)
			document.removeEventListener("touchstart", handleClickOutside)
		}
	}, [onClickOutside])

	return { ref }
}

export default useOutsideClick
