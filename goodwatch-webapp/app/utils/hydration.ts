import React from "react"

interface UseOnceMountedProps {
	onMount: () => void
}

export const useOnceMounted = ({ onMount }: UseOnceMountedProps) => {
	const [isMounted, setIsMounted] = React.useState(false)

	React.useEffect(() => {
		if (isMounted) return

		setIsMounted(true)
		return onMount()
	}, [onMount])

	return isMounted
}
