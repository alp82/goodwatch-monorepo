import React from 'react'
import { Keywords } from '~/server/details.server'
import {MediaType} from "~/server/search.server";

export interface KeywordsProps {
  keywords: string[]
  type: MediaType
}

export default function Keywords({ keywords, type }: KeywordsProps) {

  return (
    <div className="mb-8">
      {keywords?.length > 0 && <>
        <div className="mt-6 mb-2 text-lg font-bold">Keywords</div>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <a key={keyword} href={`/discover?type=${type}&withKeywords=${keyword}`} className="px-2 py-0.5 inline-flex items-center rounded text-xs font-medium border-2 border-sky-600 text-sky-100 bg-sky-800 hover:text-white hover:bg-sky-900">
              {keyword}
            </a>
          ))}
        </div>
      </>}
    </div>
  )
}
