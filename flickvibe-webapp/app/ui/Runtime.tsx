import React from 'react'

export interface RuntimeProps {
  minutes: number
}

export default function Runtime({ minutes }: RuntimeProps) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <>
      {h > 0 && <>
        <span className="text-white">{h}</span>
        <span className="text-gray-400 ml-0.5">h </span>
      </>}
      <span className="text-white">{m}</span>
      <span className="text-gray-400 ml-0.5">min</span>
    </>
  )
}
