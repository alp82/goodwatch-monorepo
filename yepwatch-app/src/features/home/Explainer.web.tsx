import { filmMarkup } from './film-markup';
/** A tiny film, inspired by GoodWatch TV's timed card choreography and amber word landings. */
import { useEffect, useRef, useState } from "react";
import { introCss } from "./intro-styles";
/**
 * The film plays once (owner Q64 a): it fades in, every part stops on its last keyframe, and the whole film
 * stays on its last frame instead of fading out. Placed before introCss, so reduced motion still wins.
 * Once it has ended it stays there: a page shown again (display:none restarts CSS animations) starts at the end.
 */
const onceCss = `@keyframes mini-clock-once{0%{opacity:0}4%,100%{opacity:1}}.mini-film{animation-name:mini-clock-once!important}.mini-film,.mini-film *{animation-iteration-count:1!important}.mini-ended .mini-film,.mini-ended .mini-film *{animation-delay:-60s!important}`;
/** Once the film has played to its end in this page load, every later mount starts on its last frame. */
let played = false;
export function Explainer({ obscured }: { obscured: boolean }) {
  const [touchControls, setTouchControls] = useState(false);
  const touchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  useEffect(() => () => clearTimeout(touchTimer.current), []);
  function revealTouch() {
    setTouchControls(true);
    clearTimeout(touchTimer.current);
    touchTimer.current = setTimeout(() => setTouchControls(false), 2200);
  }
  const [paused, setPaused] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [ended, setEnded] = useState(played);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = section.current;
    if (!el || ended) return;
    let live = true;
    let armed = 0;
    let frame = 0;
    // Waits for the parts' current animations; armed again whenever they start anew (a screen shown again after
    // display:none, reduced motion switched off), since those cancel the ones it was waiting for.
    const arm = () => {
      frame = 0;
      const id = ++armed;
      // The film's own parts only: the pause control's fade is a transition that a hover can cancel.
      const parts = el.querySelector(".mini-film")?.getAnimations({ subtree: true }) ?? [];
      if (!parts.length) return;
      Promise.all(parts.map((a) => a.finished)).then(() => { if (live && id === armed) { played = true; setEnded(true); } }, () => {});
    };
    const rearm = () => { if (!frame) frame = requestAnimationFrame(arm); };
    rearm();
    el.addEventListener("animationstart", rearm);
    return () => { live = false; cancelAnimationFrame(frame); el.removeEventListener("animationstart", rearm); };
  }, [ended]);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setQuiet(media.matches);
    const visibility = () => setHidden(document.hidden);
    update();
    visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <section
      ref={section}
      className={`mini-intro ${quiet ? "mini-quiet" : ""} ${ended ? "mini-ended" : ""} ${
        touchControls ? "mini-touch-controls" : ""
      } ${paused ? "mini-user-paused" : ""}`}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") revealTouch();
      }}
      aria-label="Swipe your picks. Find a shared match. Agree, then watch and enjoy."
    >
      <style>{onceCss + introCss}</style>
      <div
        className={`mini-film ${
          paused || hidden || obscured ? "mini-paused" : ""
        }`}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: filmMarkup }}
      />
      {!quiet && !ended && (
        <button
          className="mini-control"
          aria-pressed={paused}
          aria-label={paused ? "Play intro" : "Pause intro"}
          onClick={() => setPaused((x) => !x)}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="currentColor"
            aria-hidden="true"
          >
            {paused ? (
              <path d="M8 5v14l11-7z" />
            ) : (
              <>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </>
            )}
          </svg>
        </button>
      )}
    </section>
  );
}
