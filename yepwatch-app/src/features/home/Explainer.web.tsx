/** A tiny film, inspired by GoodWatch TV's timed card choreography and amber word landings. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
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
      >
        <div className="mini-stage">
          <div className="mini-halo" />
          {["left", "middle", "right"].map((side, i) => (
            <div
              key={side}
              className={`mini-person mini-${side}`}
              style={
                {
                  "--person": ["#a78bfa", "#67d9d0", "#f9a8d4"][i],
                } as CSSProperties
              }
            >
              <div className="mini-deck">
                <div className="mini-card-under" />
                <div className="mini-card">
                  <span className="mini-moon" />
                  <span className="mini-hills" />
                  <span className="mini-film-lines" />
                </div>
                <div className="mini-flick">
                  <span className="mini-orbit" />
                </div>
                <span className="mini-tap" />
              </div>
              <span className="mini-face">
                <i />
                <i />
                <b />
              </span>
            </div>
          ))}
          <div className="mini-tv">
            <div className="mini-tv-screen">
              <div className="mini-movie">
                <span className="movie-stars" />
                <span className="movie-moon" />
                <span className="movie-range far" />
                <span className="movie-range near" />
                <span className="movie-comet" />
              </div>
              <div className="mini-stream-intro">
                <b>CINEMA</b>
                <span className="stream-play">▶</span>
              </div>
              <div className="mini-player">
                <svg viewBox="0 0 12 12" width="7" height="7" fill="currentColor"><rect x="2" y="2" width="3" height="8" /><rect x="7" y="2" width="3" height="8" /></svg>
                <i>
                  <b />
                </i>
                <span>⌁</span>
              </div>
            </div>
            <span className="tv-stand" />
            <span className="tv-light" />
          </div>
          <span className="mini-spark spark-one">✦</span>
          <span className="mini-spark spark-two">✧</span>
          <span className="mini-spark spark-three">✦</span>
          <div className="mini-agree">
            <i />
            <i />
            <i />
            <span>Agreed</span>
          </div>
        </div>
        <div className="mini-captions">
          <span className="mini-caption first">
            Swipe <strong>your picks.</strong>
          </span>
          <span className="mini-caption second">
            Find <strong>your match.</strong>
          </span>
          <span className="mini-caption third">
            Watch <strong>together.</strong>
          </span>
        </div>
      </div>
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
