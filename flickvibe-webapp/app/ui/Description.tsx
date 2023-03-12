import React from 'react'

export interface DescriptionProps {
  description: string
}

export default function Description({ description }: DescriptionProps) {
  return (
    <>
      {description && <>
        <div className="mb-4 prose-sm lg:prose-xl dark:prose-invert line-clamp-4">
         {description}
        </div>
      </>}
    </>
  )
}
