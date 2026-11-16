/** Which layers each look paints behind the card and in front of it. */
import { GiantBack, GiantFront, NeonFront, SplitBack, SplitFront } from './stage-looks';
import { BleedBack, BleedFront, BurstBack, BurstFront, EchoFront, GlitchBack, GlitchFront, StampFront, WallBack } from './fx-looks';
import type { LayerProps } from './paint';

export function BackLayer(props: LayerProps) {
  switch (props.look) {
    case 'giant': return <GiantBack {...props} />;
    case 'split': return <SplitBack {...props} />;
    case 'wall': return <WallBack {...props} />;
    case 'burst': return <BurstBack {...props} />;
    case 'bleed': return <BleedBack {...props} />;
    case 'glitch': return <GlitchBack {...props} />;
    default: return null;
  }
}

export function FrontLayer(props: LayerProps) {
  switch (props.look) {
    case 'giant': return <GiantFront {...props} />;
    case 'split': return <SplitFront {...props} />;
    case 'neon': return <NeonFront {...props} />;
    case 'burst': return <BurstFront {...props} />;
    case 'stamp': return <StampFront {...props} />;
    case 'bleed': return <BleedFront {...props} />;
    case 'echo': return <EchoFront {...props} />;
    case 'glitch': return <GlitchFront {...props} />;
    default: return null;
  }
}
