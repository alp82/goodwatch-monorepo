import {
	ClipboardDocumentCheckIcon,
	ShareIcon,
} from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import React, { useState } from "react"
import { toast } from "react-toastify"

const isBrowser = typeof window !== "undefined"

export interface ShareButtonProps {
	link?: string
}

export default function ShareButton({ link }: ShareButtonProps) {
	const location = useLocation()

	const hasShareFunctionality = isBrowser && navigator.share
	const linkToShare =
		link || `https://goodwatch.app${location.pathname}${location.search}`

	const handleShare = () => {
		if (hasShareFunctionality) {
			handleOpenShareMenu()
		} else {
			handleCopyLink()
		}
	}

	const [isSharing, setIsSharing] = useState(false)
	const handleOpenShareMenu = async () => {
		if (isSharing) return

		try {
			setIsSharing(true)
			const shareData = {
				url: linkToShare,
			}
			await navigator.share(shareData)
		} catch (error) {
			console.error("Error while sharing:", error)
		} finally {
			setIsSharing(false)
		}
	}

	const handleCopyLink = () => {
		navigator.clipboard.writeText(linkToShare)
		toast(
			<div className="flex gap-2">
				<ClipboardDocumentCheckIcon className="h-4 w-auto" />
				Copied link to clipboard
			</div>,
			{
				position: "top-center",
				autoClose: 5000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				progress: undefined,
				theme: "dark",
			},
		)
	}

	return (
		<div className="absolute top-0 md:top-2 right-3 flex flex-col items-end">
			<button
				type="button"
				className="flex items-center gap-2 p-2 border-2 rounded-lg border-gray-700 hover:border-indigo-700 bg-black/[.5] hover:bg-gray-800 cursor-pointer"
				onClick={handleShare}
			>
				<ShareIcon className="h-3 md:h-5" />
				<span className="text-sm md:text-base">Share</span>
			</button>
		</div>
	)
}
