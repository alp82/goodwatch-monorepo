import React from 'react'
import { Keywords } from '~/server/details.server'

export interface KeywordsProps {
  keywords: Keywords
}

export default function Keywords({ keywords }: KeywordsProps) {

  return (
    <>
      {keywords?.results && <>
        <div className="mt-2 mb-2 text-lg font-bold">Keywords</div>
        {keywords.results.map((keyword) => (
          <span key={keyword.id} className="mr-2 inline-flex items-center rounded bg-sky-800 px-2 py-0.5 text-xs font-medium text-sky-100">
            {keyword.name}
          </span>
        ))}
      </>}
    </>
  )
}
