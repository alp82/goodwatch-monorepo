import { useState } from 'react';
import { Image, Platform, Pressable, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { Candidate, ScreenAvailability, ScreenContext } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousApi } from '../../core/continuous/api';
import { goodwatchTitleUrl, roomWatchLinks } from './watch-links';
import { GText, Icon, glow } from './theme';
import { R } from '../shell/tokens';

// Expo Link's asChild uses HTML attributes; RN Web Pressable needs hrefAttrs.
const externalAttrs = Platform.OS === 'web' ? { hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } } : {};

function ProviderLogo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <Image source={{ uri: url }} accessibilityLabel={`${name} logo`} onError={() => setFailed(true)} style={{ width: 42, height: 42, borderRadius: 10 }} />
  ) : (
    <View style={{ width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff12' }}>
      <Icon name="play" size={20} color={glow.amber} />
    </View>
  );
}

/** Uses the final decision's checked offers; metadata only supplies provider branding. */
export function WatchLinks({ identity, availability, screens, compact = false }: {
  identity: Candidate['identity']; availability: ScreenAvailability[]; screens: ScreenContext[]; compact?: boolean;
}) {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const country = screens.find(s => s.confirmed)?.country;
  const metadata = useQuery({ queryKey: ['continuous-metadata', country], queryFn: () => continuousApi.metadata(country || undefined), enabled: Boolean(country), staleTime: 300_000 });
  const links = roomWatchLinks(availability, screens, metadata.data);
  return (
    <View style={{ width: '100%', gap: 8 }}>
      {links.length ? <>
        <ScrollView testID="watch-provider-list" style={{ maxHeight: compact ? 116 : 148 }} contentContainerStyle={{ gap: 8, padding: 2 }} showsVerticalScrollIndicator>
          {links.map(o => <Link key={o.id} href={o.url as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
            <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel={`${o.action} ${o.name}`} onHoverIn={() => setHighlighted(o.id)} onHoverOut={() => setHighlighted(null)} onFocus={() => setHighlighted(o.id)} onBlur={() => setHighlighted(null)} onPressIn={() => setHighlighted(o.id)} onPressOut={() => setHighlighted(null)} style={{ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 7, paddingRight: 14, borderRadius: R.control, borderWidth: 1, borderColor: highlighted === o.id ? glow.amber : '#ffffff24', backgroundColor: highlighted === o.id ? '#fbbf2418' : '#ffffff0d' }}>
              <ProviderLogo url={o.logoUrl} name={o.name} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <GText bold size={16} lines={1}>{o.name}</GText>
                <GText size={12} color={glow.muted}>{o.note === 'Streaming' && identity.kind !== 'movie' && availability.some(a => a.scope === 'title') ? 'Series availability' : o.note}</GText>
              </View>
              <Icon name="external" size={18} color={glow.amber} />
            </Pressable>
          </Link>)}
        </ScrollView>
        {links.length > 2 && <GText size={11} color={glow.muted} style={{ textAlign: 'center' }}>Scroll for all {links.length} services</GText>}
      </> : <GText size={13} color={glow.muted} style={{ textAlign: 'center' }}>No streaming link available for your services.</GText>}
      <Link href={goodwatchTitleUrl(identity) as `https://${string}`} target="_blank" rel="noopener noreferrer" asChild>
        <Pressable {...externalAttrs} accessibilityRole="link" accessibilityLabel="Full details on GoodWatch" onHoverIn={() => setHighlighted('goodwatch')} onHoverOut={() => setHighlighted(null)} onFocus={() => setHighlighted('goodwatch')} onBlur={() => setHighlighted(null)} onPressIn={() => setHighlighted('goodwatch')} onPressOut={() => setHighlighted(null)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: R.control, backgroundColor: highlighted === 'goodwatch' ? '#fbbf2418' : 'transparent' }}>
          <Image source={require('../../../assets/goodwatch-mark.png')} style={{ width: 24, height: 24 }} />
          <GText bold size={14} color={glow.amber}>Full details on GoodWatch</GText>
          <Icon name="external" size={14} color={glow.amber} />
        </Pressable>
      </Link>
    </View>
  );
}
