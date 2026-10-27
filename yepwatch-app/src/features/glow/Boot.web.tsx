import { useEffect, useRef, useState, type RefObject } from "react";
import { isMemberReturn, clearMemberReturn } from "../../core/continuous/web-member-return";
import { BOOT, EASE_IN_OUT, bootSettleMs } from "../home/boot-timing";
/**
 * The boot word plays its intro centered, then grows a touch and dissolves in place while the page
 * builds in behind it (see boot-timing.ts). It never moves to another position. While the home page
 * is not ready, the amber arc keeps circling the Y.
 */
export function Boot({
  ready,
  pageReady,
  buildsIn,
  done,
  onLayout,
  onRevealed,
}: {
  ready: boolean;
  pageReady: boolean;
  buildsIn: boolean;
  done: () => void;
  onLayout: () => void;
  onRevealed?: () => void;
}) {
  const [returning] = useState(isMemberReturn);
  const [quiet] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [held, setHeld] = useState(false);
  const [capped, setCapped] = useState(false);
  const word = useRef<HTMLDivElement>(null),
    curtain = useRef<HTMLDivElement>(null),
    waitArc = useRef<SVGSVGElement>(null),
    pageReadyRef = useRef(pageReady);
  useEffect(() => { pageReadyRef.current = pageReady; }, [pageReady]);
  useEffect(onLayout, [onLayout]);
  useEffect(() => {
    if (!ready) return;
    if (returning) { clearMemberReturn(); done(); return; }
    const timer = setTimeout(() => setHeld(true), quiet ? BOOT.quietHoldMs : BOOT.holdMs);
    return () => clearTimeout(timer);
  }, [ready, returning, quiet, done]);
  // Waiting on the page: keep the arc circling, and stop waiting after a bounded time.
  useEffect(() => {
    if (!held || pageReadyRef.current) return;
    const cap = setTimeout(() => setCapped(true), BOOT.pageWaitCapMs);
    const loop = quiet ? undefined : waitArc.current?.animate(
      [{ transform: "rotate(-120deg)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: "rotate(300deg)", opacity: 0 }],
      { duration: BOOT.waitLoopMs, iterations: Infinity, easing: "cubic-bezier(.45,0,.25,1)" },
    );
    return () => { clearTimeout(cap); loop?.cancel(); };
  }, [held, quiet]);
  const leaving = held && (pageReady || capped);
  useEffect(() => {
    if (!leaving || !word.current || !curtain.current) return;
    onRevealed?.();
    const animations = [
      // The word is fully transparent at `goneAt`, well before the header logo starts; its growth continues to the end.
      word.current.animate(
        [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, offset: quiet ? 1 : BOOT.word.goneAt }, { opacity: 0, transform: `scale(${quiet ? 1 : BOOT.word.grow})` }],
        { duration: quiet ? BOOT.word.quietExitMs : BOOT.word.exitMs, easing: `cubic-bezier(${EASE_IN_OUT.join(",")})`, fill: "forwards" },
      ),
      curtain.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BOOT.curtainMs, fill: "forwards" }),
    ];
    const timer = setTimeout(done, bootSettleMs(buildsIn, quiet));
    return () => { clearTimeout(timer); animations.forEach((a) => a.cancel()); };
    // One dissolve per boot: the inputs are fixed once it starts.
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps
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
.review-boot-arc,.review-boot-wait{position:absolute;inset:50% auto auto 50%;width:1.25em;height:1.25em;margin:-.625em}
.review-boot-arc{animation:review-sweep 1.3s .15s cubic-bezier(.45,0,.25,1) both}.review-boot-wait{opacity:0}
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
        <div ref={word} style={{ position: "relative" }}>
          <div className="review-boot-word" style={{ position: "relative" }}>
            <div className="review-boot-glow" />
            <span className="review-boot-emblem">
              <Arc className="review-boot-arc" />
              <Arc className="review-boot-wait" arcRef={waitArc} />
              <span className="review-boot-y">Y</span>
            </span>
            <span className="review-boot-tail">
              <span className="review-boot-text">
                ep<b>Watch</b>
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Arc({ className, arcRef }: { className: string; arcRef?: RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={arcRef} className={className} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="72 217" />
    </svg>
  );
}
