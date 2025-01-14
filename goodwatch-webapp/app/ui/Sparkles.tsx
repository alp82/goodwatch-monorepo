import React, { useCallback } from "react"
import { useOnceMounted } from "~/utils/hydration"
import { usePrefersReducedMotion } from "~/utils/motion"
import { random, randomEdge, useRandomInterval } from "~/utils/random"
import { range } from "~/utils/range"

const DEFAULT_COLOR = "#FFFFCC"

interface Sparkle {
	id: string
	createdAt: number
	color: string
	size: number
	style: {
		top: string
		left: string
		animation: string
	}
}

const generateSparkle = (color: string): Sparkle => {
	const isHorizontal = Math.random() > 0.5
	return {
		id: String(random(10000, 99999)),
		createdAt: Date.now(),
		color,
		size: random(10, 20),
		style: {
			top: `${isHorizontal ? randomEdge(-25, 75, 5) : random(-25, 75)}%`,
			left: `${isHorizontal ? random(-7, 93) : randomEdge(-7, 93, 5)}%`,
			animation: "comeInOut 700ms forwards",
		},
	}
}

const Sparkles = ({ color = DEFAULT_COLOR, children, ...delegated }) => {
	const [sparkles, setSparkles] = React.useState<Sparkle[]>([])

	const updateSparkles = useCallback(() => {
		setSparkles(range(3).map(() => generateSparkle(color)))
	}, [color])

	const isMounted = useOnceMounted({
		onMount: updateSparkles,
	})

	const prefersReducedMotion = usePrefersReducedMotion()
	useRandomInterval(
		() => {
			if (!isMounted) return
			const sparkle = generateSparkle(color)
			const now = Date.now()
			const nextSparkles = sparkles.filter((sp) => {
				const delta = now - sp.createdAt
				return delta < 750
			})
			nextSparkles.push(sparkle)
			setSparkles(nextSparkles)
		},
		prefersReducedMotion ? null : 850,
		prefersReducedMotion ? null : 2450,
	)

	return (
		<span className="inline-block relative" {...delegated}>
			{sparkles.map((sparkle) => (
				<Sparkle
					key={sparkle.id}
					color={sparkle.color}
					size={sparkle.size}
					style={sparkle.style}
				/>
			))}
			<strong className="relative z-10 font-bold">{children}</strong>
		</span>
	)
}

const Sparkle = ({ size, color, style }) => {
	const path =
		"M26.5 25.5C19.0043 33.3697 0 34 0 34C0 34 19.1013 35.3684 26.5 43.5C33.234 50.901 34 68 34 68C34 68 36.9884 50.7065 44.5 43.5C51.6431 36.647 68 34 68 34C68 34 51.6947 32.0939 44.5 25.5C36.5605 18.2235 34 0 34 0C34 0 33.6591 17.9837 26.5 25.5Z"
	return (
		<span className="absolute block z-20" style={style}>
			<svg
				width={size}
				height={size}
				viewBox="0 0 68 68"
				fill="none"
				className="block"
				style={{
					display: "block",
					animation: "spinHalf 1000ms linear",
				}}
				alt="Sparkle"
			>
				<path d={path} fill={color} />
			</svg>
		</span>
	)
}

export default Sparkles
