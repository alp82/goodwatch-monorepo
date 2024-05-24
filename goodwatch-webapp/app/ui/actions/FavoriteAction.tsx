import React from 'react'
import { useLoaderData } from '@remix-run/react'
import UserAction from '~/ui/auth/UserAction'
import { LoaderData } from '~/routes/movie.$movieKey'
import { MovieDetails, TVDetails } from '~/server/details.server'
import { UpdateFavoritesPayload, UpdateFavoritesResult } from '~/server/favorites.server'
import { useAPIAction } from '~/utils/api-action'


export interface FavoriteActionProps {
  children: React.ReactElement
  details: MovieDetails | TVDetails
}

export default function FavoriteAction({ children, details }: FavoriteActionProps) {
  const { tmdb_id, media_type } = details

  const { favorites } = useLoaderData<LoaderData>()
  const action = favorites?.[media_type]?.[tmdb_id]?.onFavorites ? "remove" : "add"

  const {
    submitProps
  } = useAPIAction<UpdateFavoritesPayload, UpdateFavoritesResult>({
    url: "/api/favorites",
    params: {
      tmdb_id,
      media_type,
      action,
    }
  })

  return (
    <UserAction instructions={<>Save your all-time favorites.</>}>
      <>
        {React.cloneElement(children, { ...submitProps })}
      </>
    </UserAction>
  )
}
