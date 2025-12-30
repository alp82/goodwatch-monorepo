import React, { useState } from "react"
import { motion } from "framer-motion"
import { useShowcaseExamples } from "~/routes/api.showcase-examples"
import ShowcaseCard from "~/ui/showcase/ShowcaseCard"
import Pillars, { type PillarName } from "~/ui/fingerprint/Pillars"
import PillarDetails from "~/ui/fingerprint/PillarDetails"

export default function ShowcaseSection() {
	const { data: examples, isLoading } = useShowcaseExamples()
	const [selectedPillar, setSelectedPillar] = useState<PillarName | null>("Energy")

	if (isLoading || !examples?.length) {
		return (
			<div className="w-full max-w-6xl mx-auto px-4 py-12">
				<div className="animate-pulse space-y-8">
					<div className="h-8 bg-gray-700/50 rounded w-1/3 mx-auto" />
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{[1, 2, 3, 4].map((i) => (
							<div key={i} className="h-48 bg-gray-700/30 rounded-2xl" />
						))}
					</div>
				</div>
			</div>
		)
	}

	const [fingerprintExample, streamingExample, ratingsExample] = examples

	return (
		<div className="w-full max-w-6xl mx-auto px-4 py-12 space-y-24">
			{/* Fingerprint Section */}
			<motion.section
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="text-center mb-10">
					<h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
						<span className="text-amber-400">Fingerprint</span> with 70+ attributes
					</h3>
					<p className="text-gray-400 max-w-2xl mx-auto">
						Every movie and show has a unique fingerprint across 6 dimensions -<br />
						click a pillar to explore its attributes
					</p>
				</div>

				{fingerprintExample && (
					<ShowcaseCard example={fingerprintExample} index={0}>
						<div className="flex flex-col md:flex-row gap-6">
							<Pillars 
								pillars={fingerprintExample.fingerprint_pillars ?? undefined} 
								selectedPillar={selectedPillar}
								onSelect={setSelectedPillar}
							/>
							<div className="flex-1 border-l border-gray-700/50 pl-6">
								<PillarDetails 
									pillar={selectedPillar}
									scores={fingerprintExample.fingerprint_scores ?? undefined}
								/>
							</div>
						</div>
					</ShowcaseCard>
				)}
			</motion.section>

			{/* Streaming Section */}
			<motion.section
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.2 }}
			>
				<div className="text-center mb-10">
					<h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
						See <span className="text-amber-400">Where to Watch</span>
					</h3>
					<p className="text-gray-400 max-w-2xl mx-auto">
						Instantly know which streaming services have your movies and shows available
					</p>
				</div>

				{streamingExample && (
					<ShowcaseCard example={streamingExample} index={1}>
						<div className="flex flex-col flex-wrap gap-2 mt-2">
							{streamingExample.streaming_services.length > 0 ? (
								streamingExample.streaming_services.map((service) => (
									<div
										key={service.id}
										className="flex items-center gap-2 px-3 py-2 bg-gray-700/80 rounded-lg"
									>
										<img
											src={`https://www.themoviedb.org/t/p/original${service.logo_path}`}
											alt={service.name}
											className="w-8 h-8"
										/>
										<span className="text-lg text-gray-300">{service.name}</span>
									</div>
								))
							) : (
								<span className="text-sm text-gray-500 italic">
									Check availability in your region
								</span>
							)}
						</div>
					</ShowcaseCard>
				)}
			</motion.section>

			{/* Ratings Section */}
			<motion.section
				initial={{ opacity: 0, y: 30 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, delay: 0.4 }}
			>
				<div className="text-center mb-10">
					<h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
						<span className="text-amber-400">All Scores</span> in One Place
					</h3>
					<p className="text-gray-400 max-w-2xl mx-auto">
						We aggregate ratings from IMDb, Metacritic, Rotten Tomatoes, and our community
					</p>
				</div>

				{ratingsExample && (
					<ShowcaseCard example={ratingsExample} index={2}>
						<div className="flex flex-col gap-2 mt-2">
							{ratingsExample.ratings.goodwatch && (
								<div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-violet-900/50 rounded-lg border border-violet-600/50">
									<span className="text-violet-300 text-sm font-semibold">GW</span>
									<span className="text-white font-bold text-lg">
										{Math.round(ratingsExample.ratings.goodwatch)}
									</span>
								</div>
							)}
							{ratingsExample.ratings.imdb && (
								<div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-yellow-900/50 rounded-lg border border-yellow-700/50">
									<span className="text-yellow-300 text-sm font-semibold">IMDb</span>
									<span className="text-white font-bold text-lg">
										{ratingsExample.ratings.imdb.toFixed(1)}
									</span>
								</div>
							)}
							{ratingsExample.ratings.metacritic && (
								<div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-green-900/50 rounded-lg border border-green-700/50">
									<span className="text-green-300 text-sm font-semibold">MC</span>
									<span className="text-white font-bold text-lg">
										{Math.round(ratingsExample.ratings.metacritic)}
									</span>
								</div>
							)}
							{ratingsExample.ratings.rotten_tomatoes && (
								<div className="flex items-center justify-between gap-1.5 px-3 py-1.5 bg-red-900/50 rounded-lg border border-red-700/50">
									<span className="text-red-300 text-sm font-semibold">RT</span>
									<span className="text-white font-bold text-lg">
										{Math.round(ratingsExample.ratings.rotten_tomatoes)}%
									</span>
								</div>
							)}
						</div>
					</ShowcaseCard>
				)}
			</motion.section>

			{/* Call to Action */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 0.6 }}
				className="text-center"
			>
				<motion.a
					whileHover={{ y: -2 }}
					whileTap={{ scale: 0.98 }}
					href="/taste"
					className="inline-flex items-center gap-1 px-12 py-4 bg-amber-700 hover:bg-amber-600 text-white text-2xl font-semibold rounded-2xl shadow-lg transition-colors cursor-pointer"
				>
					<span>Start Your Journey</span>
					<span>→</span>
				</motion.a>
				<p className="mt-6 text-sm text-gray-500">
					Rate just a few movies to see your personalized recommendations
				</p>
			</motion.div>
		</div>
	)
}
