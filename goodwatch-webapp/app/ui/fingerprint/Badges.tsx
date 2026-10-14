import React from 'react'

type Badge = {
	label: string
}

type Props = { 
	badges: Badge[]
	className?: string 
}

export default function Badges({ badges, className = '' }: Props): JSX.Element {
	if (badges.length === 0) {
		return <div className={className}>No badges available</div>
	}

	return (
		<div className={`flex flex-wrap items-start gap-2 ${className}`}>
			{badges.map((badge, index) => (
				<span
					key={`${badge.label}-${index}`}
					className="inline px-2 py-1 rounded-md text-xs font-medium text-gray-300 bg-gray-800 border border-gray-600"
				>
					{badge.label}
				</span>
			))}
		</div>
	)
}
