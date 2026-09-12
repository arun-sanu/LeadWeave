import { useEffect, useCallback, useMemo, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { bubbleStore } from '../components/bubbles/useBubbleStore';
import { sessionApi, type ChatMessage } from '../services/api';
import { formatPhoneForDisplay } from '../utils/formatPhone';

interface RawIncomingMessage {
  id?: string;
  waMessageId?: string;
  chatId?: string;
  from?: string;
  to?: string;
  body?: string;
  type?: string;
  timestamp?: number;
  fromMe?: boolean;
  direction?: 'incoming' | 'outgoing';
  contact?: { id?: string; name?: string; pushName?: string };
  chatName?: string;
  metadata?: Record<string, unknown>;
}

export function useGlobalBubbleListener() {
  const subscribedSessionsRef = useRef<Set<string>>(new Set());

  const handleMessage = useCallback((event: { sessionId?: string; message?: Record<string, unknown> }) => {
    if (!event?.message) return;

    const raw = event.message as unknown as RawIncomingMessage;
    
    // An incoming message is one not sent by us
    const isIncoming = raw.direction === 'incoming' || raw.fromMe === false || (!raw.fromMe && raw.direction !== 'outgoing');

    const targetChatId = raw.chatId || raw.from || raw.to;

    if (isIncoming && targetChatId) {
      const resolvedPushName = raw.chatName || raw.contact?.pushName || raw.contact?.name;
      const contactName =
        resolvedPushName && !resolvedPushName.includes('@')
          ? resolvedPushName
          : (typeof targetChatId === 'string' ? (formatPhoneForDisplay(targetChatId) || targetChatId.split('@')[0]) : 'Contact');

      let messagePreview = 'New message';
      if (typeof raw.body === 'string' && raw.body.trim()) {
        messagePreview = raw.body;
      } else if (raw.type && raw.type !== 'text') {
        const typeLabels: Record<string, string> = {
          image: '📷 Photo',
          video: '🎥 Video',
          audio: '🎵 Audio',
          voice: '🎤 Voice note',
          document: '📄 Document',
          sticker: '✨ Sticker',
          location: '📍 Location',
          contact: '👤 Contact card',
        };
        messagePreview = typeLabels[raw.type] || `[${raw.type}]`;
      }

      const mappedMsg: ChatMessage = {
        id: raw.id || `msg-${Date.now()}`,
        waMessageId: raw.waMessageId || raw.id || `wamid-${Date.now()}`,
        chatId: targetChatId,
        from: raw.from || targetChatId,
        to: raw.to || 'me',
        body: raw.body || '',
        type: (raw.type as ChatMessage['type']) || 'text',
        direction: 'incoming',
        status: 'delivered',
        timestamp: raw.timestamp || Math.floor(Date.now() / 1000),
        createdAt: new Date().toISOString(),
        metadata: raw.metadata as ChatMessage['metadata'],
      };

      bubbleStore.addOrUpdateBubble({
        chatId: targetChatId,
        sessionId: event.sessionId || 'default',
        name: contactName,
        incrementUnread: true,
        lastMessage: messagePreview,
        lastMessageObject: mappedMsg,
        showLivelyAlert: true,
      });
    }
  }, []);

  // Referentially stable wsEvents object to prevent useWebSocket re-attaching listeners on every render
  const wsEvents = useMemo(
    () => ({
      onMessage: handleMessage,
    }),
    [handleMessage],
  );

  const { isConnected, subscribe } = useWebSocket(wsEvents);

  useEffect(() => {
    if (!isConnected) {
      subscribedSessionsRef.current.clear();
      return;
    }

    // 1. Subscribe to global wildcard events for unrestricted keys
    subscribe('*', ['message.received', 'message.sent']);

    // 2. Also fetch active sessions, subscribe per session id, and seed existing chats into bubbleStore
    async function subscribeToActiveSessions() {
      try {
        const sessions = await sessionApi.list();
        if (Array.isArray(sessions)) {
          for (const sess of sessions) {
            if (sess.id && !subscribedSessionsRef.current.has(sess.id)) {
              subscribedSessionsRef.current.add(sess.id);
              subscribe(sess.id, ['message.received', 'message.sent']);
            }
            if (sess.id && sess.status === 'ready') {
              try {
                const chats = await sessionApi.getChats(sess.id);
                if (Array.isArray(chats)) {
                  const topChats = chats.slice(0, 15);
                  const bubbleItems = topChats.map((chat) => {
                    const displayName =
                      chat.name && !/^\+?\d+$/.test(chat.name.replace(/[\s()\-]/g, '')) && !chat.name.includes('@')
                        ? chat.name
                        : (formatPhoneForDisplay(chat.name || chat.id) || chat.name || chat.id.split('@')[0]);

                    return {
                      chatId: chat.id,
                      sessionId: sess.id,
                      name: displayName,
                      unreadCount: chat.unreadCount || 0,
                      lastMessage: chat.lastMessage || '',
                    };
                  });
                  bubbleStore.batchAddOrUpdateBubbles(bubbleItems);
                }
              } catch (chatErr) {
                console.warn(`[GlobalBubbleListener] Failed to fetch chats for session ${sess.id}:`, chatErr);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[GlobalBubbleListener] Failed to subscribe to individual session rooms:', err);
      }
    }

    void subscribeToActiveSessions();
  }, [isConnected, subscribe]);

  return { isConnected };
}
