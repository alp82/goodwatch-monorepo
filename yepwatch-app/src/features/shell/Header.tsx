/**
 * The one sticky app header of every screen (direction D): the wordmark (and Back when there's
 * somewhere to go back to) on the left, the room switcher pill in the center, Get the app (desktop
 * browsers) and the avatar on the right. The bar spans the window; its content sits in the page's
 * centered container.
 */
import { Platform, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BootReveal } from '../home/BootReveal';
import { GetTheApp, installable } from '../home/install';
import { GText, Icon, Press, glow } from '../glow/theme';
import { GoodWatchMark } from './marks';
import { useLayout } from './layout';
import { Avatar, LiveDot } from './parts';
import { R, warm } from './tokens';

/** What the room switcher pill shows. */
export interface HeaderPill {
  label: string;
  /** live: an open room (LIVE dot) · decided: a ticket · new: a room being made · rooms: "N open" on the start page. */
  state: 'live' | 'decided' | 'new' | 'rooms';
  /** New suggestions waiting for the host. */
  fresh?: number;
}
/** Who the avatar is. Members get a small GoodWatch mark. */
export interface HeaderMe { name: string | null; member: boolean }

export interface AppHeaderProps {
  /** Shows Back (on phones it takes the wordmark's place). */
  back?: () => void;
  /** Makes the wordmark a button (for example "Your rooms" on the start page). */
  onLogo?: () => void;
  logoLabel?: string;
  /** The center pill; null or absent shows none. */
  pill?: HeaderPill | null;
  onPill?: () => void;
  me?: HeaderMe;
  onProfile?: () => void;
  /** Profile is resting for a moment (rooms are loading): it doesn't react, without dimming. */
  profileQuiet?: boolean;
}

/**
 * The header wordmark. During the startup dissolve it appears after the boot word is gone (header
 * role), so the two never share the screen.
 */
export function BrandMark({ size }: { size: number }) {
  const font = { fontFamily: 'GabaritoBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: (-0.8 * size) / 64, color: glow.ink } as const;
  const web = Platform.OS === 'web' ? ({ dataSet: { homeBrand: '' } } as object) : {};
  return (
    <BootReveal part="header" index={0} {...web} accessibilityLabel="YepWatch" style={{ flexDirection: 'row', alignSelf: 'center' }}>
      <Text style={font}>Y</Text>
      <Text style={font}>ep</Text>
      <Text style={[font, { color: glow.amber }]}>Watch</Text>
    </BootReveal>
  );
}

function Chevron({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" accessible={false}><Path d="m7 10 5 5 5-5" /></Svg>;
}
function Plus({ size, color }: { size: number; color: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" accessible={false}><Path d="M12 5v14M5 12h14" /></Svg>;
}

/** The room switcher: the current room (or "N open"), opens Your rooms. */
export function RoomPill({ pill, onPress }: { pill: HeaderPill; onPress?: () => void }) {
  const { phone, z } = useLayout();
  const fresh = pill.fresh ?? 0;
  return (
    <Press label={`${pill.label}${fresh ? `, ${fresh} new` : ''}, switch room`} onPress={onPress ?? (() => undefined)} disabled={!onPress}
      style={{ height: z(40), maxWidth: phone ? undefined : z(420), flexShrink: 1, minWidth: 0, flexDirection: 'row', gap: 8, paddingLeft: 14, paddingRight: 10, borderRadius: 12, backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: fresh ? '#fbbf2499' : pill.state === 'live' ? '#ffffff22' : warm.line }}>
      {pill.state === 'live' || pill.state === 'rooms' ? <LiveDot /> : pill.state === 'decided' ? <Icon name="tickets" size={z(15)} color={glow.amber} /> : <Plus size={z(15)} color={glow.amber} />}
      <GText bold size={z(15)} lines={1} style={{ flexShrink: 1 }}>{pill.label}</GText>
      {fresh ? <View style={{ minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: glow.amber, alignItems: 'center', justifyContent: 'center' }}><GText bold size={11} color={warm.ink}>{fresh}</GText></View> : null}
      <Chevron size={z(16)} color={glow.muted} />
    </Press>
  );
}

/** Your avatar; members carry the GoodWatch mark. Opens Profile. */
function ProfileButton({ me, onPress, quiet }: { me?: HeaderMe; onPress?: () => void; quiet?: boolean }) {
  const { z } = useLayout();
  return (
    <Press label="Profile" quiet={quiet} onPress={onPress ?? (() => undefined)} disabled={!onPress} style={{ width: z(44), height: z(44) }}>
      <Avatar name={me?.name ?? null} size={z(34)} />
      {me?.member ? <View testID="avatar-goodwatch-mark" style={{ position: 'absolute', right: 1, bottom: 2, borderRadius: 5, borderWidth: 2, borderColor: glow.bg }}><GoodWatchMark size={z(14)} /></View> : null}
    </Press>
  );
}

export function AppHeader({ back, onLogo, logoLabel = 'Your rooms', pill, onPill, me, onProfile, profileQuiet }: AppHeaderProps) {
  const { phone, gutter, max, header, z } = useLayout();
  const brand = <BrandMark size={phone ? 21 : z(23)} />;
  const logo = onLogo ? <Press label={logoLabel} onPress={onLogo} style={{ alignItems: 'flex-start', paddingRight: 6 }}>{brand}</Press> : brand;
  const backButton = back ? (
    <Press label="Back" onPress={back} style={{ width: z(40), height: z(40), borderRadius: R.control, backgroundColor: '#ffffff0a' }}><Icon name="left" size={z(20)} color={glow.soft} /></Press>
  ) : null;
  const pillEl = pill ? <BootReveal part="header" index={1} style={{ flexShrink: 1, minWidth: 0 }}><RoomPill pill={pill} onPress={onPill} /></BootReveal> : null;
  const profile = <BootReveal part="header" index={1}><ProfileButton me={me} onPress={onProfile} quiet={profileQuiet} /></BootReveal>;
  return (
    <View testID="app-header" style={{ height: header, zIndex: 30, borderBottomWidth: 1, borderBottomColor: warm.line, backgroundColor: warm.bar, paddingHorizontal: phone ? gutter - 4 : gutter, ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } : null) } as ViewStyle}>
      {phone ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {backButton ?? <View style={{ paddingLeft: 4 }}>{logo}</View>}
          <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', justifyContent: back ? 'flex-start' : 'center' }}>{pillEl}</View>
          {profile}
        </View>
      ) : (
        <View style={{ flex: 1, width: '100%', maxWidth: max, alignSelf: 'center', flexDirection: 'row', alignItems: 'center' }}>
          <View pointerEvents="box-none" style={{ position: 'absolute', left: z(230), right: z(230), top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{pillEl}</View>
          <View pointerEvents="box-none" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>{backButton}{logo}</View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: z(12) }}>{installable ? <GetTheApp /> : null}{profile}</View>
        </View>
      )}
    </View>
  );
}
