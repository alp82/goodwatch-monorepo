/** A single, quiet arrival pulse; no loop and no interaction interception. */
export function SuccessHalo() {
  return (
    <div className="decision-success" aria-hidden="true">
      <style>{`
.decision-success{position:absolute;inset:0;pointer-events:none;display:grid;place-items:center;overflow:visible}
.decision-success:before{content:'';position:absolute;inset:-18%;border-radius:45%;background:radial-gradient(ellipse,#fbbf2444,transparent 68%);animation:decision-glow 1.8s cubic-bezier(.22,1,.36,1) both}
.decision-success i{position:absolute;left:50%;top:50%;width:5px;height:5px;border-radius:50%;background:#ffda70;box-shadow:0 0 8px #fbbf2466;animation:decision-dot 1.35s .12s cubic-bezier(.22,1,.36,1) both;--x:80px;--y:-85px}
.decision-success i:nth-of-type(2){--x:-85px;--y:-65px;animation-delay:.2s}.decision-success i:nth-of-type(3){--x:70px;--y:70px;animation-delay:.15s}.decision-success i:nth-of-type(4){--x:-65px;--y:80px;animation-delay:.24s}
.decision-success b{position:absolute;right:12px;bottom:12px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fbbf24;color:#17130c;box-shadow:0 4px 20px #0005;animation:decision-seal .7s .2s cubic-bezier(.22,1,.36,1) both}
@keyframes decision-glow{0%{opacity:0;transform:scale(.85)}35%{opacity:1}100%{opacity:0;transform:scale(1.2)}}
@keyframes decision-dot{0%{opacity:0;transform:translate(0,0) scale(.5)}25%{opacity:.65}100%{opacity:0;transform:translate(var(--x),var(--y)) scale(.4)}}
@keyframes decision-seal{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.decision-success:before,.decision-success i{display:none}.decision-success b{animation:none}}
`}</style>
      <i />
      <i />
      <i />
      <i />
      <b>
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 4 4L19 6" />
        </svg>
      </b>
    </div>
  );
}
