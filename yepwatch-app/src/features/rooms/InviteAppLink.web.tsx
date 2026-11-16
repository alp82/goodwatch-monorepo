import { View } from 'react-native';
import { nativeInviteUrl } from '../../core/invites';
import { GText, glow } from '../glow/theme';

/** A user gesture hands the invitation to the installed app; the browser form stays usable. */
export function InviteAppLink({ code }: { code: string }) {
  return <View style={{ alignItems: 'center', gap: 12 }}>
    <a href={nativeInviteUrl(code)} style={{ color: '#141414', background: glow.amber, borderRadius: 12, padding: '16px 24px', fontFamily: 'GabaritoBold', textDecoration: 'none' }}>Open in YepWatch</a>
    <a href={nativeInviteUrl(code, true)} style={{ color: glow.amber, padding: 12, fontFamily: 'Gabarito', textDecoration: 'underline' }}>Open in YepWatch Beta (Android)</a>
    <GText size={14} color={glow.muted}>Or continue in your browser below</GText>
  </View>;
}
