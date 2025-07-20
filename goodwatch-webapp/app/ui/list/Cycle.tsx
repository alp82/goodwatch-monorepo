import { type ReactNode, useCallback, useState } from "react"
import { useOnceMounted } from "~/utils/hydration"

const CYCLE_INTERVAL = 6000

export interface CycleProps {
	items: ReactNode[]
}

export default function Cycle({ items }: CycleProps) {
	const [currentIndex, setCurrentIndex] = useState(0)

	const updateCycle = useCallback(() => {
		const intervalId = setInterval(() => {
			setCurrentIndex(Math.floor(Math.random() * items.length))
		}, CYCLE_INTERVAL)

		return () => clearInterval(intervalId)
	}, [])

	const isMounted = useOnceMounted({
		onMount: updateCycle,
	})

	return (
		<div className="flex items-center">
			{items.map((item, index) => (
				<span
					key={index}
					className={`absolute transition-opacity duration-1000 ${index !== currentIndex ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}
					style={{ transition: "opacity 1s" }}
				>
					{item}
				</span>
			))}
		</div>
	)
}
