import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import { memberTransition, RETURN_CAP_MS, LEAVE_MS, type TransitionPhase } from '../../core/continuous/member-transition';
import { glow } from '../glow/theme';

const EASE = 'cubic-bezier(.2,.7,.2,1)';
const OUT_MS = 380;

/**
 * The GoodWatch sign-in cover: the GoodWatch mark in a turning amber ring on the warm dark ground.
 * It fades in before the browser leaves for GoodWatch and fades out of the page that comes back, so
 * neither page change shows a blank or half-built screen. Transform and opacity only.
 */
export function MemberTransition() {
  const [phase, setPhase] = useState<TransitionPhase>(memberTransition.phase);
  // Kept mounted while the cover fades out.
  const [shown, setShown] = useState<TransitionPhase | null>(phase === 'idle' ? null : phase);
  const cover = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [quiet] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // The page's static cover (index.html) painted before the script; this one has the same look.
  useEffect(() => { document.getElementById('yw-member-cover')?.remove(); }, []);
  useEffect(() => memberTransition.subscribe((next) => {
    setPhase(next);
    // Back from GoodWatch through the page cache uncovers at once; a returning page fades out (below).
    setShown((old) => (next !== 'idle' ? next : old === 'leaving' ? null : old));
  }), []);
  // A returning page that never reports ready is uncovered anyway.
  useEffect(() => {
    if (phase !== 'returning') return;
    const timer = setTimeout(() => memberTransition.arrived(), RETURN_CAP_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (quiet || !shown || !ring.current) return;
    const spin = ring.current.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1400, iterations: Infinity });
    return () => spin.cancel();
  }, [shown, quiet]);
  useEffect(() => {
    if (shown !== 'leaving' || !cover.current || !content.current) return;
    const animations = [
      cover.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: quiet ? 1 : LEAVE_MS - 20, easing: EASE, fill: 'forwards' }),
      content.current.animate([{ opacity: 0, transform: 'scale(0.92)' }, { opacity: 1, transform: 'scale(1)' }], { duration: quiet ? 1 : LEAVE_MS, easing: EASE, fill: 'forwards' }),
    ];
    return () => animations.forEach((a) => a.cancel());
  }, [shown, quiet]);
  useEffect(() => {
    if (phase !== 'idle' || shown !== 'returning' || !cover.current || !content.current) return;
    const fade = cover.current.animate([{ opacity: 1 }, { opacity: 0 }], { duration: quiet ? 1 : OUT_MS, easing: EASE, fill: 'forwards' });
    const grow = content.current.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }], { duration: quiet ? 1 : OUT_MS, easing: EASE, fill: 'forwards' });
    fade.onfinish = () => setShown(null);
    return () => { fade.cancel(); grow.cancel(); };
  }, [phase, shown, quiet]);
  if (!shown) return null;
  const words = shown === 'leaving' ? 'Opening GoodWatch…' : 'Signed in with GoodWatch';
  return (
    <div
      ref={cover}
      data-testid="member-transition"
      role="status"
      aria-live="polite"
      aria-label={words}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        background: `radial-gradient(60% 50% at 50% 46%, #fbbf2422 0%, #fbbf2408 38%, transparent 70%), ${glow.bg}`,
        opacity: shown === 'leaving' ? 0 : 1,
        pointerEvents: 'auto',
        willChange: 'opacity',
      }}
    >
      <div ref={content} style={{ display: 'grid', justifyItems: 'center', gap: 22, willChange: 'transform, opacity' }}>
        <div style={{ position: 'relative', width: 112, height: 112, display: 'grid', placeItems: 'center' }}>
          <div
            ref={ring}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `conic-gradient(from 0deg, transparent 0deg, ${glow.amber} 300deg, transparent 360deg)`,
              WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
              opacity: quiet ? 0.6 : 1,
              willChange: 'transform',
            }}
          />
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#141210', display: 'grid', placeItems: 'center', boxShadow: '0 0 48px #fbbf241f' }}>
            <Image source={require('../../../assets/goodwatch-mark.png')} accessible={false} style={{ width: 48, height: 48, borderRadius: 11 }} />
          </div>
        </div>
        <div style={{ fontFamily: 'GabaritoBold, system-ui, sans-serif', fontSize: 18, color: glow.soft, letterSpacing: -0.2 }}>{words}</div>
      </div>
    </div>
  );
}
