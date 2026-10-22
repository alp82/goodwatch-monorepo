// Whether the film plays on a phone's picture: upright about 350 x 200, on its side up to 816 x 285 (wider than
// 16:9). The same condition as intro.css's phone rules, `@container (max-width: 760px) or (max-height: 360px)`. A scene
// that must lay itself out differently there (fewer, larger items) reads it here; the rest is CSS.
import { createContext, useContext } from "react"

export const isPhonePicture = (width: number, height: number) =>
	width <= 760 || height <= 360

export const FilmPhone = createContext(false)

export const useFilmPhone = () => useContext(FilmPhone)
