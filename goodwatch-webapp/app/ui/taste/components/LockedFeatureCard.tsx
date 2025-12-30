import { LockClosedIcon } from "@heroicons/react/24/solid"
import type { Feature } from "../features"

interface LockedFeatureCardProps {
	feature: Feature
	ratingsCount: number
}

export default function LockedFeatureCard({ feature, ratingsCount }: LockedFeatureCardProps) {
	const progress = (ratingsCount / feature.unlockAt) * 100

	return (
		<div className="flex items-center gap-4 p-4 rounded-xl border border-gray-800/50 bg-gray-900/30 opacity-60">
			<div className="text-2xl grayscale">{feature.icon}</div>
			<div className="flex-1">
				<div className="flex items-center gap-2">
					<h3 className="font-medium text-gray-400">{feature.name}</h3>
					<LockClosedIcon className="w-4 h-4 text-gray-600" />
				</div>
				<div className="flex items-center gap-2 mt-1">
					<div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden max-w-[100px]">
						<div 
							className="h-full bg-gray-600 rounded-full"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<span className="text-xs text-gray-500">
						{feature.unlockAt - ratingsCount} to go
					</span>
				</div>
			</div>
		</div>
	)
}
