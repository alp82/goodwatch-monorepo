import React from 'react'
import { Cast } from '~/server/details.server'

export interface CastProps {
  cast: Cast[]
}

export default function Cast({ cast }: CastProps) {
  const castWithPhotos = (cast || []).filter((castMember) => castMember.profile_path)
  const castWithoutPhotos = (cast || []).filter((castMember) => !castMember.profile_path)
  return (
    <>
      <div className="flex flex-wrap gap-4">
        {(castWithPhotos || []).map((castMember) => {
          const character = castMember.character || castMember.roles?.[0].character
          return (
            <div className="w-36 h-72 border-2 border-gray-800 flex flex-col items-center">
              <img
                className="w-full h-auto"
                src={`https://www.themoviedb.org/t/p/original/${castMember.profile_path}`}
                alt={`${castMember.name} profile photo`}
              />
              <div className="w-full h-full px-2 bg-gray-700">
                <p className="text-sm text-center font-bold truncate w-full mt-3"
                   title={castMember.name}>{castMember.name}</p>
                <p className="text-sm text-center font-italic truncate w-full mt-2"
                   title={character}>{character}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-8 flex flex-wrap gap-4">
        {(castWithoutPhotos || []).map((castMember) => {
          const character = castMember.character || castMember.roles?.[0].character
          return (
            <div className="w-64 h-16">
              <strong>{castMember.name}</strong> {character && <>as <em>{character}</em></>}
            </div>
          )
        })}
      </div>
    </>
  )
}
