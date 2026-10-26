import { useEffect, useRef, useState } from "react";
import { isMemberReturn, clearMemberReturn } from "../../core/continuous/web-member-return";
/** One persistent wordmark reveals, then flies to the actual home header. */
export function Boot({
  ready,
  done,
  onLayout,
  onRevealed,
}: {
  ready: boolean;
  done: () => void;
  onLayout: () => void;
  onRevealed?: () => void;
}) {
  const [returning] = useState(isMemberReturn);
  const logo = useRef<HTMLDivElement>(null),
    curtain = useRef<HTMLDivElement>(null);
  useEffect(onLayout, [onLayout]);
  useEffect(() => {
    if (!ready) return;
    if (returning) { clearMemberReturn(); done(); return; }
    const quiet = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const animations: Animation[] = [];
    timers.push(
      setTimeout(
        () => {
          onRevealed?.();
          const target = document.querySelector("[data-home-brand]");
          if (!quiet && target && logo.current) {
            const from = logo.current.getBoundingClientRect(),
              to = target.getBoundingClientRect();
            const dx = to.x + to.width / 2 - from.x - from.width / 2;
            const dy = to.y + to.height / 2 - from.y - from.height / 2;
            animations.push(
              logo.current.animate(
                [
                  { transform: "translate(0,0) scale(1.04)" },
                  {
                    transform: `translate(${dx}px,${dy}px) scale(${
                      to.width / logo.current.offsetWidth
                    })`,
                  },
                ],
                {
                  duration: 700,
                  easing: "cubic-bezier(.22,1,.36,1)",
                  fill: "forwards",
                }
              )
            );
            if (curtain.current)
              animations.push(
                curtain.current.animate([{ opacity: 1 }, { opacity: 0 }], {
                  duration: 500,
                  fill: "forwards",
                })
              );
            timers.push(setTimeout(done, 710));
          } else done();
        },
        quiet ? 120 : 2400
      )
    );
    return () => {
      timers.forEach(clearTimeout);
      animations.forEach((a) => a.cancel());
    };
  }, [ready, done, onRevealed, returning]);
  if (returning) return null;
  return (
    <div
      data-testid="yepwatch-boot"
      aria-label="YepWatch is starting"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <style>{`
@keyframes review-turn{from{opacity:0;transform:rotate(-35deg) scale(.82)}to{opacity:1;transform:none}}
@keyframes review-slide{from{transform:translateX(-45%);opacity:0}55%{opacity:1}to{transform:none;opacity:1}}
@keyframes review-sweep{0%{opacity:0;transform:rotate(-120deg)}20%,80%{opacity:1}100%{opacity:0;transform:rotate(300deg)}}
@keyframes review-glow{from{opacity:0}to{opacity:1}}
@keyframes review-push{from{transform:scale(1)}to{transform:scale(1.04)}}
.review-boot-word{font:64px/1.2 GabaritoBold;letter-spacing:-.8px;display:flex;align-items:center;color:#fafafa;white-space:nowrap;animation:review-push 2.4s linear both}
.review-boot-emblem{position:relative;display:flex}.review-boot-y{display:block;animation:review-turn 1s .2s cubic-bezier(.22,1,.36,1) both}
.review-boot-arc{position:absolute;inset:50% auto auto 50%;width:1.25em;height:1.25em;margin:-.625em;animation:review-sweep 1.3s .15s cubic-bezier(.45,0,.25,1) both}
.review-boot-tail{overflow:hidden;display:flex}.review-boot-text{display:flex;animation:review-slide 1s 1.1s cubic-bezier(.22,1,.36,1) both}.review-boot-text b{font-weight:normal;color:#fbbf24}
.review-boot-glow{position:absolute;inset:-100px;background:radial-gradient(ellipse,#fbbf2418,transparent 65%);animation:review-glow 1.4s .3s ease-out both}
@media(max-width:359px){.review-boot-word{font-size:52px}}
@media(prefers-reduced-motion:reduce){.review-boot-word,.review-boot-word *{animation:none!important}.review-boot-arc{display:none}}
`}</style>
      <div
        ref={curtain}
        style={{ position: "absolute", inset: 0, background: "#070707" }}
      />
      {ready && (
        <div
          ref={logo}
          className="review-boot-word"
          style={{ position: "relative" }}
        >
          <div className="review-boot-glow" />
          <span className="review-boot-emblem">
            <svg
              className="review-boot-arc"
              viewBox="0 0 100 100"
              aria-hidden="true"
            >
              <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="72 217"
              />
            </svg>
            <span className="review-boot-y">Y</span>
          </span>
          <span className="review-boot-tail">
            <span className="review-boot-text">
              ep<b>Watch</b>
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
