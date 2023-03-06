import { InformationCircleIcon } from '@heroicons/react/20/solid'

export interface InfoBoxProps {
  text: string
}

export default function InfoBox({ text }: InfoBoxProps) {
  return (
    <div className="rounded-md bg-blue-900 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <InformationCircleIcon className="h-5 w-5 text-blue-200" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="text-sm text-blue-200">{text}</p>
        </div>
      </div>
    </div>
  )
}