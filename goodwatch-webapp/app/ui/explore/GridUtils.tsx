import React from 'react'
import { Link } from '@remix-run/react'
import { Spinner } from '~/ui/wait/Spinner'

/**
 * Loading indicator component for the grid
 */
export const GridLoadingIndicator = () => (
  <div className="h-60 col-span-full flex justify-center items-center">
    <Spinner size="large" /> Loading initial results...
  </div>
)

/**
 * Error display component for the grid
 */
export interface GridErrorProps {
  message: string
}

export const GridError = ({ message }: GridErrorProps) => (
  <div className="my-6 text-lg italic text-red-500 col-span-full">
    Error: {message}
  </div>
)

/**
 * Empty results message component
 */
export const EmptyResultsMessage = () => (
  <div className="my-6 text-lg italic">
    No results. Try to change your search filters.
  </div>
)

/**
 * End of results message component
 */
export const EndOfResultsMessage = () => (
  <div className="my-6 text-center italic col-span-full">
    You've reached the end of results
  </div>
)

/**
 * Loading more indicator for infinite scroll
 */
export const LoadMoreIndicator = React.forwardRef<HTMLDivElement>(
  (props, ref) => (
    <div
      ref={ref}
      className="h-20 col-span-full flex justify-center items-center"
    >
      {props.children}
    </div>
  )
)

/**
 * Hidden SEO next page link component
 */
export interface NextPageLinkProps {
  url: string | null
}

export const NextPageLink = ({ url }: NextPageLinkProps) => {
  if (!url) return null
  
  return (
    <div className="h-0 overflow-hidden">
      <Link
        to={url}
        prefetch="intent"
        aria-hidden="true"
        tabIndex={-1}
      >
        Next Page
      </Link>
    </div>
  )
}
