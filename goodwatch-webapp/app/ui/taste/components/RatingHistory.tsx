import type { LastRatedItem, ScoringMedia, InteractionType } from "~/ui/scoring/types"
import type { Score } from "~/server/scores.server"
import { getVibeColorValue } from "~/utils/ratings"

interface RatingHistoryProps {
	lastRated: LastRatedItem[]
	placeholderCount: number
	onSelectLastRated?: (media: ScoringMedia) => void
	selectedMediaId?: number | null
}

function MiniPoster({ 
	item, 
	onClick,
	isSelected = false
}: { 
	item: { poster_path?: string | null; title?: string; score?: Score | null; tmdb_id?: number; actionType?: InteractionType }
	onClick?: () => void
	isSelected?: boolean
}) {
	const getBadgeContent = () => {
		if (item.actionType === 'skip') return 'Skip'
		if (item.actionType === 'plan') return 'Want'
		return item.score
	}

	const getBadgeStyle = () => {
		if (item.actionType === 'skip') return { backgroundColor: 'rgba(55, 57, 59, 0.9)' }
		if (item.actionType === 'plan') return { backgroundColor: 'rgba(24, 101, 173, 0.9)' }
		if (item.score) return { backgroundColor: getVibeColorValue(item.score) }
		return { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
	}

	return (
		<button
			type="button"
			onClick={onClick}
			className={`relative w-9 h-14 md:w-10 md:h-15 rounded-md overflow-hidden border-2 transition-all hover:scale-105 flex-shrink-0 cursor-pointer ${
				isSelected 
					? 'border-amber-500 ring-2 ring-amber-500/50' 
					: 'border-gray-600/50 hover:border-gray-500'
			}`}
		>
			{item.poster_path ? (
				<img
					src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
					alt={item.title || ""}
					className="w-full h-full object-cover"
				/>
			) : (
				<div className="w-full h-full bg-gray-700 flex items-center justify-center">
					<span className="text-gray-500 text-xs">?</span>
				</div>
			)}
			{(item.score || item.actionType === 'skip' || item.actionType === 'plan') && (
				<div 
					className="absolute bottom-0 left-0 right-0 text-white text-[10px] md:text-xs font-bold text-center"
					style={getBadgeStyle()}
				>
					{getBadgeContent()}
				</div>
			)}
		</button>
	)
}

function PosterPlaceholder({ index }: { index: number }) {
	return (
		<div className="w-8 h-12 md:w-10 md:h-15 rounded-md bg-gray-700/30 border border-dashed border-gray-600/50 flex items-center justify-center flex-shrink-0">
			<span className="text-gray-600 text-xs md:text-sm">{index + 1}</span>
		</div>
	)
}

export default function RatingHistory({
	lastRated,
	placeholderCount,
	onSelectLastRated,
	selectedMediaId,
}: RatingHistoryProps) {
	const lastThreeRated = lastRated.slice(-placeholderCount).reverse()

	return (
		<div className="flex items-center gap-1.5">
			{Array.from({ length: placeholderCount }).map((_, i) => {
				const ratedItem = lastThreeRated[i]
				if (ratedItem) {
					return (
						<MiniPoster
							key={`rated-${ratedItem.media.tmdb_id}-${i}`}
							item={{ 
								poster_path: ratedItem.media.poster_path, 
								title: ratedItem.media.title,
								score: ratedItem.score,
								tmdb_id: ratedItem.media.tmdb_id,
								actionType: ratedItem.actionType
							}}
							onClick={() => onSelectLastRated?.(ratedItem.media)}
							isSelected={selectedMediaId === ratedItem.media.tmdb_id}
						/>
					)
				}
				return <PosterPlaceholder key={`placeholder-${i}`} index={i} />
			})}
		</div>
	)
}
