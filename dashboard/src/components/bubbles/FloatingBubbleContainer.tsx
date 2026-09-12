import { useState, useEffect } from 'react';
import { bubbleStore } from './useBubbleStore';
import { sessionApi, type Session } from '../../services/api';
import { formatPhoneForDisplay } from '../../utils/formatPhone';
import { SessionDock } from './SessionDock';
import './FloatingBubbleContainer.css';

export function FloatingBubbleContainer({ hidden = false }: { hidden?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveSessionsAndChats = async () => {
      try {
        const list = await sessionApi.list();
        if (!isMounted) return;
        const activeSessions = list.filter(
          (s) => s.status === 'ready'
        );
        setSessions(activeSessions);

        for (const sessionItem of activeSessions) {
          try {
            const chats = await sessionApi.getChats(sessionItem.id);
            if (!isMounted) return;
            if (Array.isArray(chats)) {
              // Take top 15 active/recent chats for floating bubbles to prevent heavy serialization
              const topChats = chats.slice(0, 15);
              const bubbleItems = topChats.map((chat) => {
                const displayName =
                  chat.name && !/^\+?\d+$/.test(chat.name.replace(/[\s()-]/g, '')) && !chat.name.includes('@')
                    ? chat.name
                    : (formatPhoneForDisplay(chat.name || chat.id) || chat.name || chat.id.split('@')[0]);

                return {
                  chatId: chat.id,
                  sessionId: sessionItem.id,
                  name: displayName,
                  unreadCount: chat.unreadCount || 0,
                  lastMessage: chat.lastMessage || '',
                };
              });
              bubbleStore.batchAddOrUpdateBubbles(bubbleItems);
            }
          } catch (e) {
            console.warn(`[FloatingBubbleContainer] Failed to fetch chats for session ${sessionItem.id}:`, e);
          }
        }
      } catch (err) {
        console.error('[FloatingBubbleContainer] Failed to fetch sessions:', err);
      }
    };

    void fetchActiveSessionsAndChats();
    // Realtime events arrive via WebSocket, so 60s background sync is sufficient
    const interval = setInterval(fetchActiveSessionsAndChats, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
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
      {sessions.map((session) => (
        <SessionDock key={session.id} session={session} />
      ))}
    </div>
  );
}
