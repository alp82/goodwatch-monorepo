import { motion } from "framer-motion"
import { useState } from "react"

export const CountryFlag = ({ countryCode }: { countryCode: string }) => {
	const [rotateX, setRotateX] = useState(0)
	const [rotateY, setRotateY] = useState(0)

	const getCountryName = (countryCode: string) => {
		return countryCode // Placeholder for country name lookup
	}

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
		const { clientX, clientY, currentTarget } = e
		const { width, height, left, top } = currentTarget.getBoundingClientRect()

		const xRotation = Math.min(
			Math.max(((clientY - top) / height - 0.5) * 40, -20),
			20,
		)
		const yRotation = Math.min(
			Math.max((0.5 - (clientX - left) / width) * 40, -20),
			20,
		)

		setRotateX(xRotation)
		setRotateY(yRotation)
	}

	const handleMouseLeave = () => {
		setRotateX(0)
		setRotateY(0)
	}

	return (
		<motion.div
			className="relative w-24 h-16"
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			style={{
				perspective: "800px",
			}}
		>
			<motion.img
				className="w-full h-full object-cover rounded-md shadow-lg"
				src={`https://purecatamphetamine.github.io/country-flag-icons/3x2/${countryCode}.svg`}
				alt={getCountryName(countryCode)}
				initial={{ scale: 1 }}
				animate={{
					rotateX: rotateX,
					rotateY: rotateY,
					scale: 1.1,
					transition: {
						rotateX: { duration: 0.2, ease: "easeOut" },
						rotateY: { duration: 0.2, ease: "easeOut" },
						scale: { duration: 0.2 },
					},
				}}
				whileHover={{ scale: 1.15 }}
				style={{
					transformStyle: "preserve-3d",
					boxShadow: "0 15px 25px rgba(0, 0, 0, 0.2)",
				}}
			/>

			{/* Glossy overlay */}
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"linear-gradient(130deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 70%)",
					mixBlendMode: "overlay", // Makes the gradient blend with the image
					opacity: 0.6, // Controls the intensity of the gloss
					borderRadius: "inherit",
				}}
			/>
		</motion.div>
	)
}
