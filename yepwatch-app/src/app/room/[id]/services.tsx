import { SheetAddress } from '../../../features/room/Sheets';

/** /room/<id>/services opens the room with its Your services sheet. */
export default function ServicesSheetAddress() {
  return <SheetAddress sheet="services" />;
}
