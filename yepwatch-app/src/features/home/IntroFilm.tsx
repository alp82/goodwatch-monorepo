/** Native: the approved Explainer renders at its own fixed size. */
import { Explainer } from './Explainer';
export function IntroFilm({ obscured }: { obscured: boolean; height?: number; width?: number }) {
  return <Explainer obscured={obscured} />;
}
