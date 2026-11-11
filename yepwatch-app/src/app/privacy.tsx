import { LegalPage } from '../features/legal/LegalPage';
import { privacySections } from '../features/legal/content';
export default function Privacy() { return <LegalPage title="YepWatch privacy policy" sections={privacySections} />; }
