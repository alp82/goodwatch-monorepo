import React, { useState } from 'react'
import { Dialog } from '@headlessui/react'

import { useUser } from '~/utils/auth'
import { GoogleSignInButton } from '~/ui/auth/GoogleSignInButton'

export interface UserActionProps {
  children: React.ReactElement
  instructions: React.ReactNode
}

export default function UserAction({ children, instructions }: UserActionProps) {
  const user = useUser()
  const isLoggedIn = Boolean(user)

  const [isOpen, setIsOpen] = useState(false)
  const handleClick = (e: MouseEvent) => {
    if (isLoggedIn) {
      // Perform the intended action
      if (children.props.onClick) {
        children.props.onClick(e)
      }
    } else {
      // Show modal
      setIsOpen(true)
    }
  }

  return (
    <>
      {React.cloneElement(children, { onClick: handleClick })}
      {!isLoggedIn && isOpen && (
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="absolute">
          <div className="fixed inset-0 flex items-center justify-center">
            <Dialog.Overlay className="fixed inset-0 bg-black opacity-50" />
            <div className="p-8 z-10 bg-gray-700 border-8 border-gray-600 rounded-lg shadow-2xl">
              <Dialog.Title className="text-xl font-medium text-gray-100">Please Sign In</Dialog.Title>
              <Dialog.Description className="mt-4 text-lg text-gray-300 leading-6">
                {instructions}
              </Dialog.Description>
              <Dialog.Panel className="mt-8">
                <GoogleSignInButton />
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      )}
    </>
  )
}