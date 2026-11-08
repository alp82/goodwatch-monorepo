/**
 * The word's single outer outline on the web. Text stroke traces every contour of Gabarito's
 * overlapping glyph parts (lines inside the Y, E and P), so an SVG filter grows the solid word and
 * cuts the word itself out: one clean outline, hollow inside. The filter is static; only opacity
 * animates.
 */
import { View } from 'react-native';
import { Word } from './Word';
import type { OutlineProps } from './Outline';
import { webText } from './paint';

function outlineFilter(width: number) {
  const id = `yw-outline-${String(width).replace('.', '_')}`;
  if (typeof document !== 'undefined' && !document.getElementById(id)) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `<filter id="${id}" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="dilate" radius="${width}" result="grown"/><feComposite in="grown" in2="SourceAlpha" operator="out" result="ring"/><feMorphology in="SourceGraphic" operator="dilate" radius="${width}" result="wide"/><feComposite in="wide" in2="ring" operator="in"/></filter>`;
    document.body.appendChild(svg);
  }
  return id;
}

export function Outline({ text, size, color, width = 2, repeat = 1, step = 0 }: OutlineProps) {
  const style = webText({ filter: `url(#${outlineFilter(width)})` });
  if (repeat <= 1) return <Word text={text} size={size} color={color} style={style} />;
  return (
    <View style={{ flexDirection: 'row' }}>
      {Array.from({ length: repeat }, (_, k) => (
        <View key={k} style={{ width: step, flexShrink: 0, alignItems: 'center' }}><Word text={text} size={size} color={color} style={style} /></View>
      ))}
    </View>
  );
}
