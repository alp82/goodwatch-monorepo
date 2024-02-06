import React from 'react'
import { useLocation } from '@remix-run/react'
import { ClipboardDocumentCheckIcon, ShareIcon } from '@heroicons/react/24/solid'
import { toast } from 'react-toastify'

const isBrowser = typeof window !== 'undefined'

export interface ShareButtonProps {
  link?: string
}

export default function ShareButton({ link }: ShareButtonProps) {
  const location = useLocation()

  const hasShareFunctionality = isBrowser && navigator.share
  const linkToShare = link || `https://goodwatch.app${location.pathname}${location.search}`

  const handleShare = () => {
    if (hasShareFunctionality) {
      handleOpenShareMenu()
    } else {
      handleCopyLink()
    }
  }

  const handleOpenShareMenu = async () => {
    const shareData = {
      url: linkToShare,
    };
    await navigator.share(shareData)
    console.log("Shared link successfully")
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkToShare)
    toast(<div className="flex gap-2">
      <ClipboardDocumentCheckIcon className="h-4 w-auto" />
      Copied link to clipboard
    </div>, {
      position: "top-center",
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
      progress: undefined,
      theme: "dark",
    });
  }

  return (
    <div className="absolute top-8 right-4 md:top-4 flex flex-col items-end">
      <ShareIcon className="mb-1 h-10 lg:h-12 w-auto p-2 border-2 rounded-full border-indigo-800 bg-black/[.5] hover:bg-indigo-800 cursor-pointer" onClick={handleShare} />
    </div>
  )
}
