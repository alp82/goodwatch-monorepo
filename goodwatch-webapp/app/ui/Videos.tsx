import React, {useState} from 'react'
import Tabs, {Tab} from "~/ui/Tabs";
import YouTube from "react-youtube";
import {Videos as VideosType} from "~/server/details.server";
import InfoBox from "~/ui/InfoBox";

export const allTypes = [
  'trailers',
  'teasers',
  'clips',
  'opening creditss',
  'featurettes',
  'behind the sceness',
  'bloopers',
]

export interface VideosProps {
  videos: VideosType
}

export default function Videos({ videos }: VideosProps) {
  const types = Object.keys(videos || {})
  const [selectedType, setSelectedType] = useState(allTypes.find((type) => types.includes(type)) || allTypes[0])
  const [selectedNumber, setSelectedNumber] = useState(0)
  const selectedVideos = videos?.[selectedType] || []

  const typeTabs: Tab[] = allTypes.filter((type) => types.includes(type)).map((type) => {
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
    setSelectedNumber(parseInt(tab.key) - 1)
  }

  const videoOpts = {
    width: '100%',
    height: '100%',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
    },
  }

  return (
    <div className="mt-8">
      <div className="mb-2 text-lg font-bold">Videos</div>
      {types.length ? (
        <>
          <div className="mb-2">
            <Tabs tabs={typeTabs} pills={true} onSelect={handleTypeSelection} />
          </div>
          {selectedVideos.length > 1 && <div className="mb-2">
            <Tabs tabs={numberTabs} pills={true} onSelect={handleNumberSelection} />
          </div>}
          <div className="aspect-w-16 aspect-h-9">
            <YouTube videoId={selectedVideos[selectedNumber].key} opts={videoOpts} />
          </div>
        </>
      ) : (
        <InfoBox text="No videos available" />
      )}
    </div>
  )
}
