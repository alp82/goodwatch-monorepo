/**
 * Hosts the approved web Explainer the way its landing page does:
 * white Gabarito text, the `home-landing` scope its own stylesheet uses for the centered
 * hover/touch pause overlay, and a uniform scale (the landing scales it 1.3-1.65x) to fit `height`.
 * The landing page's layout CSS (styles.ts) is not loaded here.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { Explainer } from './Explainer';
export function IntroFilm({ obscured, height, width }: { obscured: boolean; height?: number; width?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState(158);
  useLayoutEffect(() => {
    const el = inner.current?.querySelector('.mini-intro') as HTMLElement | null;
    if (el?.offsetHeight) setNatural(el.offsetHeight);
  }, []);
  const scale = height ? Math.max(0.8, Math.min(1.8, height / natural, width ? width / 300 : 1.8)) : 1;
  return (
    <div className="home-landing" style={{ width: '100%', height: natural * scale, color: '#fafafa', fontFamily: 'Gabarito, system-ui, sans-serif', overflow: 'visible' }}>
      <div ref={inner} style={{ transform: `scale(${scale})`, transformOrigin: '50% 0' }}>
        <Explainer obscured={obscured} />
      </div>
    </div>
  );
}
