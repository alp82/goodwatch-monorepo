import { useRef, useState } from "react"

export const useInfoModal = () => {
	const [isOpen, setIsOpen] = useState(false)
	const [position, setPosition] = useState({ top: 0, left: 0 })
	const ref = useRef<HTMLElement>(null)

	const openModal = () => {
		if (ref.current) {
			const rect = ref.current.getBoundingClientRect()
			setPosition({
				// TODO why do i need "- 70"?
				top: rect.bottom + window.scrollY - 70,
				left: rect.left + window.scrollX,
			})
		}
		setIsOpen(true)
	}

	const closeModal = () => setIsOpen(false)

	const toggleModal = () => {
		if (isOpen) closeModal()
		else openModal()
	}

	return { ref, isOpen, position, openModal, closeModal, toggleModal }
}
