import React from 'react'
import { Keywords } from '~/server/details.server'

export interface KeywordsProps {
  keywords: Keywords
}

export default function Keywords({ keywords }: KeywordsProps) {

  return (
    <>
      {keywords?.results && <>
        <div className="mt-6 mb-2 text-lg font-bold">Keywords</div>
        <div className="flex flex-wrap gap-2">
          {keywords.results.map((keyword) => (
            <a key={keyword.id} href={`/discover?with_keywords=${keyword.id}`} className="px-2 py-0.5 inline-flex items-center rounded text-xs font-medium border-2 border-sky-600 text-sky-100 bg-sky-800 hover:text-white hover:bg-sky-900">
              {keyword.name}
            </a>
          ))}
        </div>
      </>}
    </>
  )
}
