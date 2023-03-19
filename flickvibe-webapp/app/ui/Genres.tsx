import React from 'react'
import { Genre } from '~/server/details.server'

export interface GenresProps {
  genres: Genre[]
}

export default function Genres({ genres }: GenresProps) {
  return (
    <>
      {genres && <>
        <div className="mb-4 flex flex-wrap gap-2">
          {genres.map((genre: Genre) => (
            <a key={genre.id} href={`/discover?with_genres=${genre.id}`} className="ml-2 px-2.5 py-0.5 inline-flex items-center rounded-md font-medium border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900">
               {genre.name}
            </a>
          ))}
        </div>
      </>}
    </>
  )
}
