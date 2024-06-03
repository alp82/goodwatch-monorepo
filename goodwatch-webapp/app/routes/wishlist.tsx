import React, { useState } from 'react'
import { json, LoaderFunction, LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData, useNavigation } from '@remix-run/react'
import { AnimatePresence, motion } from 'framer-motion'
import { DiscoverResult } from '~/server/discover.server'
import { MovieCard } from '~/ui/MovieCard'
import { TvCard } from '~/ui/TvCard'
import { getUserData, GetUserDataResult } from '~/server/userData.server'
import { getUserFromRequest } from '~/utils/auth'
import { StreamingLink } from '~/server/details.server'
import { Radio, RadioGroup } from '@headlessui/react'
import WishlistFilter, { FilterByStreaming, SortBy } from '~/ui/filter/WishlistFilter'

export function headers() {
  return {
    "Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
  }
}

export const meta: MetaFunction<typeof loader> = () => {
  return [
    {title: 'Wishlist | GoodWatch'},
    {description: 'All movie and tv show ratings and streaming providers on the same page'},
  ]
}

export type LoaderData = {
  userData?: GetUserDataResult
  currentParams: {
    sortBy: SortBy
    filterByStreaming: FilterByStreaming
  }
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  const user = await getUserFromRequest({ request })
  const userData = await getUserData({ user_id: user?.id })

  const url = new URL(request.url)
  const sortBy = (url.searchParams.get('sortBy') || 'most_recently_added') as SortBy
  const filterByStreaming = (url.searchParams.get('filterByStreaming') || 'all') as FilterByStreaming

  return json<LoaderData>({
    userData,
    currentParams: {
      sortBy,
      filterByStreaming,
    }
  })
}

type WishListItem = {
  media_type: string
  tmdb_id: string
  onWishList: boolean
  onWishListSince: Date | null
  title: string
  poster_path: string
  aggregated_overall_score_normalized_percent: number | null
  streaming_links: StreamingLink[]
}

const convertUserData = (data: GetUserDataResult | undefined): WishListItem[] => {
  const result: WishListItem[] = []

  for (const media_type in data) {
    if (data.hasOwnProperty(media_type)) {
      for (const tmdb_id in data[media_type]) {
        if (data[media_type].hasOwnProperty(tmdb_id)) {
          const entry = data[media_type][tmdb_id]
          if (entry.onWishList) {
            result.push({
              media_type,
              tmdb_id,
              onWishList: entry.onWishList,
              onWishListSince: entry.onWishListSince,
              title: entry.title,
              poster_path: entry.poster_path,
              aggregated_overall_score_normalized_percent: entry.aggregated_overall_score_normalized_percent,
              streaming_links: entry.streaming_links,
            })
          }
        }
      }
    }
  }

  return result
}

export default function Wishlist() {
  const { userData, currentParams } = useLoaderData<LoaderData>()
  const { sortBy, filterByStreaming } = currentParams
  console.log({ userData })

  const handleFilterChange = (filters) => {
    console.log({ filters })
  }

  const wishlist = convertUserData(userData as GetUserDataResult)
  wishlist.sort((a, b) => {
    if (a.onWishListSince && b.onWishListSince) {
      return new Date(b.onWishListSince).getTime() - new Date(a.onWishListSince).getTime()
    } else if (a.onWishListSince && !b.onWishListSince) {
      return -1
    } else if (!a.onWishListSince && b.onWishListSince) {
      return 1
    } else {
      return 0
    }
  })

  wishlist.forEach((result: WishListItem) => {
    const streamingLinks = result.streaming_links || []
    const includedProviders: number[] = []
    result.streaming_links = streamingLinks.reduce((links, link) => {
      if (includedProviders.includes(link.provider_id)
        || (filterByStreaming === 'free' && !["free", "flatrate"].includes(link.stream_type))
        || (filterByStreaming === 'mine' && !["free", "flatrate"].includes(link.stream_type))
      ) {
        return links
      }

      includedProviders.push(link.provider_id)
      return [
        ...links,
        link,
      ]
    }, [] as StreamingLink[])
  })
  const wishlistToShow = wishlist.filter((item) => true)

  const navigation = useNavigation()

  return (
    <div className="max-w-7xl mx-auto px-4 flex flex-col gap-5 sm:gap-6">
      <div className="mt-6 text-lg md:text-xl lg:text-2xl font-semibold">
        My Wishlist
      </div>

      <WishlistFilter
        sortBy={sortBy}
        filterByStreaming={filterByStreaming}
        onChange={handleFilterChange}
      />

      <div
        className={`relative mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4`}>
        <AnimatePresence initial={false}>
          {navigation.state === 'loading' && (
            <span
              className="absolute top-2 left-6 animate-ping inline-flex h-8 w-8 rounded-full bg-sky-300 opacity-75"/>
          )}
          {!wishlist.length && navigation.state === 'idle' ? (
            <div className="my-6 text-lg italic">
              You don't have any titles in your Wishlist.
            </div>
          ) : !wishlistToShow.length && navigation.state === 'idle' ? (
            <div className="my-6 text-lg italic">
              No matches with your current filter settings.
            </div>
          ) : (
            <></>
          )}
          {wishlist.length > 0 && navigation.state === 'idle' && wishlist.map((result: WishListItem, index) => {
            return (
              <div key={result.tmdb_id}>
                <motion.div
                  key={currentParams.sortBy}
                  initial={{y: `-${Math.floor(Math.random() * 10) + 5}%`, opacity: 0}}
                  animate={{y: '0', opacity: 1}}
                  exit={{y: `${Math.floor(Math.random() * 10) + 5}%`, opacity: 0}}
                  transition={{duration: 0.5, type: 'tween'}}
                >
                  {result.media_type === 'movie' && <MovieCard movie={result as DiscoverResult} prefetch={index < 6}/>}
                  {result.media_type === 'tv' && <TvCard tv={result as DiscoverResult} prefetch={index < 6}/>}
                </motion.div>
              </div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}