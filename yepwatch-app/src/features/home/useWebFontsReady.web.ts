import { useEffect, useState } from 'react';
/** Some WebKit versions leave FontFaceSet.load pending after the faces have loaded.
 * Accept only the two successfully loaded faces, never their mere registration.
 */
export function useWebFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!document.fonts) return;
    const check = () => {
      const loaded = new Set<string>();
      document.fonts.forEach(face => { if (face.status === 'loaded') loaded.add(face.family.replace(/["']/g, '')); });
      if (loaded.has('Gabarito') && loaded.has('GabaritoBold')) {
        setReady(true);
        clearInterval(timer);
      }
    };
    const timer = setInterval(check, 50);
    const limit = setTimeout(() => clearInterval(timer), 12000);
    document.fonts.addEventListener('loadingdone', check);
    return () => { clearInterval(timer); clearTimeout(limit); document.fonts.removeEventListener('loadingdone', check); };
  }, []);
  return ready;
}
