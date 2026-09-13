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
  metadata?: any;
}

interface PendingBubbleMessage {
  message: ChatMessage;
  sessionId: string;
}

export function useGlobalBubbleListener() {
  const subscribedSessionsRef = useRef<Set<string>>(new Set());
  const pendingMessageBatchRef = useRef<Map<string, PendingBubbleMessage>>(new Map());
  const batchFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushMessageBatch = useCallback(() => {
    if (batchFlushTimeoutRef.current) {
      clearTimeout(batchFlushTimeoutRef.current);
      batchFlushTimeoutRef.current = null;
    }
    if (pendingMessageBatchRef.current.size === 0) return;

    const messages = Array.from(pendingMessageBatchRef.current.values());
    pendingMessageBatchRef.current.clear();

    const bubbleUpdates = messages.map(({ message: msg, sessionId }) => ({
      chatId: msg.chatId,
      sessionId,
      name: msg.chatName || formatPhoneForDisplay(msg.from || msg.to || '') || 'Contact',
      incrementUnread: msg.direction === 'incoming',
      lastMessage: msg.body || `[${msg.type}]`,
      lastMessageObject: msg,
      showLivelyAlert: msg.direction === 'incoming',
    }));

    bubbleStore.batchAddOrUpdateBubbles(bubbleUpdates);
  }, []);

  const handleMessage = useCallback(
    (event: { sessionId?: string; message?: any }) => {
      if (!event?.message) return;

      const raw = event.message as unknown as RawIncomingMessage;
      const isIncoming =
        raw.direction === 'incoming' || raw.fromMe === false || (!raw.fromMe && raw.direction !== 'outgoing');
      const targetChatId = raw.chatId || raw.from || raw.to;

      if (!isIncoming || !targetChatId) return;

      // Avoid duplicate updates when Chats.tsx is already handling active room events
      if (window.location.pathname.includes('/chats')) return;

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

      // Batch message updates: accumulate and flush on a timer to avoid
      // 200+ synchronous DOM re-renders when multiple messages arrive
      const dedupeKey = `${targetChatId}`;
      pendingMessageBatchRef.current.set(dedupeKey, {
        message: mappedMsg,
        sessionId: event.sessionId || 'default',
      });

      if (batchFlushTimeoutRef.current) {
        clearTimeout(batchFlushTimeoutRef.current);
      }
      batchFlushTimeoutRef.current = setTimeout(flushMessageBatch, 50);
    },
    [flushMessageBatch],
  );

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
      // Flush any pending messages on disconnect
      if (batchFlushTimeoutRef.current) {
        clearTimeout(batchFlushTimeoutRef.current);
        batchFlushTimeoutRef.current = null;
      }
      flushMessageBatch();
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
                  const bubbleItems = topChats.map(chat => {
                    const displayName =
                      chat.name && !/^\+?\d+$/.test(chat.name.replace(/[\s()-]/g, '')) && !chat.name.includes('@')
                        ? chat.name
                        : formatPhoneForDisplay(chat.name || chat.id) || chat.name || chat.id.split('@')[0];

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

    // Cleanup batch flush timeout on unmount
    return () => {
      if (batchFlushTimeoutRef.current) {
        clearTimeout(batchFlushTimeoutRef.current);
        batchFlushTimeoutRef.current = null;
      }
      flushMessageBatch();
    };
  }, [isConnected, subscribe, flushMessageBatch]);

  return { isConnected };
}
