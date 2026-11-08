import { SheetAddress } from '../../../features/room/Sheets';

/** /room/<id>/room opens the room with its Room sheet. */
export default function RoomSheetAddress() {
  return <SheetAddress sheet="room" />;
}
