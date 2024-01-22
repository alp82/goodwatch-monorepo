import React from 'react'
import placeholder from '~/img/placeholder-poster.png'

export interface PosterProps {
  path?: string
  title?: string
  loading?: boolean
}

export function Poster({ path, title, loading = false }: PosterProps) {
  const url = path ? `https://www.themoviedb.org/t/p/w300_and_h450_bestv2${path}` : placeholder
  return <img
    className={`block rounded-md ${loading ? 'animate-pulse brightness-50' : ''}`}
    src={url}
    alt={title && `Poster for ${title}`}
  />
}