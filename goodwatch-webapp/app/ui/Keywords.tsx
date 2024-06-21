import React, { useState } from 'react'
import type {MediaType} from "~/server/search.server";

export interface KeywordProps {
  keyword: string
  type: MediaType
}

const Keyword = ({ keyword, type }: KeywordProps) => {
  return (
    <a key={keyword} href={`/discover?type=${type}&withKeywords=${keyword}`}
       className="px-2 py-0.5 rounded text-xs font-medium border-2 border-sky-800 text-sky-100 bg-sky-950 hover:text-white hover:bg-sky-900">
      {keyword}
    </a>
  )
}

export interface KeywordsProps {
  keywords: string[]
  type: MediaType
}

export default function Keywords({keywords, type}: KeywordsProps) {
  const [expanded, setExpanded] = useState(false)

  const needsExpansion = keywords.length > 8
  const lessKeywords = keywords.slice(0, 6)

  return (
    <div className="mb-8">
      {keywords?.length > 0 && <>
        <div className="mt-6 mb-2 text-lg font-bold">Keywords</div>
        <div className="flex flex-wrap gap-2">
          {needsExpansion ? (
            <>
              {(expanded ? keywords : lessKeywords).map((keyword) => (
                <Keyword key={keyword} keyword={keyword} type={type} />
              ))}
              <button className="px-2 py-0.5 text-xs font-medium text-sky-100 hover:text-white"
                      onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Show less' : 'Show more'}...
              </button>
            </>
          ) : (
            <>
              {keywords.map((keyword) => (
                <Keyword key={keyword} keyword={keyword} type={type} />
              ))}
            </>
          )}
        </div>
      </>}
    </div>
  )
}
