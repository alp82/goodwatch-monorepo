import type { ComponentType, HTMLAttributes } from 'react'
import { useLocation } from '@remix-run/react'
import { CubeIcon, HomeIcon } from '@heroicons/react/24/solid'

export default function BottomNav() {
  const location = useLocation()

  const createButton = (title: string, Icon: ComponentType<HTMLAttributes<SVGElement>>, url: string) => {
    const isActive = location.pathname == url
    return (
      <a href={url} className={`${isActive && 'bg-indigo-900'} hover:bg-indigo-800 inline-flex flex-col items-center justify-center px-5 group`}>
        <Icon className="w-5 h-5 mb-2 text-gray-400 group-hover:text-gray-200" />
        <span className="text-sm text-gray-200 group-hover:text-gray-200">{title}</span>
      </a>
    )
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 z-50 w-full h-16 border-t bg-gray-950 border-gray-800">
      <div className="grid h-full max-w-lg grid-cols-2 mx-auto font-medium">
        {createButton('Home', HomeIcon, '/')}
        {createButton('Discover', CubeIcon, '/discover')}
      </div>
    </div>
  )
}