import { SheetAddress } from '../../../features/room/Sheets';

/** /room/<id>/kinds opens the room with its Movies and shows sheet. */
export default function KindsSheetAddress() {
  return <SheetAddress sheet="kinds" />;
}
