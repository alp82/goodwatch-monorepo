import React, { useState } from 'react'
import { useLocation } from '@remix-run/react'
import { ClipboardDocumentCheckIcon, ClipboardIcon, QueueListIcon, ShareIcon } from '@heroicons/react/24/solid'
import { toast, ToastContainer } from 'react-toastify'
import { useOutsideClick } from '~/utils/interaction'

const isBrowser = typeof window !== 'undefined'

export interface ShareButtonProps {
  link?: string
}

export default function ShareButton({ link }: ShareButtonProps) {
  const location = useLocation()
  const [showMenu, setShowMenu] = useState(false)

  const hasShareFunctionality = isBrowser && navigator.share
  const linkToShare = link || `https://goodwatch.app${location.pathname}${location.search}`

  const ref = useOutsideClick(() => {
    setShowMenu(false)
  })

  const handleToggleMenu = () => {
    setShowMenu(visible => !visible)
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
    setShowMenu(false)
  }

  const handleOpenShareMenu = async () => {
    const shareData = {
      url: linkToShare,
    };
    await navigator.share(shareData)
    console.log("Shared link successfully")
    setShowMenu(false)
  }

  return (
    <div ref={ref} className="absolute top-8 right-4 md:top-4 flex flex-col items-end">
      <ShareIcon className="mb-1 h-10 lg:h-12 w-auto p-2 border-2 rounded-full border-indigo-800 bg-black/[.5] hover:bg-indigo-800 cursor-pointer" onClick={handleToggleMenu} />
      {showMenu && <>
        <div className="right-0 top-10 border-indigo-800 bg-black/[.8] cursor-pointer">
          <div className="flex gap-2 items-center w-full px-4 py-2 hover:bg-indigo-800" onClick={handleCopyLink}>
            <ClipboardIcon className="h-4" />
            Copy link
          </div>
        </div>
        {hasShareFunctionality && <div className="right-0 top-10 border-indigo-800 bg-black/[.8] cursor-pointer">
          <div className="flex gap-2 items-center w-full px-4 py-2 hover:bg-indigo-800" onClick={handleOpenShareMenu}>
            <QueueListIcon className="h-4" />
            Open share menu
          </div>
        </div>}
      </>}
    </div>
  )
}
