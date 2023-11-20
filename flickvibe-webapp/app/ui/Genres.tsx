import React from 'react'
import {MediaType} from "~/server/search.server";

export interface GenresProps {
  genres: string[]
  type: MediaType
}

export default function Genres({ genres, type }: GenresProps) {
  return (
    <>
      {genres && <>
        <div className="mb-4 flex flex-wrap gap-2">
          {genres.map((genre) => (
            // TODO genre id for discover
            <a key={genre} href={`/discover?type=${type}&with_genres=${genre}`} className="ml-2 px-2.5 py-0.5 inline-flex items-center rounded-md font-medium border-2 border-slate-600 text-slate-100 bg-slate-800 hover:text-white hover:bg-slate-900">
               {genre}
            </a>
          ))}
        </div>
      </>}
    </>
  )
}
