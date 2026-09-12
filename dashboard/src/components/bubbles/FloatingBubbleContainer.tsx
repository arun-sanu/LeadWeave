import { useState, useEffect } from 'react';
import { sessionApi, type Session } from '../../services/api';
import { SessionDock } from './SessionDock';
import './FloatingBubbleContainer.css';

export function FloatingBubbleContainer({ hidden = false }: { hidden?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveSessions = async () => {
      try {
        const list = await sessionApi.list();
        if (!isMounted) return;
        const activeSessions = list.filter(s => s.status === 'ready');
        setSessions(activeSessions);
      } catch (err) {
        console.error('[FloatingBubbleContainer] Failed to fetch sessions:', err);
      }
    };

    void fetchActiveSessions();

    return () => {
      isMounted = false;
    };
  }, []);

  if (hidden || sessions.length === 0) return null;

  return (
    <div
      className="floating-bubble-dock-container"
      style={{
        visibility: 'visible',
        pointerEvents: 'none',
      }}
    >
      {sessions.map(session => (
        <SessionDock key={session.id} session={session} />
      ))}
    </div>
  );
}
