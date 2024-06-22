import React from "react"
import { Spoiler } from "spoiled"
import dnaIcon from "~/img/dna-icon.svg"
import type { DNA } from "~/server/details.server"
import Sparkles from "~/ui/Sparkles"

export interface DNAProps {
	dna: DNA
}

export default function DNADisplay({ dna }: DNAProps) {
	const hasDNA = Object.keys(dna).length > 0
	const sortedCategories = [
		"Sub-Genres",
		"Mood/Attitudes",
		"Memorable Moments",
		"Plot",
		"Place",
		"Time/Period",
		"Pacing",
		"Narrative Structure",
		"Dialog Style",
		"Score and Sound Design",
		"Character Archetypes",
		"Visual Style",
		"Cinematic Techniques",
		"Costume and Set Design",
		"Key Objects/Props",
		"Target Audience",
		"Flag",
	]

	const getColor = (category: string) => {
		switch (category) {
			case "Cinematic Techniques":
				return "bg-violet-700"
			case "Character Archetypes":
				return "bg-fuchsia-700"
			case "Costume and Set Design":
				return "bg-teal-700"
			case "Dialog Style":
				return "bg-stone-700"
			case "Flag":
				return "bg-red-700"
			case "Key Objects/Props":
				return "bg-zinc-700"
			case "Memorable Moments":
				return "bg-green-700"
			case "Mood/Attitudes":
				return "bg-cyan-700"
			case "Narrative Structure":
				return "bg-indigo-700"
			case "Pacing":
				return "bg-purple-700"
			case "Plot":
				return "bg-blue-700"
			case "Place":
				return "bg-emerald-700"
			case "Score and Sound Design":
				return "bg-lime-700"
			case "Sub-Genres":
				return "bg-stone-700"
			case "Target Audience":
				return "bg-pink-700"
			case "Time/Period":
				return "bg-orange-700"
			case "Visual Style":
				return "bg-amber-700"
			default:
				return "text-gray-500"
		}
	}

	const [showDNA, setShowDNA] = React.useState(false)
	const handleToggleDNA = () => {
		setShowDNA(!showDNA)
		setRevealSpoiler(false)
	}

	const spoilerCategories = ["Plot", "Memorable Moments"]
	const [revealSpoiler, setRevealSpoiler] = React.useState(false)
	const handleRevealSpoiler = () => {
		setRevealSpoiler(true)
	}

	return (
		<>
			{hasDNA && (
				<div className="relative">
					<Sparkles>
						<div
							className="h-7 accent-bg rounded-md px-2 flex items-center justify-center gap-2 text-sm font-semibold shadow-sm cursor-pointer"
							onClick={handleToggleDNA}
						>
							<img src={dnaIcon} className="h-5 w-auto" alt="DNA Icon" />
							Show DNA
						</div>
					</Sparkles>
					{showDNA && (
						<div className="absolute w-[600px] z-10 mt-1 px-4 rounded-md border border-slate-700 bg-slate-950/60 backdrop-blur">
							{sortedCategories.map((category) => (
								<dl key={category} className="divide-y divide-white/10">
									<div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
										<dt className="text-sm font-medium leading-6 text-white">
											{category}
										</dt>
										<dd
											className={`mt-1 text-sm leading-6 text-gray-400 sm:col-span-2 sm:mt-0 flex flex-wrap gap-2 ${spoilerCategories.includes(category) ? "cursor-pointer" : ""}`}
										>
											{dna[category].map((item) => (
												<Spoiler
													key={item}
													hidden={
														spoilerCategories.includes(category) &&
														!revealSpoiler
													}
													theme="dark"
													accentColor={"#55c8f7"}
													density={0.15}
													onClick={handleRevealSpoiler}
												>
													<span
														className={`${getColor(category)} text-white border-gray-600 border-2 px-2 rounded-md`}
													>
														{item}
													</span>
												</Spoiler>
											))}
										</dd>
									</div>
								</dl>
							))}
						</div>
					)}
				</div>
			)}
		</>
	)
}
