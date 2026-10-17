// What the page around the TV can ask of the intro, as window events (HomeIntro.tsx listens).

/** Plays the film from a chapter: `detail` is the chapter's id (scene.ts). "How GoodWatch works" sends it. */
export const FILM_CHAPTER_EVENT = "gw-intro-chapter"
/** "Just look around" in the quiz: the intro steps aside for the TV's own home. */
export const FILM_LEAVE_EVENT = "gw-intro-leave"
