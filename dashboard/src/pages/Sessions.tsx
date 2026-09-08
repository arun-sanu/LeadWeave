import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import SessionsManager from '../components/sessions/SessionsManager';
import './Sessions.css';

export function Sessions() {
  const { t } = useTranslation();
  useDocumentTitle(t('sessions.title'));

  return (
    <div className="sessions-page">
      <SessionsManager />
    </div>
  );
}

export default Sessions;
