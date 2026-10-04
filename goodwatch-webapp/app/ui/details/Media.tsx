import { useState } from "react"
import type { Videos as VideosType } from "~/server/details.server"
import InfoBox from "~/ui/InfoBox"
import { TmdbImage } from "~/ui/TmdbImage"
import { YoutubePlayer } from "~/ui/details/YoutubePlayer"
import { PlayPill } from "~/ui/details/hero/Trailer"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"
import type { SizeRule } from "~/utils/tmdb-image"

export const allTypes = [
	"trailers",
	"teasers",
	"clips",
	"opening creditss",
	"featurettes",
	"behind the sceness",
	"bloopers",
]

export interface MediaProps {
	videos: VideosType
	/** The title's name and backdrop, for the image a video shows until it is played. */
	title: string
	backdropPath?: string | null
}

// The video is as wide as the page content.
const VIDEO_POSTER_SIZES: SizeRule[] = [
	["(min-width: 1280px)", "1216px"],
	[null, "100vw"],
]

const typeLabel = (type: string) =>
	type.charAt(0).toUpperCase() + type.slice(1, -1)

export default function Media({ videos, title, backdropPath }: MediaProps) {
	const types = Object.keys(videos || {})
	const [selectedType, setSelectedType] = useState(
		allTypes.find((type) => types.includes(type)) || allTypes[0],
	)
	const [selectedNumber, setSelectedNumber] = useState(0)
	// The key of the video the visitor started. The player and YouTube's scripts load only then.
	const [playingKey, setPlayingKey] = useState<string | null>(null)
	const selectedVideos = videos?.[selectedType] || []

	const typeTabs: Tab[] = allTypes
		.filter((type) => types.includes(type))
		.map((type) => {
			return {
				key: type,
				label: typeLabel(type),
				current: type === selectedType,
			}
		})

	const numberTabs: Tab[] = selectedVideos.map((video, index) => {
		const number = (index + 1).toString()
		return {
			key: number,
			label: number,
			current: number === (selectedNumber + 1).toString(),
		}
	})

	const handleTypeSelection = (tab: Tab) => {
		setSelectedType(tab.key)
		setSelectedNumber(0)
	}

	const handleNumberSelection = (tab: Tab) => {
		setSelectedNumber(Number.parseInt(tab.key) - 1)
	}

	const selectedKey = selectedVideos[selectedNumber]?.key
	const playLabel = `Play ${typeLabel(selectedType).toLowerCase()}`

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold">Media</h2>
			{types.length ? (
				<>
					<div className="mt-6 mb-2">
						<Tabs tabs={typeTabs} pills={true} onSelect={handleTypeSelection} />
					</div>
					{selectedVideos.length > 1 && (
						<div className="mb-2">
							<Tabs
								tabs={numberTabs}
								pills={true}
								onSelect={handleNumberSelection}
							/>
						</div>
					)}
					{selectedKey && (
						<div className="relative aspect-16/9 overflow-hidden bg-black">
							{playingKey === selectedKey ? (
								<YoutubePlayer key={selectedKey} videoKey={selectedKey} />
							) : (
								<button
									type="button"
									onClick={() => setPlayingKey(selectedKey)}
									aria-label={`${playLabel} for ${title}`}
									className="group absolute inset-0 block h-full w-full cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber-300"
								>
									<TmdbImage
										kind="backdrop"
										path={backdropPath}
										sizes={VIDEO_POSTER_SIZES}
										maxWidth={1216}
										className="absolute inset-0 h-full w-full object-cover"
										draggable={false}
									/>
									<span
										aria-hidden="true"
										className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/40 motion-reduce:transition-none"
									/>
									<PlayPill label={playLabel} />
								</button>
							)}
						</div>
					)}
				</>
			) : (
				<InfoBox text="No videos available" />
			)}
		</div>
	)
}
