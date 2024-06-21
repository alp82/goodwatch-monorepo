import React from 'react'
import type { ContentRatingResult, ReleaseDate } from '~/server/details.server'

export interface AgeRatingProps {
  ageRating?: ReleaseDate | ContentRatingResult
}

export default function AgeRating({ ageRating }: AgeRatingProps) {

  return (
    <>
      {ageRating && <>
        <div className="inline-block align-baseline p-1 h-7 border-2 text-sm font-bold text-center">{ageRating.certification || ageRating.rating}</div>
      </>}
    </>
  )
}
