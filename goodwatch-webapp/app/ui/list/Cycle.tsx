import { type ReactNode, useEffect, useState } from "react"

export interface CycleProps {
	items: ReactNode[]
}

export default function Cycle({ items }: CycleProps) {
	const [currentIndex, setCurrentIndex] = useState(0)

	useEffect(() => {
		const intervalId = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % items.length)
		}, 4000)

		return () => clearInterval(intervalId)
	}, [items.length])

	return (
		<div className="pl-1 sm:pl-0 flex sm:items-center">
			{items.map((item, index) => (
				<span
					key={index}
					className={`absolute transition-opacity duration-1000 ${index !== currentIndex ? "opacity-0" : "opacity-100"}`}
					style={{ transition: "opacity 1s" }}
				>
					{item}
				</span>
			))}
		</div>
	)
}
