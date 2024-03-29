import React, { Fragment, useState } from 'react'
import { PlayCircleIcon } from '@heroicons/react/24/solid'
import { Videos } from '~/server/details.server'
import { Tab } from '~/ui/Tabs'
import { Dialog, Transition } from '@headlessui/react'
import YouTube from 'react-youtube'

const videoOpts = {
  width: '100%',
  height: '100%',
  playerVars: {
    // https://developers.google.com/youtube/player_parameters
    autoplay: 1,
  },
}

export interface TrailerOverlayProps {
  videos: Videos
}

export default function TrailerOverlay({ videos }: TrailerOverlayProps) {
  const hasTrailers = videos?.trailers?.length
  const [open, setOpen] = useState(false)

  const handleShowTrailer = () => {
    setOpen(true)
  }

  return (
    <>
      {hasTrailers ? (
        <>
          <a className="absolute flex flex-col items-center justify-center w-full h-full bg-black bg-opacity-0 hover:bg-opacity-50 cursor-pointer" onClick={handleShowTrailer}>
            <PlayCircleIcon className="relative bottom-4 w-16 h-16 md:w-24 md:h-24 lg:w-32 lg:h-32 mx-auto opacity-80" />
            <p className="absolute bottom-3 py-2 w-full bg-black bg-opacity-80 font-bold text-center">Play Trailer</p>
          </a>
          <Transition.Root show={open} as={Fragment}>
            <Dialog as="div" className="relative z-10" onClose={setOpen}>
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
              </Transition.Child>

              <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center">
                  <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-75"
                    enterTo="opacity-100 translate-y-0 sm:scale-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                    leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-75"
                  >
                    <Dialog.Panel className="relative mt-12 w-full transform overflow-hidden rounded-lg bg-slate-700 p-4 shadow-xl transition-all">
                      <div className="aspect-w-16 aspect-h-9">
                        <YouTube videoId={videos.trailers[0].key} opts={videoOpts} />
                      </div>
                    </Dialog.Panel>
                  </Transition.Child>
                </div>
              </div>
            </Dialog>
          </Transition.Root>
        </>
      ) : null}
    </>
  )
}
