import { SheetAddress } from '../../../features/room/Sheets';

/** /room/<id>/streaming opens the room with its Streaming sheet. */
export default function StreamingSheetAddress() {
  return <SheetAddress sheet="streaming" />;
}
