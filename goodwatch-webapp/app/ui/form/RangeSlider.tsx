import type React from "react"
import { Range, getTrackBackground } from "react-range"
import type { IProps } from "react-range/lib/types"
import type { Optional } from "~/utils/types"

// explicitly declaring default options as optional
// because react-range types are inaccurate
export interface RangeSliderProps
	extends Optional<
		IProps,
		| "allowOverlap"
		| "direction"
		| "disabled"
		| "draggableTrack"
		| "labelledBy"
		| "rtl"
		| "renderThumb"
		| "renderTrack"
	> {}

export const RangeSlider = ({ ...params }: RangeSliderProps) => {
	const defaultColor = "rgb(37 99 235)"

	return (
		<div className="my-2 mx-2">
			<Range
				{...params}
				renderTrack={({ props, children }) => {
					const { ref, ...topLevelProps } = props
					return (
						<div {...topLevelProps} className="h-1 bg-stone-400">
							<div
								ref={ref}
								style={{
									height: "5px",
									width: "100%",
									borderRadius: "4px",
									background: getTrackBackground({
										values: params.values,
										min: params.min,
										max: params.max,
										colors: ["transparent", defaultColor, "transparent"],
									}),
									alignSelf: "center",
								}}
							>
								{children}
							</div>
						</div>
					)
				}}
				renderMark={({ props, index }) => {
					const value = index * params.step
					const isInRange = value > params.values[0] && value < params.values[1]
					return (
						<div
							{...props}
							key={props.key}
							className={`
								w-1 h-3
								${isInRange ? "bg-blue-600" : "bg-stone-400"}
							`}
						/>
					)
				}}
				renderThumb={({ props }) => {
					return (
						<div
							{...props}
							key={props.key}
							className="h-5 w-5 rounded-full bg-blue-600"
							style={{
								// top: "-0.55em",
								// left: `calc(${value}% - 0.75em)`,
								...props.style,
							}}
						/>
					)
				}}
			/>
		</div>
	)
}
