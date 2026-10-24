import { filmMarkup } from './film-markup';
/** A tiny film, inspired by GoodWatch TV's timed card choreography and amber word landings. */
import { useEffect, useRef, useState } from "react";
import { introCss } from "./intro-styles";
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
      className={`mini-intro ${quiet ? "mini-quiet" : ""} ${
        touchControls ? "mini-touch-controls" : ""
      } ${paused ? "mini-user-paused" : ""}`}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") revealTouch();
      }}
      aria-label="Swipe your picks. Find a shared match. Agree and watch together."
    >
      <style>{introCss}</style>
      <div
        className={`mini-film ${
          paused || hidden || obscured ? "mini-paused" : ""
        }`}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: filmMarkup }}
      />
      {!quiet && (
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
