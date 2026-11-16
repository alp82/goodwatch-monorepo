/**
 * The header's setup chip (rethink.md screen 2): avatar, name and one short line, "10 rated" (titles answered Loved it
 * or Not for me) or "From GoodWatch" for members, whose avatar carries the G. It opens Profile. A short control: hover
 * lightens it and nudges the arrow. Its words keep their width while the count arrives, so the header never moves.
 */
import { View } from 'react-native';
import { useTasteProfile } from '../../core/continuous/taste-profile';
import { GText, Icon, glow, grow } from '../glow/theme';
import { HoverPress, Nudge } from './hover';
import { GoodWatchG } from './marks';
import { useLayout } from './layout';
import { Avatar } from './parts';
import { warm } from './tokens';

export function setupDetail(member: boolean, rated: number | null) {
  return member ? 'From GoodWatch' : rated === null ? null : `${rated} rated`;
}

export function SetupChip({ name, member, onPress, quiet, compact }: { name: string; member: boolean; onPress?: () => void; quiet?: boolean; compact?: boolean }) {
  const { phone, width, z } = useLayout();
  const { rated } = useTasteProfile();
  const detail = setupDetail(member, rated);
  const face = z(phone ? 30 : 32);
  // Very narrow phones keep the face and the arrow only (the room pill needs the row).
  const words = !compact && (!phone || width >= 360);
  return (
    <HoverPress testID="setup-chip" label="Profile" hint={detail ? `${name}, ${detail}` : name} quiet={quiet} onPress={onPress ?? (() => undefined)} disabled={!onPress}
      style={{ ...grow(48), alignItems: 'stretch', flexShrink: 0 }}
      visual={{ height: z(42), flexDirection: 'row', alignItems: 'center', gap: phone ? 7 : 9, paddingLeft: 5, paddingRight: phone ? 8 : 10, borderRadius: z(21), backgroundColor: '#ffffff0a', borderWidth: 1, borderColor: warm.line }}>
      <View>
        <Avatar name={name} size={face} />
        {member ? <View testID="avatar-goodwatch-mark" style={{ position: 'absolute', right: -3, bottom: -2, padding: 2, borderRadius: 6, backgroundColor: glow.bg }}><GoodWatchG size={face * 0.36} /></View> : null}
      </View>
      {words ? (
        <View style={{ maxWidth: phone ? 96 : z(180), minWidth: z(56) }}>
          <GText bold size={z(14)} lines={1}>{name}</GText>
          <GText size={z(12)} color={glow.muted} lines={1} style={{ opacity: detail ? 1 : 0 }}>{detail ?? '0 rated'}</GText>
        </View>
      ) : null}
      <Nudge dx={3}><Icon name="right" size={z(13)} color={glow.muted} /></Nudge>
    </HoverPress>
  );
}
