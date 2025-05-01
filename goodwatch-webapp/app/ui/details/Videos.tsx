import React, { useState } from "react"
import ReactPlayer from "react-player/youtube"
import { ClientOnly } from "remix-utils/client-only"
import type { Videos as VideosType } from "~/server/details.server"
import InfoBox from "~/ui/InfoBox"
import Tabs, { type Tab } from "~/ui/tabs/Tabs"

export const allTypes = [
	"trailers",
	"teasers",
	"clips",
	"opening creditss",
	"featurettes",
	"behind the sceness",
	"bloopers",
]

export interface VideosProps {
	videos: VideosType
}

export default function Videos({ videos }: VideosProps) {
	const types = Object.keys(videos || {})
	const [selectedType, setSelectedType] = useState(
		allTypes.find((type) => types.includes(type)) || allTypes[0],
	)
	const [selectedNumber, setSelectedNumber] = useState(0)
	const selectedVideos = videos?.[selectedType] || []

	const typeTabs: Tab[] = allTypes
		.filter((type) => types.includes(type))
		.map((type) => {
			return {
				key: type,
				label: type.charAt(0).toUpperCase() + type.slice(1, -1),
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

	const videoOpts = {
		width: "100%",
		height: "100%",
		playerVars: {
			// https://developers.google.com/youtube/player_parameters
			autoplay: 0,
		},
	}

	return (
		<div className="mt-8">
			<h2 className="text-2xl font-bold">Videos</h2>
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
					{selectedVideos[selectedNumber]?.key && (
						<ClientOnly fallback={<div>Loading video…</div>}>
							{() => (
								<div className="aspect-16/9">
									<ReactPlayer
										url={`https://www.youtube.com/watch?v=${selectedVideos[selectedNumber].key}`}
										width="100%"
										height="100%"
										controls
									/>
								</div>
							)}
						</ClientOnly>
					)}
				</>
			) : (
				<InfoBox text="No videos available" />
			)}
		</div>
	)
}
