import React from 'react'

type Subgenre = {
	name: string
	score: number
}

type Props = { 
	subgenres: Subgenre[]
	className?: string 
}

export default function GenreMix({ subgenres, className = '' }: Props): JSX.Element {
	const top3 = subgenres
		.sort((a, b) => b.score - a.score)
		.slice(0, 3)

	const total = top3.reduce((sum, genre) => sum + genre.score, 0)
	
	if (total === 0) {
		return <div className={className}>No genres available</div>
	}

	const colors = ['blue', 'purple', 'green']

	return (
		<div className={`space-y-2 ${className}`}>
			<div className="flex h-6 rounded overflow-hidden">
				{top3.map((genre, index) => {
					const percentage = (genre.score / total) * 100
					return (
						<div
							key={genre.name}
							className={`border-t-4 border-t-${colors[index]}-600 bg-${colors[index]}-900 flex items-center justify-center text-xs font-medium px-2`}
							style={{ width: `${percentage}%` }}
						>
							<span className="hidden md:inline px-1">{percentage > 15 && genre.name}</span>
						</div>
					)
				})}
			</div>
			<div className="flex md:hidden gap-6 text-sm text-gray-600">
				{top3.map((genre, index) => (
					<div key={genre.name} className="flex items-center gap-1">
						<span className={`my-1 px-1 text-gray-300 border-t-4 border-t-${colors[index]}-600 bg-${colors[index]}-900`}>&nbsp;</span>
						<span className="text-xs text-gray-300">{genre.name}</span>
					</div>
				))}
			</div>
		</div>
	)
}
