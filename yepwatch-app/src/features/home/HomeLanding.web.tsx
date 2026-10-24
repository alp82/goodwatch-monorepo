import codes from "./codes.json";
import { Wordmark } from "../glow/theme";
import { Explainer } from "./Explainer.web";
import { homeCss } from "./styles";
import type { HomeLandingProps } from "./HomeLanding";
function Logo({ android = false }: { android?: boolean }) {
  return android ? (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="m9 8-3-5 1.4-.8L10.6 7a16 16 0 0 1 10.8 0l3.2-4.8L26 3l-3 5c4.3 2.3 7 6.4 7 11H2c0-4.6 2.7-8.7 7-11Z" />
      <circle cx="9" cy="13" r="1.5" fill="#070707" />
      <circle cx="23" cy="13" r="1.5" fill="#070707" />
      <path d="M4 21h24v5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3Z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.1 12.3c0-2 1.6-3 1.7-3.1-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.5.8-3.2.8-.6 0-1.7-.8-2.7-.8-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.4.7 1 1.4 2 2.5 1.9 1 0 1.4-.6 2.7-.6s1.6.6 2.7.6 1.8-1 2.4-1.9c.8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.1-3.3ZM15 6.1c.5-.7 1-1.6.9-2.6-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.9 2.5.9.1 1.8-.4 2.4-1.1Z" />
    </svg>
  );
}
function AppCode({ platform }: { platform: "ios" | "android" }) {
  const title = platform === "ios" ? "iPhone" : "Android";
  return (
    <a
      className={`install-card ${platform}`}
      href={codes[platform].url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Install YepWatch on ${title}`}
    >
      <div className="code">
        <img
          draggable={false}
          src={`data:image/svg+xml,${encodeURIComponent(codes[platform].svg)}`}
          alt={`${title} installation QR code`}
        />
      </div>
      <div className="store">
        <Logo android={platform === "android"} />
        <span>
          <strong>{title}</strong>
          <small>{platform === "ios" ? "TestFlight" : "Download app"}</small>
        </span>
        <span className="out" aria-hidden="true">
          ↗
        </span>
      </div>
    </a>
  );
}
export function HomeLanding({
  create,
  join,
  returnToRoom,
  disabled,
}: HomeLandingProps) {
  return (
    <div className="home-landing">
      <style>{homeCss}</style>
      <main>
        <header>
          <Wordmark size={36} />
        </header>
        <Explainer obscured={false} />
        <section className="apps" aria-label="Get the app">
          <AppCode platform="ios" />
          <AppCode platform="android" />
        </section>
        <section className="browser-zone" aria-label="Start in your browser">
          <div className="browser-title">
            <span className="rule" />
            <h1>Or start here in your browser</h1>
            <span className="rule" />
          </div>
          <div className="browser-actions">
            <button className="primary" onClick={create} disabled={disabled}>
              Create a room <span aria-hidden="true">↗</span>
            </button>
            <button className="secondary" onClick={join} disabled={disabled}>
              Join a room
            </button>
          </div>
          {returnToRoom && (
            <button
              className="return-room"
              onClick={returnToRoom}
              disabled={disabled}
            >
              Return to your room <span aria-hidden="true">→</span>
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
