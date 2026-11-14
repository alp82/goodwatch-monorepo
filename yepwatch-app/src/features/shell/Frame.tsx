/**
 * The page frame of every screen (direction D): one background, the sticky app header, and the body
 * in the centered container, top-aligned right under the header. The screen's main action (`footer`)
 * is pinned at the bottom on phones and sits at the end of the content on bigger windows. Sheets open
 * over the body while the header stays usable.
 */
import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Backdrop } from '../glow/Backdrop';
import { EdgeBack } from '../glow/EdgeBack';
import { glow, onePress } from '../glow/theme';
import type { HomeRoom } from '../rooms/home-model';
import { HomeProfileSheet } from '../rooms/panels';
import { HomeRoomsSheet, YourRoomsSheet, type CurrentRoom, type RoomsSheetActions } from '../rooms/RoomsSheet';
import { AppHeader, type AppHeaderProps } from './Header';
import { keyboardDismissMode, useLayout } from './layout';
import { CoveredBody } from './parts';
import { FloatingNote, NoteLayerProvider, useNoteLayer } from './floating-note';
import { Shade } from './Sheet';
import { closeTopSheet } from './sheet-stack';
import { useStableCallback } from './steady';
import { warm } from './tokens';
import { KeyboardRoom, useKeyboardInset } from './keyboard-inset';
import { openNewRoom } from '../room/nav';

export { BrandMark } from './Header';

/** What the header's room pill opens: Your rooms. */
export interface FrameRooms {
  /** The room this screen belongs to. */
  current?: CurrentRoom;
  /** The open rooms when the page already has them (the start page); otherwise the sheet reads them. */
  rooms?: readonly HomeRoom[];
  loading?: boolean;
  /** Defaults: open the room, New room and Join a room on the start page. */
  actions?: Partial<RoomsSheetActions>;
}

export interface AppFrameProps {
  header?: AppHeaderProps;
  rooms?: FrameRooms;
  children: ReactNode;
  /** The screen's main action: pinned on phones and short windows ('auto'), at the end of the content on bigger windows. */
  footer?: ReactNode;
  footerPlacement?: 'auto' | 'pinned' | 'content';
  /** A Sheet over the body; the page underneath becomes inert, the header stays usable. */
  sheet?: ReactNode;
  /** A page over everything, header included (title details, cheers). */
  overlay?: ReactNode;
  /** Paints over the backdrop, behind the header and the body (Tonight's poster glow). */
  backdrop?: ReactNode;
  /** The overlay covers this screen: header and body stay laid out but are inert. */
  covered?: boolean;
  /** The body scrolls (default); voting fills it instead. */
  scroll?: boolean;
  /** The content column's widest size; 'page' (default) is the shared container. */
  width?: number | 'page';
  /** Space between the body's children. */
  gap?: number;
  testID?: string;
  /** How far below the header the room's note floats (below a screen's own top bar). */
  noteTop?: number;
  /** The frame's outer box, which the room backdrop spans (the voting stage places its rim against it). */
  frameRef?: Ref<ComponentRef<typeof View>>;
}

/** Header destinations: a local new-room draft, an existing room, or the start page's join form. */
export const startPage = {
  open: (roomId: string) => router.push({ pathname: '/room/[id]', params: { id: roomId } }),
  newRoom: openNewRoom,
  join: () => router.push({ pathname: '/', params: { open: 'join' } }),
};

// Web: effects that fly past the page edge (falling popcorn) must not grow the scroll area.
const webClip = Platform.OS === 'web' ? { overflow: 'hidden' as const } : null;
// Web: the frame fills the window, so nothing in it (the voting stage's glows and resting stamps reach past the
// screen edge) may grow the document's scroll area either; iOS Safari lets a page pan sideways into it. `clip`
// cuts it off at the window like `hidden` without making the frame a scroll container a focused field could scroll.
const webFrameClip = Platform.OS === 'web' ? ({ overflow: 'clip' } as unknown as ViewStyle) : null;

export function AppFrame({ header = {}, rooms, children, footer, footerPlacement = 'auto', sheet, overlay, backdrop, covered = false, scroll = true, width = 'page', gap = 0, testID, noteTop = 8, frameRef }: AppFrameProps) {
  const layout = useLayout();
  const pathname = usePathname();
  const { phone, short, gutter, max, z } = layout;
  const insets = useSafeAreaInsets();
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notes = useNoteLayer();
  const pinned = footer ? (footerPlacement === 'pinned' || (footerPlacement === 'auto' && (phone || short))) : false;
  const column = { width: '100%', maxWidth: width === 'page' ? max : Math.min(width, max), alignSelf: 'center' } as const;
  const actions: RoomsSheetActions = { open: startPage.open, newRoom: startPage.newRoom, join: startPage.join, ...rooms?.actions };
  const closeRooms = () => setRoomsOpen(false);
  const roomsSheet = roomsOpen ? (rooms?.rooms
    ? <YourRoomsSheet current={rooms.current} rooms={rooms.rooms} loading={rooms.loading} actions={actions} onClose={closeRooms} />
    : <HomeRoomsSheet current={rooms?.current} actions={actions} onClose={closeRooms} />) : null;
  // The avatar opens Profile right here, over this page: it never moves to the start page underneath.
  const profileSheet = profileOpen ? <HomeProfileSheet returnTo={pathname} onClose={() => setProfileOpen(false)} /> : null;
  const shownSheet = roomsSheet ?? profileSheet ?? sheet;
  // The header's Back closes the sheet on top first, like every other Back.
  // Stable identities, so the memoized header skips the render of every room update.
  const goBack = useStableCallback(() => { if (!closeTopSheet()) header.back?.(); });
  const back = header.back ? goBack : undefined;
  const openPill = useStableCallback(() => (header.onPill ? header.onPill() : setRoomsOpen(true)));
  const openProfile = useStableCallback(() => (header.onProfile ? header.onProfile() : setProfileOpen(true)));
  // Android: the keyboard covers the page (edge to edge, keyboard-inset.ts); the body and its pinned action stay above it.
  const keyboard = useKeyboardInset();
  // The keyboard covers the system navigation area too, so its inset replaces the bottom safe area.
  const safeBottom = keyboard.inset > 0 ? 0 : insets.bottom;
  const top = scroll ? (phone ? 22 : z(40)) : (phone ? 12 : z(24));
  const bottom = (scroll ? (phone ? 32 : z(56)) : (phone ? 12 : z(32))) + (pinned ? 0 : safeBottom);
  const content = (
    <>
      {children}
      {footer && !pinned ? <View testID="frame-actions" style={{ gap: 10, paddingTop: z(8) }}>{footer}</View> : null}
    </>
  );
  return (
    <NoteLayerProvider slot={notes.slot}>
    <View ref={frameRef} testID={testID} style={[{ flex: 1, backgroundColor: glow.bg }, webFrameClip]}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}><Backdrop /></View>
      {backdrop}
      {/* An open sheet is modal: the header behind it is out of reach for touch, focus and screen readers,
          and a tap on it closes the sheet (as a tap on the shade does), so its Back still closes the sheet first. */}
      <CoveredBody keepView covered={covered || Boolean(shownSheet)} testID="covered-header" style={{ paddingTop: insets.top, backgroundColor: warm.bar, zIndex: 30 }}>
        <AppHeader {...header} back={back} onPill={header.onPill || header.pill ? openPill : undefined} onProfile={openProfile} />
      </CoveredBody>
      {shownSheet && !covered ? <View testID="header-shade" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: insets.top + layout.header, zIndex: 31 }}><Shade onPress={onePress(() => { closeTopSheet(); })} /></View> : null}
      <View style={{ flex: 1, minHeight: 0 }}>
        <CoveredBody keepView covered={covered || Boolean(shownSheet)}>
          <KeyboardRoom {...keyboard} style={{ flex: 1, minHeight: 0 }}>
            {scroll ? (
              <ScrollView testID="frame-body" style={{ flex: 1 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={keyboardDismissMode} contentContainerStyle={{ flexGrow: 1, paddingHorizontal: gutter, paddingTop: top, paddingBottom: bottom, ...webClip }}>
                <View style={{ ...column, gap }}>{content}</View>
              </ScrollView>
            ) : (
              <View testID="frame-body" style={{ flex: 1, minHeight: 0, paddingHorizontal: gutter, paddingTop: top, paddingBottom: bottom }}>
                <View style={{ ...column, flex: 1, minHeight: 0, gap }}>{content}</View>
              </View>
            )}
            {pinned ? (
              <View testID="frame-dock" style={{ borderTopWidth: 1, borderTopColor: warm.line, backgroundColor: 'rgba(10,9,8,0.9)', paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 14 + safeBottom }}>
                <View style={{ ...column, gap: 10 }}>{footer}</View>
              </View>
            ) : null}
          </KeyboardRoom>
        </CoveredBody>
        {shownSheet}
        {/* Under a screen's own top bar the note sits lower (noteTop); with a sheet open it goes back up to
            the header, above the sheet's title and Close. */}
        <FloatingNote note={notes.note} width={Math.min(z(560), max)} top={shownSheet ? 8 : noteTop} />
      </View>
      {overlay}
      {header.back && !covered && !shownSheet ? <EdgeBack back={header.back} /> : null}
    </View>
    </NoteLayerProvider>
  );
}
