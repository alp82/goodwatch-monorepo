import React, { useState } from 'react'
import { Description, Dialog, DialogDescription, DialogPanel, DialogTitle } from '@headlessui/react'

import { useUser } from '~/utils/auth'
import { GoogleSignInButton } from '~/ui/auth/GoogleSignInButton'

export interface UserActionProps {
  children: React.ReactElement
  instructions: React.ReactNode
}

export default function UserAction({ children, instructions }: UserActionProps) {
  const { user } = useUser()
  const isLoggedIn = Boolean(user)

  const [isOpen, setIsOpen] = useState(false)
  const [modalPosition, setModalPosition] = useState({ top: 0, left: 0 })

  const handleClick = (e: MouseEvent) => {
    if (isLoggedIn) {
      // Perform the intended action
      if (children.props.onClick) {
        children.props.onClick(e)
      }
    } else {
      // Show modal
      const rect = (e.target as HTMLElement).getBoundingClientRect()
      const modalWidth = 400 // Fixed width for the modal
      const modalHeight = 200 // Approximate height for the modal

      let top = rect.bottom + window.scrollY
      let left = rect.left + window.scrollX

      // Adjust horizontal position if modal exceeds viewport width
      if (left + modalWidth > window.innerWidth) {
        left = window.innerWidth - modalWidth - 16 // Add some margin
      }

      // Adjust vertical position if modal exceeds viewport height
      if (top + modalHeight > window.innerHeight) {
        top = rect.top + window.scrollY - modalHeight - 16 // Add some margin
      }

      setModalPosition({ top, left })
      setIsOpen(true)
    }
  }

  return (
    <>
      {React.cloneElement(children, { onClick: handleClick })}
      {!isLoggedIn && isOpen && (
        <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div
            className="absolute w-[400px] p-8 z-10 bg-gray-700 border-8 border-gray-600 rounded-lg shadow-2xl"
            style={{top: modalPosition.top, left: modalPosition.left}}
          >
            <DialogTitle className="text-xl font-medium text-gray-100">Please Sign In</DialogTitle>
            <Description className="mt-4 text-lg text-gray-300 leading-6">
              {instructions}
            </Description>
            <DialogPanel className="mt-8">
              <GoogleSignInButton/>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </>
  )
}