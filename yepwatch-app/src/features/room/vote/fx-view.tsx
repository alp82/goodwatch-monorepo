/**
 * An animated node of a look or of the match moment. On the web it gets a compositor layer of its own: its content
 * (CSS filters, blurs, text glows, masks, SVG outlines) is painted once, and each frame of the JS-driven animation
 * only moves or fades that layer. In a plain node every frame repaints all of it, in software on a phone browser
 * without GPU raster: the match moment cost about 0.6 s of painting per play. Native animates on the native driver.
 */
import type { ComponentProps } from 'react';
import { Animated, type ViewStyle } from 'react-native';
import { web } from './paint';

const layer = { willChange: 'transform, opacity' } as ViewStyle;

function WebFxView(props: ComponentProps<typeof Animated.View>) {
  return <Animated.View {...props} style={[props.style, layer]} />;
}

export const FxView = web ? WebFxView : Animated.View;
