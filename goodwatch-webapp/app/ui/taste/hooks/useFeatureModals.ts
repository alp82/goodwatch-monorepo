import { useState } from "react"
import type { Feature } from "../features"

export const useFeatureModals = () => {
	const [showUnlockModal, setShowUnlockModal] = useState(false)
	const [showFeatureInfo, setShowFeatureInfo] = useState(false)
	const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null)

	const openUnlockModal = (feature: Feature) => {
		setSelectedFeature(feature)
		setShowUnlockModal(true)
	}

	const closeUnlockModal = () => {
		setShowUnlockModal(false)
	}

	const openFeatureInfo = (feature: Feature) => {
		setSelectedFeature(feature)
		setShowFeatureInfo(true)
	}

	const closeFeatureInfo = () => {
		setShowFeatureInfo(false)
		setSelectedFeature(null)
	}

	return {
		showUnlockModal,
		showFeatureInfo,
		selectedFeature,
		openUnlockModal,
		closeUnlockModal,
		openFeatureInfo,
		closeFeatureInfo,
	}
}
