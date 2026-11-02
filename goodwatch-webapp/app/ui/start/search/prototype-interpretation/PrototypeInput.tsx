// THROWAWAY: compare expanding search fields on the actual start page.
import { useEffect, useRef } from "react"
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { START_SEARCH_INPUT } from "../StartSearchBar"
import "./prototype.css"

export default function PrototypeInput({
	variant,
	value,
	placeholder,
	onChange,
	onFocus,
	onClear,
}: {
	variant: string
	value: string
	placeholder: string
	onChange: (value: string) => void
	onFocus: () => void
	onClear: () => void
}) {
	const field = useRef<HTMLTextAreaElement>(null)
	useEffect(() => {
		const resize = () => {
			const el = field.current
			if (!el) return
			el.style.height = "auto"
			const line = Number.parseFloat(getComputedStyle(el).lineHeight)
			el.style.height = `${Math.min(el.scrollHeight, line * (variant === "I3" ? 5 : 3))}px`
		}
		resize()
		window.addEventListener("resize", resize)
		return () => window.removeEventListener("resize", resize)
	}, [value, variant])
	return (
		<div className={`ir-input ir-input-${variant}`}>
			{variant === "I3" && (
				<label htmlFor={START_SEARCH_INPUT} className="ir-input-label">
					What would you like to watch?
				</label>
			)}
			<div className="ir-input-main search-private ph-no-capture sentry-mask">
				<MagnifyingGlassIcon aria-hidden className="ir-input-icon" />
				<textarea
					ref={field}
					id={START_SEARCH_INPUT}
					aria-label="Search titles, people, moods"
					value={value}
					placeholder={placeholder}
					maxLength={SEARCH_MAX_CHARS}
					rows={variant === "I3" ? 2 : 1}
					data-ph-no-capture
					enterKeyHint="search"
					onFocus={onFocus}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={(e) => {
						if (
							e.key === "Enter" &&
							!e.shiftKey &&
							!e.nativeEvent.isComposing
						) {
							e.preventDefault()
							e.currentTarget.form?.requestSubmit()
							e.currentTarget.blur()
						}
					}}
				/>
				{variant === "I2" && (
					<div className="ir-input-actions">
						<button
							type="button"
							aria-label="Clear the search"
							onClick={() => {
								onClear()
								field.current?.focus()
							}}
						>
							<XMarkIcon aria-hidden />
						</button>
						<button type="submit" onClick={() => field.current?.blur()}>
							Search <span aria-hidden>↵</span>
						</button>
					</div>
				)}
			</div>
			{variant === "I3" && (
				<div className="ir-composer-footer">
					<span>
						Enter to search <i>·</i> Shift + Enter for a new line
					</span>
					<div className="ir-input-actions">
						<button
							type="button"
							onClick={() => {
								onClear()
								field.current?.focus()
							}}
						>
							Clear
						</button>
						<button type="submit" onClick={() => field.current?.blur()}>
							Search <span aria-hidden>↵</span>
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
