import React from "react"
import { motion } from "framer-motion"
import type { ShowcaseExample } from "~/routes/api.showcase-examples"

interface ShowcaseCardProps {
	example: ShowcaseExample
	children: React.ReactNode
	index: number
}

export default function ShowcaseCard({ example, children, index }: ShowcaseCardProps) {
	const posterUrl = example.poster_path
		? `https://image.tmdb.org/t/p/w342${example.poster_path}`
		: null
	const backdropUrl = example.backdrop_path
		? `https://image.tmdb.org/t/p/w780${example.backdrop_path}`
		: null

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.1 + index * 0.1, duration: 0.4 }}
			className="relative min-h-96 bg-gray-800/50 border border-gray-600/50"
		>
			{backdropUrl && (
				<div
					className="absolute inset-0 opacity-50"
					style={{
						backgroundImage: `url(${backdropUrl})`,
						backgroundSize: "cover",
						backgroundPosition: "center top",
					}}
				/>
			)}
			<div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-900/70" />

			<div className="relative p-6 md:p-8 flex flex-col gap-8 min-h-[200px]">
				<div className="flex gap-6 md:gap-12">
					{posterUrl && (
						<div className="flex-shrink-0 flex items-start">
							<img
								src={posterUrl}
								alt={example.title}
								className="w-20 md:w-32 lg:w-48 h-auto object-cover rounded-lg shadow-xl"
							/>
						</div>
					)}
					<div className="flex flex-col text-left">
						<div className="mb-8">
							<h4 className="text-2xl font-bold text-white">
								{example.title}
							</h4>
							<p className="text-base text-gray-400">
								{example.release_year} • {example.mediaType === "movie" ? "Movie" : "Show"}
							</p>
						</div>
						<div className="hidden md:block">
							{children}
						</div>
					</div>
				</div>
				<div className="md:hidden">
					{children}
				</div>
			</div>


		</motion.div>
	)
}
