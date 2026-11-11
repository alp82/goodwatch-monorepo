import { LegalPage } from '../features/legal/LegalPage';
import { termsSections } from '../features/legal/content';
export default function Terms() { return <LegalPage title="YepWatch terms of use" sections={termsSections} />; }
