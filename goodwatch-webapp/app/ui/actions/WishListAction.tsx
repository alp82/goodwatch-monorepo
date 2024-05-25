import React from 'react'
import { useLoaderData } from '@remix-run/react'
import UserAction from '~/ui/auth/UserAction'
import { LoaderData } from '~/routes/movie.$movieKey'
import { MovieDetails, TVDetails } from '~/server/details.server'
import { UpdateWishListPayload, UpdateWishListResult } from '~/server/wishList.server'
import { useAPIAction } from '~/utils/api-action'


export interface WishListActionProps {
  children: React.ReactElement
  details: MovieDetails | TVDetails
}

export default function WishListAction({ children, details }: WishListActionProps) {
  const { tmdb_id, media_type } = details

  const { userData } = useLoaderData<LoaderData>()
  const action = userData?.[media_type]?.[tmdb_id]?.onWishList ? "remove" : "add"

  const {
    submitProps
  } = useAPIAction<UpdateWishListPayload, UpdateWishListResult>({
    url: "/api/update-wish-list",
    params: {
      tmdb_id,
      media_type,
      action,
    }
  })

  return (
    <UserAction instructions={<>Curate your wishlist to track what you want to watch.</>}>
      <>
        {React.cloneElement(children, { ...submitProps })}
      </>
    </UserAction>
  )
}
