import React from 'react'
import placeholder from '~/img/placeholder-poster.png'

export interface PosterProps {
  path: string
  title: string
}

export function Poster({ path, title }: PosterProps) {
  const url = path ? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${path}` : placeholder
  return <img
    className="block rounded-md"
    src={url}
    alt={`Poster for ${title}`}
    title={`Poster for ${title}`}
  />
}