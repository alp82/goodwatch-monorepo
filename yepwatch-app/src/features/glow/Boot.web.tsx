import { useEffect, useRef, useState, type RefObject } from "react";
import { isMemberReturn, clearMemberReturn } from "../../core/continuous/web-member-return";
import { BOOT } from "../home/boot-timing";
/**
 * The startup cover (see boot-timing.ts): the dark ground the page already has, dissolving as soon as
 * the page is ready. Only loading that takes longer shows the word (its intro, then the amber arc
 * circling the Y until the page is ready).
 */
export function Boot({
  ready,
  pageReady,
  word,
  done,
  onLayout,
  onRevealed,
}: {
  /** Fonts are in. */
  ready: boolean;
  pageReady: boolean;
  /** Slow loading may show the word (never on invitation links). */
  word: boolean;
  done: () => void;
  onLayout: () => void;
  onRevealed?: () => void;
}) {
  const [returning] = useState(isMemberReturn);
  const [quiet] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [slow, setSlow] = useState(false);
  const [held, setHeld] = useState(false);
  const [capped, setCapped] = useState(false);
  const leaving = ready && (pageReady || capped);
  const leavingRef = useRef(leaving);
  useEffect(() => { leavingRef.current = leaving; }, [leaving]);
  const cover = useRef<HTMLDivElement>(null),
    waitArc = useRef<SVGSVGElement>(null);
  useEffect(onLayout, [onLayout]);
  // Back from GoodWatch sign-in: the member cover (index.html) already covers loading.
  useEffect(() => { if (returning) { clearMemberReturn(); done(); } }, [returning, done]);
  // Both clocks count from the app's first frame; a dissolve already under way never brings the word.
  useEffect(() => {
    const later = setTimeout(() => { if (!leavingRef.current) setSlow(true); }, BOOT.wordDelayMs);
    const cap = setTimeout(() => setCapped(true), BOOT.pageWaitCapMs);
    return () => { clearTimeout(later); clearTimeout(cap); };
  }, []);
  const shownWord = word && slow && ready;
  useEffect(() => {
    if (!shownWord) return;
    const timer = setTimeout(() => setHeld(true), BOOT.introMs);
    return () => clearTimeout(timer);
  }, [shownWord]);
  // Still loading after the intro: the arc keeps circling the Y.
  useEffect(() => {
    if (!held || leaving || quiet) return;
    const loop = waitArc.current?.animate(
      [{ transform: "rotate(-120deg)", opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { transform: "rotate(300deg)", opacity: 0 }],
      { duration: BOOT.waitLoopMs, iterations: Infinity, easing: "cubic-bezier(.45,0,.25,1)" },
    );
    return () => loop?.cancel();
  }, [held, leaving, quiet]);
  useEffect(() => {
    if (!leaving || returning || !cover.current) return;
    onRevealed?.();
    // Loading that showed no word ends in a cut: the page is simply there.
    if (!shownWord) { done(); return; }
    const dissolve = cover.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: BOOT.dissolveMs, easing: "linear", fill: "forwards" });
    const timer = setTimeout(done, BOOT.dissolveMs);
    return () => { clearTimeout(timer); dissolve.cancel(); };
    // One dissolve per boot: the inputs are fixed once it starts.
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps
  if (returning) return null;
  return (
    <div
      ref={cover}
      data-testid="yepwatch-boot"
      aria-label="YepWatch is starting"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        background: "#070707",
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
      {shownWord && (
        <div style={{ position: "relative" }}>
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
