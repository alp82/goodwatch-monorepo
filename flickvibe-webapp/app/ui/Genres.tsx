import React from 'react'
import { Genre } from '~/server/details.server'

export interface GenresProps {
  genres: Genre[]
}

export default function Genres({ genres }: GenresProps) {
  return (
    <>
      {genres && <>
        <div className="mb-4">
          {genres.map((genre: Genre) => (
            <span className="ml-2 inline-flex items-center rounded-md bg-slate-800 px-2.5 py-0.5 font-medium text-slate-100" key={genre.id}>
               {genre.name}
            </span>
          ))}
        </div>
      </>}
    </>
  )
}
