import type { ReactNode } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { Link } from 'expo-router';
import { externalTrailerUrl } from './trailer';

const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};

/** A user-initiated external link. No YouTube player or requests run inside YepWatch. */
export function TrailerLink({ url, children, style, visual, disabled = false }: {
  url: string | null;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  visual?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  const destination = externalTrailerUrl(url);
  if (!destination) return null;
  const content = visual ? <View style={visual}>{children}</View> : children;
  if (disabled) return <View style={style}>{content}</View>;
  return (
    <Link href={destination as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
      <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel="Watch trailer on YouTube"
        accessibilityHint="Opens YouTube or your browser."
        style={style}>
        {content}
      </Pressable>
    </Link>
  );
}
