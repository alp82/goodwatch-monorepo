import React, {useState} from 'react'
import Tabs, {Tab} from "~/ui/Tabs";
import YouTube from "react-youtube";
import {VideoResult} from "~/server/details.server";
import InfoBox from "~/ui/InfoBox";

export interface VideosProps {
  results: VideoResult[]
}

export default function Videos({ results }: VideosProps) {
  const videos = (results || []).sort((a: VideoResult, b: VideoResult) => {
    return a.published_at < b.published_at ? -1 : 1
  })

  const types: string[] = []
  videos.forEach((video) => {
    if (!types.includes(video.type)) {
      types.push(video.type)
    }
  })

  const [selectedType, setSelectedType] = useState(types[0])
  const [selectedNumber, setSelectedNumber] = useState(0)
  const selectedVideos = videos.filter((video) => video.type === selectedType)

  const typeTabs: Tab[] = types.map((type) => {
    return {
      key: type,
      label: type,
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
    height: '100%',
    width: '100%',
    playerVars: {
      // https://developers.google.com/youtube/player_parameters
      autoplay: 0,
    },
  }

  return (
    <div className="mt-8">
      <div className="mb-2 text-lg font-bold">Videos</div>
      {videos.length ? (
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
