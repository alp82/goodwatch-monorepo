import React from 'react'
import { PlusCircleIcon, MinusCircleIcon, EyeIcon, EyeSlashIcon, HeartIcon } from '@heroicons/react/24/solid'

export interface WatchStatusBlockProps {
}

export default function WatchStatusBlock({}: WatchStatusBlockProps) {
  const isInWatchList = false
  const hasBeenWatched = false
  const isFavorite = false

  // TODO: label for current state, mouse over switches to action (mobile?)
  // TODO: watchlist -> watch again

  const WatchListIcon = isInWatchList ? MinusCircleIcon : PlusCircleIcon
  const watchListColor = isInWatchList ? 'text-gray-400' : 'text-green-500'
  const watchlistText = isInWatchList ? 'Remove from Watchlist' : 'Add to Watchlist'

  const WatchedIcon = hasBeenWatched ? EyeIcon : EyeSlashIcon
  const watchedColor = hasBeenWatched ? 'text-green-500' : 'text-gray-400'
  const watchedText = hasBeenWatched ? 'Watched it' : 'Didn\'t watch it'

  const FavoriteIcon = HeartIcon
  const favoriteColor = isFavorite ? 'text-red-500' : 'text-gray-400'
  const favoriteText = isFavorite ? 'Remove from Favorites' : 'Add to Favorites'

  return (
    <div className="mb-4 md:divide-y divide-gray-600 overflow-hidden py-2 rounded-lg bg-gray-900 bg-opacity-50 shadow">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-evenly px-4 py-2 md:py-4">
        <a
          href="#"
          className="rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm lg:text-md font-semibold text-white shadow-sm bg-slate-700 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        >
          <WatchListIcon className={`h-5 w-auto ${watchListColor}`} />
          {watchlistText}
        </a>
        <a
          href="#"
          className="rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm lg:text-md font-semibold text-white shadow-sm bg-slate-700 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        >
          <WatchedIcon className={`h-5 w-auto ${watchedColor}`} />
          {watchedText}
        </a>
      </div>
      <div className="flex flex-col md:flex-row gap-4 items-center justify-evenly px-4 py-2 md:py-4">
        <a
          href="#"
          className="rounded-md w-full px-3.5 py-2.5 flex items-center justify-center gap-2 text-sm lg:text-lg font-semibold text-white shadow-sm bg-slate-700 hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-700"
        >
          <FavoriteIcon className={`h-5 w-auto ${favoriteColor}`} />
          {favoriteText}
        </a>
      </div>
    </div>
  )
}
