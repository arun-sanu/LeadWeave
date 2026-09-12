/* cspell:words Coalescer Acks refetches unarchived crossfade popout */
import { useState, useEffect, useCallback, useRef, useMemo, useContext, Suspense } from 'react';
import { UNSAFE_LocationContext, UNSAFE_NavigationContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { nextReconnectState } from '../utils/reconnectState';
import { applyIncomingToChatList } from '../utils/chatList';
import { filterChats, filterGroupChats, filterArchivedChats, filterChannels, groupStatusesByContact } from '../utils/chatFilters';
import { ArrowLeft, Loader2, Megaphone, CircleDashed, AlertCircle, MessageSquare, ExternalLink, Archive, ArchiveRestore, X, Smartphone, MessageCircle, Search, Network } from 'lucide-react';
import { useProfilePicture } from '../hooks/useProfilePicture';
import { useProfilePictures } from '../hooks/useProfilePictures';
import { useResolvedPhone } from '../hooks/useResolvedPhone';
import { formatPhoneForDisplay } from '../utils/formatPhone';
import { bubbleStore } from '../components/bubbles/useBubbleStore';
import {
  sessionApi,
  messageApi,
  asMessageType,
  type Session,
  type Chat,
  type ChatKind,
  type Channel,
  type ContactStatusGroup,
} from '../services/api';
import {
  applyMessageEdit,
  mergeDeliveryStatus,
  mergeReactionSnapshot,
  findRevokedIndex,
  getMediaSrc,
  type ChatMessageView,
  type MessageMedia,
} from '../utils/chatMessages';
import { useWebSocket } from '../hooks/useWebSocket';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useChatMessages, useChatMessagesActions, messagesQueryKey } from '../hooks/useChatMessages';
import { useChannelMessages } from '../hooks/useChannelMessages';
import { useContactStatuses } from '../hooks/useContactStatuses';
import { useChatScrollPosition } from '../hooks/useChatScrollPosition';
import { useSessionsQuery, useCurrentEngineQuery } from '../hooks/queries';
import { createTrailingCoalescer } from '../utils/trailingCoalescer';
import { lazyWithRetry as lazy } from '../utils/lazyWithRetry';
import MessageBody from '../components/chats/MessageBody';
import type { LightboxItem } from '../components/chats/MediaLightbox';
import KindIcon from '../components/chats/KindIcon';
import ChatSidebar, { type ChatsTab } from '../components/chats/ChatSidebar';
import EmojiText from '../components/chats/EmojiText';
import ChatThread from '../components/chats/ChatThread';
import ChatComposer, { type StagedAttachment } from '../components/chats/ChatComposer';
import StatusMedia from '../components/chats/StatusMedia';
import SessionsManager from '../components/sessions/SessionsManager';
import { LanMeshTab } from './LanMeshTab';
import './Chats.css';

const MediaLightbox = lazy(() => import('../components/chats/MediaLightbox'));
const StatusComposeModal = lazy(() => import('../components/chats/StatusComposeModal'));

// Quiet window for coalescing mark-as-read RPCs (see markReadCoalescer below).
const MARK_READ_DEBOUNCE_MS = 750;

// mergeDeliveryStatus (forward-only delivery-tick merge) is shared with mergeOrAppend in utils/chatMessages
// so the WS append path and the ack path apply the exact same rule.

interface IncomingWsMessage {
  id: string;
  chatId: string;
  from: string;
  to: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe?: boolean;
  media?: MessageMedia;
  quotedMessage?: { id: string; body: string };
  // The backend emits `call` as a top-level field on the live `message.received` event (it's only
  // folded into `metadata` on the persisted/history path), so declare it here to carry it through.
  call?: { video: boolean; missed: boolean };
  metadata?: ChatMessageView['metadata'];
  kind?: ChatKind;
  /** Group poster: `from` is the group JID, so `contact`/`author` identify who actually sent it. */
  contact?: { id?: string; name?: string; pushName?: string };
  author?: string;
}

// WhatsApp's text-status font slots — the current wire enum is {0,1,2,6,7,8,9,10} (6 is the bold
// system face); 3–5 are legacy slots older clients still emit. Approximated with generic
// families/weights since the actual faces are proprietary; slot 0 and unknown slots keep the UI
// default.
const STATUS_FONT: Record<number, { family?: string; weight?: number }> = {
  1: { family: 'serif' },
  2: { family: 'cursive' },
  3: { family: 'fantasy' }, // legacy
  4: { family: 'serif' }, // legacy
  5: { family: 'ui-rounded, system-ui, sans-serif' }, // legacy
  6: { weight: 700 },
  7: { family: 'cursive' },
  8: { family: 'serif' },
  9: { family: 'sans-serif', weight: 800 },
  10: { family: 'monospace', weight: 700 },
};

/** Inline style for a status item's font slot; {} when unstyled/unknown. */
const statusFontStyle = (font?: number): { fontFamily?: string; fontWeight?: number } => {
  if (font === undefined) return {};
  const slot = STATUS_FONT[font];
  if (!slot) return {};
  return {
    ...(slot.family ? { fontFamily: slot.family } : {}),
    ...(slot.weight ? { fontWeight: slot.weight } : {}),
  };
};

export function Chats() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.chats'));
  const { error: showErrorToast, warning: showWarningToast, success: showSuccessToast } = useToast();

  // Request browser Notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, []);

  // Left section view mode: defaults to 'sessions' when requested via ?tab=sessions, otherwise 'chats'
  const [leftPaneMode, setLeftPaneMode] = useState<'chats' | 'sessions' | 'lan-mesh'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'sessions' || tab === 'lan-mesh') {
        return tab;
      }
      if (params.get('chat') || tab === 'chats') {
        return 'chats';
      }
    }
    return 'chats';
  });

  const locationContext = useContext(UNSAFE_LocationContext);
  const navigationContext = useContext(UNSAFE_NavigationContext);
  const locationSearch = locationContext?.location?.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const navigateFn = useMemo(() => {
    const nav = navigationContext?.navigator;
    if (!nav) return null;
    return (to: string, options?: { replace?: boolean }) => {
      if (options?.replace) {
        nav.replace(to);
      } else {
        nav.push(to);
      }
    };
  }, [navigationContext]);

  // Sessions list & active session
  const sessionsQuery = useSessionsQuery();
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const isInitialSessionsLoading = sessionsQuery.isLoading && !sessionsQuery.data && allSessions.length === 0;

  // Chats list
  const [chats, setChats] = useState<Chat[]>([]);
  const [loadingChats, setLoadingChats] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected chat & message history
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeStatusContactId, setActiveStatusContactId] = useState<string | null>(null);

  const closeActiveRoom = useCallback(() => {
    setActiveChat(null);
    setActiveChannel(null);
    setActiveStatusContactId(null);
  }, []);

  const handleSetLeftPaneMode = useCallback((mode: 'chats' | 'sessions' | 'lan-mesh') => {
    setLeftPaneMode(mode);
    if (mode !== 'chats') {
      closeActiveRoom();
    }
    if (navigateFn) {
      navigateFn(`?tab=${mode}`, { replace: true });
    } else if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', mode);
      window.history.replaceState(null, '', url.toString());
    }
  }, [navigateFn, closeActiveRoom]);

  useEffect(() => {
    const params = new URLSearchParams(locationSearch);
    const tab = params.get('tab');
    if (tab === 'sessions' || tab === 'lan-mesh' || tab === 'chats') {
      setLeftPaneMode(tab);
      if (tab !== 'chats') {
        closeActiveRoom();
      }
    }
    const querySession = params.get('session');
    if (querySession && sessions.some(s => s.id === querySession)) {
      setSelectedSessionId(querySession);
    }
  }, [locationSearch, sessions, closeActiveRoom]);

  // Chats/Groups/Channels/Status/Archive tab selection. Switching tabs closes whatever conversation is open so a
  // press on another tab doesn't leave a Chats-tab room rendered underneath a Channels/Status list.
  const [activeTab, setActiveTab] = useState<ChatsTab>('chats');
  const switchTab = useCallback((tab: ChatsTab) => {
    setActiveTab(tab);
    setActiveChat(null);
    setActiveChannel(null);
    setActiveStatusContactId(null);
  }, []);

  // Channels tab: only whatsapp-web.js implements channel listing/reading — Baileys throws 501 for
  // both, so the query is gated off entirely (never fired) rather than left to fail per-request.
  const currentEngine = useCurrentEngineQuery();
  const channelsSupported = currentEngine.data?.engineType === 'whatsapp-web.js';
  const channelsQuery = useQuery({
    queryKey: ['channels', selectedSessionId],
    queryFn: () => sessionApi.getSubscribedChannels(selectedSessionId!),
    enabled: Boolean(selectedSessionId) && channelsSupported && activeTab === 'channels',
  });
  const channelMessages = useChannelMessages(selectedSessionId, activeChannel?.id ?? null);

  // Status tab: both engines expose stored status content, so this query isn't engine-gated (unlike
  // channelsQuery above) — but it is tab-gated the same way, so selecting a session on another tab
  // doesn't fire a background /status fetch nobody is looking at.
  const statusesQuery = useContactStatuses(selectedSessionId, activeTab === 'status');

  // A channel feed opens at its newest post, mirroring the chat room's initial scroll. The pane is
  // also keyed by channel id, so switching channels remounts the feed instead of reusing the DOM
  // (and its stale scroll offset) of the previous channel.
  const channelFeedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = channelFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChannel?.id, channelMessages.data]);

  // --- Status compose modal ---
  // The page owns only the open flag (its trigger sits in the sidebar header below); the form
  // itself — state, contacts query, submit — is components/chats/StatusComposeModal.
  const [composeOpen, setComposeOpen] = useState<boolean>(false);

  const {
    data: messages = [],
    isLoading: loadingMessages,
    isError: messagesError,
  } = useChatMessages(selectedSessionId, activeChat?.id ?? null);
  const { appendMessage, updateMessage } = useChatMessagesActions();
  const queryClient = useQueryClient();

  // Lightbox state for media viewer
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [replyingTo, setReplyingTo] = useState<ChatMessageView | null>(null);
  // Draft text lives here (not in ChatComposer) so it survives closing/switching the room.
  const [messageInput, setMessageInput] = useState<string>('');
  // The staged attachment lives here for the same reason the draft text does — ChatComposer
  // unmounts when the room closes, which would silently discard a picked file. Unlike the text
  // draft it is dropped when a DIFFERENT chat is opened (see the effect below): a file that
  // follows the user into another conversation can be sent to the wrong recipient.
  const [attachment, setAttachment] = useState<StagedAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Revoke the object URL created for an image-attachment preview once it is replaced or cleared.
  // The cleanup runs with the previous value on every change, so this single effect covers all
  // paths (new file, remove, send, chat switch) — otherwise each preview leaks a blob held for the
  // lifetime of the document. It lives here, not in ChatComposer: revoking on the composer's
  // unmount would hand a reopened room a dead blob URL for an attachment that is still staged.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Drop a staged attachment when the user moves to a DIFFERENT chat. Closing the room
  // (`activeChat` → null) deliberately keeps it, so close/reopen is a lossless round trip; only an
  // actual change of conversation clears. The composer invalidates its in-flight FileReader on the
  // same transition, so a late read cannot re-stage the file against the new chat.
  const lastRoomIdRef = useRef<string | null>(null);
  useEffect(() => {
    const current = activeChat?.id ?? null;
    if (current === null) return;
    const previous = lastRoomIdRef.current;
    lastRoomIdRef.current = current;
    if (previous === null || previous === current) return;
    setAttachment(null);
    setPreviewUrl(null);
  }, [activeChat]);

  // Per-chat scroll-position memory + auto-scroll heuristic.
  // Pass `messages.length > 0` as the loaded signal: it stays stable once the
  // chat has any message (doesn't toggle per append) and covers both the
  // first-fetch resolution and a WS-driven first message on a previously-empty
  // chat. `loadingMessages` alone would miss the latter case.
  const {
    containerRef: messagesContainerRef,
    onMessageAppended,
    onMediaLoad,
  } = useChatScrollPosition(activeChat?.id ?? null, messages.length > 0);

  // Batch profile-picture fetch for the visible chat list — ONE request for the whole sidebar
  // (per-row queries burst the per-IP throttle into 429s). Sorted-key cached 1h; rows fall back
  // to the generic icon for ids that resolve null.
  const chatIds = useMemo(() => chats.map(c => c.id), [chats]);
  const listPics = useProfilePictures(selectedSessionId || undefined, chatIds);

  // Profile-picture fetch for the active room (cached 1h by useProfilePicture; TanStack Query
  // dedupes, so other components querying the same key share this slice).
  const activePp = useProfilePicture(selectedSessionId || undefined, activeChat?.id);

  // Header phone line. Local formatting handles @c.us ids offline; for anything else personal
  // (notably @lid privacy ids, which are NOT phones and must never be formatted as one) resolve
  // the real number through the engine — cached a day, and only fired when local formatting failed.
  const activePhoneDisplay = activeChat ? formatPhoneForDisplay(activeChat.id) : null;
  const needsPhoneResolution = Boolean(activeChat && activeChat.kind === 'individual' && !activePhoneDisplay);
  const resolvedPhoneQ = useResolvedPhone(
    needsPhoneResolution ? selectedSessionId || undefined : undefined,
    needsPhoneResolution ? activeChat?.id : undefined,
  );
  const activePhoneText =
    activePhoneDisplay ?? (resolvedPhoneQ.data ? formatPhoneForDisplay(resolvedPhoneQ.data) : null);

  // 1. Sync available connected sessions from TanStack Query (cached across navigation)
  const syncSessionsList = useCallback((list: Session[]) => {
    setAllSessions(prev => {
      const prevSig = prev.map(s => `${s.id}:${s.status}:${s.phone || ''}`).join('|');
      const nextSig = list.map(s => `${s.id}:${s.status}:${s.phone || ''}`).join('|');
      return prevSig === nextSig ? prev : list;
    });

    const readySessions = list.filter(s => s.status === 'ready');
    setSessions(prev => {
      const prevSig = prev.map(s => `${s.id}:${s.status}:${s.phone || ''}`).join('|');
      const nextSig = readySessions.map(s => `${s.id}:${s.status}:${s.phone || ''}`).join('|');
      return prevSig === nextSig ? prev : readySessions;
    });

    if (readySessions.length > 0) {
      setSelectedSessionId(prev => {
        const params = new URLSearchParams(window.location.search);
        const querySession = params.get('session');
        if (querySession && readySessions.some(s => s.id === querySession)) {
          return querySession;
        }
        if (prev && readySessions.some(s => s.id === prev)) {
          return prev;
        }
        return readySessions[0].id;
      });
    } else {
      setSelectedSessionId('');
    }
  }, []);

  useEffect(() => {
    if (sessionsQuery.data) {
      syncSessionsList(sessionsQuery.data);
    }
  }, [sessionsQuery.data, syncSessionsList]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await sessionsQuery.refetch();
      if (res.data) {
        syncSessionsList(res.data);
      }
    } catch (err) {
      showErrorToast(t('chats.errors.loadSessions'), err instanceof Error ? err.message : undefined);
    }
  }, [sessionsQuery, syncSessionsList, t, showErrorToast]);

  const handleSessionsChange = useCallback((updatedList: Session[]) => {
    syncSessionsList(updatedList);
  }, [syncSessionsList]);

  // 2. Fetch chats when active session changes
  const loadChats = useCallback(
    async (sessionId: string) => {
      if (!sessionId) return;
      try {
        setLoadingChats(true);
        const data = await sessionApi.getChats(sessionId);
        const sorted = [...data].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setChats(sorted);

        // Sync resolved contact names to bubbleStore for floating chat bubbles
        sorted.forEach(c => {
          if (c.name && !c.name.includes('@')) {
            bubbleStore.updateBubbleName(c.id, c.name);
          }
        });

        // Check if there is a target chat requested in query params
        const params = new URLSearchParams(window.location.search);
        const queryChatId = params.get('chat');
        if (queryChatId) {
          handleSetLeftPaneMode('chats');
          const found = sorted.find(c => c.id === queryChatId);
          if (found) {
            setActiveChat(found);
          } else {
            // Even if not in first page of sorted list, construct a minimal chat object so room opens
            setActiveChat({
              id: queryChatId,
              name: queryChatId.split('@')[0],
              timestamp: Math.floor(Date.now() / 1000),
              unreadCount: 0,
              isGroup: queryChatId.endsWith('@g.us'),
              kind: queryChatId.endsWith('@g.us') ? 'group' : 'individual',
            });
          }
        }
      } catch (err) {
        showErrorToast(t('chats.errors.loadChats'), err instanceof Error ? err.message : undefined);
        setChats([]);
      } finally {
        setLoadingChats(false);
      }
    },
    [t, showErrorToast, handleSetLeftPaneMode],
  );

  useEffect(() => {
    if (selectedSessionId) {
      void loadChats(selectedSessionId);
      // A staged attachment belongs to a chat in the session being left, so it is dropped here
      // rather than carried across — the close/reopen round trip that preserves it is scoped to a
      // single session. Clearing previewUrl runs the revoke effect's cleanup; the composer
      // unmounts with the closed room and invalidates its own in-flight FileReader.
      setAttachment(null);
      setPreviewUrl(null);
      lastRoomIdRef.current = null;
    }
  }, [selectedSessionId, loadChats]);

  // Coalesce mark-as-read RPCs per chat: every incoming message in the visible chat raises a
  // read event, and a per-event POST sprays the gateway into 429s. One trailing call per chat
  // after a quiet window carries the same effect.
  const markReadCoalescer = useMemo(
    () =>
      createTrailingCoalescer<string>(chatId => {
        void sessionApi.markChatRead(selectedSessionId, chatId).catch(err => {
          showWarningToast(t('chats.errors.markRead'), err instanceof Error ? err.message : undefined);
        });
      }, MARK_READ_DEBOUNCE_MS),
    [selectedSessionId, t, showWarningToast],
  );

  // Flush pending trailing calls on unmount / session switch: the mark-as-read POST is
  // fire-and-forget (a failure only raises a warning toast), so firing on the way out is safe —
  // and dropping the pending call would leave the last messages of a quickly-exited chat unread.
  // The flush closure still references the PREVIOUS session on a session switch, which is exactly
  // where those queued reads belong.
  useEffect(() => () => markReadCoalescer.flush(), [markReadCoalescer]);

  const markChatRead = useCallback(
    (chatId: string) => {
      markReadCoalescer.call(chatId);
    },
    [markReadCoalescer],
  );

  // 3. WebSocket integration for real-time messages
  const handleIncomingMessage = useCallback(
    (event: { sessionId: string; message: Record<string, unknown> }) => {
      if (event.sessionId !== selectedSessionId) return;

      const newMsg = event.message as unknown as IncomingWsMessage;

      const mappedMessage: ChatMessageView = {
        id: newMsg.id,
        waMessageId: newMsg.id,
        chatId: newMsg.chatId,
        // For a group post `from` is the group JID, so the sender's name is carried on `contact`.
        // Persisted rows keep the same value in `chatName`; normalize both to one field for the thread.
        chatName: newMsg.contact?.pushName ?? newMsg.contact?.name,
        author: newMsg.author,
        from: newMsg.from,
        to: newMsg.to,
        body: newMsg.body,
        type: asMessageType(newMsg.type),
        direction: newMsg.fromMe ? 'outgoing' : 'incoming',
        status: 'sent',
        timestamp: newMsg.timestamp,
        createdAt: new Date(newMsg.timestamp * 1000).toISOString(),
        metadata: newMsg.metadata || {
          media: newMsg.media,
          quotedMessage: newMsg.quotedMessage,
          call: newMsg.call,
        },
        kind: newMsg.kind,
      };

      // Always write to the React Query cache for this message's session — keeps non-active chats
      // up to date so re-opening them shows fresh data without a refetch.
      appendMessage(event.sessionId, newMsg.chatId, mappedMessage);

      // Show pop-up bubble notification for incoming messages (from someone else)
      if (!newMsg.fromMe) {
        const senderName = newMsg.contact?.pushName ?? newMsg.contact?.name ?? newMsg.from.split('@')[0];
        const previewText = newMsg.body || (newMsg.media ? `📷 ${t('chats.media.image')}` : t('chats.media.file'));

        // Update global floating pill and bubble store
        bubbleStore.addOrUpdateBubble({
          chatId: newMsg.chatId,
          sessionId: event.sessionId,
          name: senderName,
          incrementUnread: activeChat?.id !== newMsg.chatId,
          lastMessage: previewText,
          lastMessageObject: mappedMessage,
          showLivelyAlert: activeChat?.id !== newMsg.chatId,
        });

        // Native Desktop Browser Notification (if permission granted and user is not in this chat)
        if (activeChat?.id !== newMsg.chatId && 'Notification' in window && Notification.permission === 'granted') {
          new Notification(`Message from ${senderName}`, {
            body: previewText,
            icon: '/favicon.ico',
          });
        }
      }

      // If the message belongs to the currently visible chat, mark-as-read and run the scroll heuristic.
      if (activeChat && newMsg.chatId === activeChat.id) {
        markChatRead(activeChat.id);
        if (!newMsg.fromMe) onMessageAppended('incoming');
      }

      // Update sidebar chat list. The refetch is REPORTED by the reducer and fired below, never from
      // inside the updater: React double-invokes updaters under StrictMode, so a side effect in there
      // ran twice for every message arriving in a chat the sidebar does not have.
      let needsSidebarRefetch = false;
      setChats(prevChats => {
        const result = applyIncomingToChatList(prevChats, newMsg, {
          activeChatId: activeChat?.id,
          // A location message's body is the (multi-KB) base64 map thumbnail; show a label instead.
          locationLabel: `📍 ${t('chats.media.location')}`,
        });
        needsSidebarRefetch = result.needsSidebarRefetch;
        return result.chats;
      });
      if (needsSidebarRefetch) {
        void loadChats(selectedSessionId);
      }
    },
    [selectedSessionId, activeChat, loadChats, markChatRead, appendMessage, onMessageAppended, t],
  );

  const handleIncomingMessageAck = useCallback(
    (event: { sessionId: string; messageId: string; status: ChatMessageView['status'] }) => {
      if (event.sessionId !== selectedSessionId) return;

      // Acks can arrive for any cached chat under this session. Walk every cache entry under
      // ['messages', event.sessionId, *] and apply the forward-only delivery merge in place.
      const caches = queryClient.getQueriesData<ChatMessageView[]>({
        queryKey: ['messages', event.sessionId],
      });
      for (const [key, list] of caches) {
        if (!list) continue;
        const idx = list.findIndex(m => m.id === event.messageId || m.waMessageId === event.messageId);
        if (idx === -1) continue;
        const target = list[idx];
        // Backend now sends the neutral delivery status directly (no engine-specific ack codes).
        // Merge forward-only so an out-of-order/replayed lower ack can't downgrade the tick.
        const nextStatus = mergeDeliveryStatus(target.status, event.status) ?? target.status;
        const next = list.slice();
        next[idx] = { ...target, status: nextStatus };
        queryClient.setQueryData(key, next);
      }
    },
    [selectedSessionId, queryClient],
  );

  const handleIncomingMessageReaction = useCallback(
    (event: { sessionId: string; messageId: string; reactions?: Record<string, string> }) => {
      if (event.sessionId !== selectedSessionId) return;

      // Reactions update `metadata.reactions` while preserving `metadata.media` / `metadata.quotedMessage`,
      // so we must read the prior message and deep-merge — `updateMessage`'s shallow merge would clobber
      // the rest of metadata.
      //
      // The absent-vs-empty distinction on `reactions` is mergeReactionSnapshot's job; it is a named
      // function so the behaviour is covered by a test, because nothing here is.
      const caches = queryClient.getQueriesData<ChatMessageView[]>({
        queryKey: ['messages', event.sessionId],
      });
      for (const [key, list] of caches) {
        if (!list) continue;
        const idx = list.findIndex(m => m.id === event.messageId || m.waMessageId === event.messageId);
        if (idx === -1) continue;
        const target = list[idx];
        const next = list.slice();
        next[idx] = {
          ...target,
          metadata: {
            ...(target.metadata || {}),
            reactions: mergeReactionSnapshot(target.metadata?.reactions, event.reactions),
          },
        };
        queryClient.setQueryData(key, next);
      }
    },
    [selectedSessionId, queryClient],
  );

  const handleIncomingMessageRevoked = useCallback(
    (event: { sessionId: string; id: string; revokedId?: string; type: string }) => {
      if (event.sessionId !== selectedSessionId) return;

      // Walk every cached chat under this session, find the deleted message and zero it — the
      // backend emits an empty body; the localized "deleted" label is rendered below. Matching is
      // in findRevokedIndex: the event carries two candidate ids and wwebjs's `id` alone can miss.
      const caches = queryClient.getQueriesData<ChatMessageView[]>({
        queryKey: ['messages', event.sessionId],
      });
      for (const [key, list] of caches) {
        if (!list) continue;
        const idx = findRevokedIndex(list, event);
        if (idx === -1) continue;
        const target = list[idx];
        const next = list.slice();
        next[idx] = { ...target, body: '', type: asMessageType(event.type) };
        queryClient.setQueryData(key, next);
      }
    },
    [selectedSessionId, queryClient],
  );

  const handleIncomingMessageEdited = useCallback(
    (event: { sessionId: string; messageId: string; chatId: string; body: string }) => {
      if (event.sessionId !== selectedSessionId) return;

      const caches = queryClient.getQueriesData<ChatMessageView[]>({
        queryKey: ['messages', event.sessionId],
      });
      let matchedCachedMessage = false;
      let editedLastMessage = false;
      for (const [key, list] of caches) {
        if (!list) continue;
        const next = applyMessageEdit(list, event);
        if (next === list) continue;
        matchedCachedMessage = true;
        queryClient.setQueryData(key, next);

        // Message caches are chronological; only editing the final row changes the sidebar preview.
        // Confirm the cache belongs to the event chat before touching that summary.
        const cachedChatId = Array.isArray(key) && typeof key[2] === 'string' ? key[2] : undefined;
        const editedIndex = list.findIndex(m => m.id === event.messageId || m.waMessageId === event.messageId);
        if (cachedChatId === event.chatId && editedIndex === list.length - 1) editedLastMessage = true;
      }
      if (editedLastMessage) {
        setChats(previous =>
          previous.map(chat => (chat.id === event.chatId ? { ...chat, lastMessage: event.body } : chat)),
        );
      } else if (!matchedCachedMessage) {
        // The chat may never have been opened, so there is no message cache from which to prove
        // whether this was its latest row. Refresh summaries instead of guessing and overwriting the
        // sidebar with the body of an older edited message.
        void loadChats(selectedSessionId);
      }
    },
    [selectedSessionId, queryClient, loadChats],
  );

  // A contact's new story lands here instead of in the message pipeline; invalidate the statuses
  // query so the Status tab refetches live. A disabled query (another tab active) just goes stale
  // and refetches on open — no background fetch either way.
  const handleStatusReceived = useCallback(
    (event: { sessionId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-statuses', event.sessionId] });
    },
    [queryClient],
  );

  const handleSessionStatusReceived = useCallback(
    () => {
      void loadSessions();
    },
    [loadSessions],
  );

  // The events object must be referentially stable: useWebSocket re-registers its socket handler
  // on every identity change, so an inline literal would tear down and re-attach per render.
  const wsEvents = useMemo(
    () => ({
      onMessage: handleIncomingMessage,
      onMessageAck: handleIncomingMessageAck,
      onMessageReaction: handleIncomingMessageReaction,
      onMessageRevoked: handleIncomingMessageRevoked,
      onMessageEdited: handleIncomingMessageEdited,
      onStatusReceived: handleStatusReceived,
      onSessionStatus: handleSessionStatusReceived,
    }),
    [
      handleIncomingMessage,
      handleIncomingMessageAck,
      handleIncomingMessageReaction,
      handleIncomingMessageRevoked,
      handleIncomingMessageEdited,
      handleStatusReceived,
      handleSessionStatusReceived,
    ],
  );
  const { isConnected, connectionFailed, reconnect, subscribe, unsubscribe } = useWebSocket(wsEvents);

  // A transient WebSocket gap means message.received/ack/revoke events were missed, and the chat
  // cache uses staleTime: Infinity so it won't refetch on its own. On a reconnect (isConnected
  // false→true after a prior connect), invalidate the active session's messages so the thread the
  // gap left stale refreshes. The transition logic is unit-tested in utils/reconnectState.
  const reconnectHadConnected = useRef(false);
  const reconnectWasDisconnected = useRef(false);
  useEffect(() => {
    const decision = nextReconnectState({
      isConnected,
      hadConnected: reconnectHadConnected.current,
      wasDisconnected: reconnectWasDisconnected.current,
    });
    reconnectHadConnected.current = decision.hadConnected;
    reconnectWasDisconnected.current = decision.wasDisconnected;
    if (decision.invalidate) {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedSessionId] });
      // Statuses are live now (status.received): a story posted during the socket gap would
      // otherwise stay invisible until a focus refetch.
      queryClient.invalidateQueries({ queryKey: ['contact-statuses', selectedSessionId] });
    }
  }, [isConnected, selectedSessionId, queryClient]);

  useEffect(() => {
    if (selectedSessionId && isConnected) {
      subscribe(selectedSessionId, [
        'message.received',
        'message.sent',
        'message.ack',
        'message.reaction',
        'message.revoked',
        'message.edited',
        'status.received',
      ]);
      return () => {
        unsubscribe(selectedSessionId);
      };
    }
  }, [selectedSessionId, isConnected, subscribe, unsubscribe]);

  // 4. Message history is fetched by useChatMessages (React Query). The active-chat side effects
  // (mark-as-read + clear sidebar unread badge) live in a small effect below.

  const handleReactMessage = async (msg: ChatMessageView, emoji: string) => {
    if (!selectedSessionId || !activeChat) return;

    const msgId = msg.waMessageId || msg.id;
    const currentReactions = msg.metadata?.reactions || {};
    const sessionPhone = sessions.find(s => s.id === selectedSessionId)?.phone || 'me';

    let alreadyReacted = false;
    for (const [sender, emo] of Object.entries(currentReactions)) {
      if ((sender === 'me' || sender.includes(sessionPhone)) && emo === emoji) {
        alreadyReacted = true;
        break;
      }
    }

    const emojiToSend = alreadyReacted ? '' : emoji;

    try {
      await messageApi.react(selectedSessionId, {
        chatId: activeChat.id,
        messageId: msgId,
        emoji: emojiToSend,
      });

      // Deep-merge metadata.reactions so existing media / quotedMessage on metadata survive.
      const key = messagesQueryKey(selectedSessionId, activeChat.id);
      queryClient.setQueryData<ChatMessageView[]>(key, (old = []) =>
        old.map(m => {
          if (m.id === msg.id || m.waMessageId === msg.id) {
            const metadata = m.metadata || {};
            const reactions = { ...(metadata.reactions || {}) };
            if (emojiToSend === '') {
              delete reactions['me'];
            } else {
              reactions['me'] = emojiToSend;
            }
            return { ...m, metadata: { ...metadata, reactions } };
          }
          return m;
        }),
      );
    } catch (err) {
      showErrorToast(t('chats.errors.react'), err instanceof Error ? err.message : undefined);
    }
  };

  const handleDeleteMessage = async (msg: ChatMessageView) => {
    if (!selectedSessionId || !activeChat) return;
    const msgId = msg.waMessageId || msg.id;

    if (!window.confirm(t('chats.deleteConfirm'))) return;

    try {
      await messageApi.delete(selectedSessionId, {
        chatId: activeChat.id,
        messageId: msgId,
        forEveryone: true,
      });

      updateMessage(selectedSessionId, activeChat.id, msg.id, { body: '', type: 'revoked' });
    } catch (err) {
      showErrorToast(t('chats.errors.delete'), err instanceof Error ? err.message : undefined);
    }
  };

  // Side effects when the active chat changes: mark-as-read on the gateway + clear sidebar unread badge.
  // The message-history fetch is driven by useChatMessages; scroll restoration is driven by
  // useChatScrollPosition (both keyed off activeChat?.id). Deliberately keying off `activeChat?.id`
  // (not the whole object) so a sidebar reshuffle that mutates the activeChat instance doesn't re-fire
  // the mark-as-read RPC for the same chat.
  useEffect(() => {
    if (!activeChat) return;
    markChatRead(activeChat.id);
    setChats(prev => prev.map(c => (c.id === activeChat.id ? { ...c, unreadCount: 0 } : c)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat?.id, markChatRead]);



  // Helper formats
  const formatChatTime = useCallback(
    (timestamp?: number) => {
      if (!timestamp) return '';
      const date = new Date(timestamp * 1000);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return t('chats.yesterday');
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    },
    [t],
  );

  // Archive/unarchive handler with optimistic local state updates.
  const handleArchiveChat = useCallback(
    async (chatToArchive: Chat, archive: boolean) => {
      if (!selectedSessionId) return;

      // Optimistic local state update
      setChats(prevChats =>
        prevChats.map(c => (c.id === chatToArchive.id ? { ...c, archived: archive } : c)),
      );
      if (activeChat?.id === chatToArchive.id) {
        setActiveChat(prev => (prev ? { ...prev, archived: archive } : null));
      }

      try {
        await sessionApi.archiveChat(selectedSessionId, chatToArchive.id, archive);
        showSuccessToast(archive ? t('chats.archivedSuccess') : t('chats.unarchivedSuccess'));
        queryClient.invalidateQueries({ queryKey: ['chats', selectedSessionId] });
      } catch {
        // Rollback on failure
        setChats(prevChats =>
          prevChats.map(c => (c.id === chatToArchive.id ? { ...c, archived: !archive } : c)),
        );
        if (activeChat?.id === chatToArchive.id) {
          setActiveChat(prev => (prev ? { ...prev, archived: !archive } : null));
        }
        showErrorToast(archive ? t('chats.archiveFailed') : t('chats.unarchiveFailed'));
      }
    },
    [selectedSessionId, activeChat?.id, queryClient, showSuccessToast, showErrorToast, t],
  );

  // Filter conversations based on tab and search query.
  const filteredDirectChats = filterChats(chats, searchQuery);
  const filteredGroupChats = filterGroupChats(chats, searchQuery);
  const filteredArchivedChats = filterArchivedChats(chats, searchQuery);

  const currentListChats =
    activeTab === 'groups'
      ? filteredGroupChats
      : activeTab === 'archive'
        ? filteredArchivedChats
        : filteredDirectChats;

  // The channels zero-state ("not subscribed to any channels") stays keyed on the UNFILTERED list
  // below, so a non-matching search renders an empty list rather than claiming there are none.
  const filteredChannels = filterChannels(channelsQuery.data ?? [], searchQuery);
  const groupedStatuses: ContactStatusGroup[] = groupStatusesByContact(statusesQuery.data ?? [], searchQuery);

  // The open status group, derived — see the activeStatusContactId declaration.
  const activeStatusGroup = activeStatusContactId
    ? (groupedStatuses.find(g => g.contact.id === activeStatusContactId) ?? null)
    : null;

  // Same open-at-newest behavior for the status viewer pane, keyed off the active contact and its
  // item list. Declared after activeStatusGroup: the viewer follows refetches because the deps are
  // the derived group's items, not a click-time snapshot.
  const statusFeedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = statusFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeStatusGroup?.contact?.id, activeStatusGroup?.items]);

  // Image media items for the lightbox, in render order. `getMediaSrc` reconstructs a usable src
  // from either a base64 payload or a URL — the ChatMessageView shape stores both in `data`.
  const imageMedia = useMemo<LightboxItem[]>(
    () =>
      messages
        .filter(m => m.type === 'image' && Boolean(getMediaSrc(m.metadata?.media)))
        .map(m => ({
          id: m.id,
          url: getMediaSrc(m.metadata?.media),
          alt: m.body || m.metadata?.media?.filename || '',
          senderName: undefined,
          timestamp: formatChatTime(m.timestamp || Math.floor(new Date(m.createdAt).getTime() / 1000)),
        })),
    [messages, formatChatTime],
  );



  const isRoomOpen = leftPaneMode === 'chats' && Boolean(activeChat || activeChannel || activeStatusGroup);

  // Global ESC key listener to close the translucent glass full page popup
  useEffect(() => {
    if (!isRoomOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent ESC from also closing parent modals if any and close this glass popup
        e.stopPropagation();
        closeActiveRoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isRoomOpen, closeActiveRoom]);

  return (
    <div className="chats-page">

      {/* Real-time connection permanently dropped — let the user re-establish it instead of
          silently showing stale chats. */}
      {connectionFailed && (
        <div className="chats-reconnect-banner" role="alert">
          <AlertCircle size={16} />
          <span>{t('common.disconnected')}</span>
          <button className="btn-secondary" onClick={reconnect}>
            {t('common.refresh')}
          </button>
        </div>
      )}

      {isInitialSessionsLoading ? (
        <div className="chats-loading-container">
          <Loader2 className="animate-spin" size={32} />
          <p>{t('common.loading')}</p>
        </div>
      ) : (
        <div className="chats-layout">
          {/* LEFT HERO VIEW: Constant 65% left frame with fluid title/content transition */}
          <main className="chats-room">
            {/* Top View Selector Bar on Left Pane */}
            <div className="left-pane-view-toggle-bar">
              <div className="left-pane-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftPaneMode === 'sessions'}
                  className={`left-pane-tab ${leftPaneMode === 'sessions' ? 'active' : ''}`}
                  onClick={() => handleSetLeftPaneMode('sessions')}
                >
                  <Smartphone size={15} />
                  <span>{t('nav.sessions', 'Sessions')}</span>
                  {allSessions.length > 0 && <span className="tab-pill-count">{allSessions.length}</span>}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftPaneMode === 'chats'}
                  className={`left-pane-tab ${leftPaneMode === 'chats' ? 'active' : ''}`}
                  onClick={() => handleSetLeftPaneMode('chats')}
                >
                  <MessageCircle size={15} />
                  <span>{t('nav.chats', 'Chats')}</span>
                  {sessions.length > 0 && <span className="tab-pill-count">{sessions.length}</span>}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={leftPaneMode === 'lan-mesh'}
                  className={`left-pane-tab ${leftPaneMode === 'lan-mesh' ? 'active' : ''}`}
                  onClick={() => handleSetLeftPaneMode('lan-mesh')}
                >
                  <Network size={15} />
                  <span>LAN Mesh</span>
                </button>
              </div>
            </div>

            {/* Persistent Hero Body with seamless transition */}
            <div className="chats-room-placeholder">
              <div key={leftPaneMode} className="chats-hero-center hero-crossfade-enter">
                <h1 className="chats-hero-title">
                  {leftPaneMode === 'chats' ? 'Chats' : leftPaneMode === 'lan-mesh' ? 'LAN Mesh' : 'Sessions'}
                </h1>

                {leftPaneMode === 'chats' && sessions.length > 0 && (
                  <div className="chats-hero-search-container">
                    <div className="chat-search-input chats-hero-search-input">
                      <Search size={18} />
                      <input
                        type="text"
                        placeholder={t('chats.searchPlaceholder', 'Search chats...')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {leftPaneMode === 'chats' ? (
                  sessions.length > 0 ? (
                    (() => {
                      const session = sessions.find(s => s.id === selectedSessionId);
                      if (!session) return null;
                      return (
                        <div className={`sidebar-session-switcher chats-hero-session-switcher ${sessions.length === 1 ? 'single-session' : ''}`}>
                          <select
                            value={selectedSessionId}
                            onChange={e => setSelectedSessionId(e.target.value)}
                            className="sidebar-session-select"
                            aria-label={t('sessions.selectSession', 'Select Session')}
                          >
                            {sessions.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.phone || t('chats.noPhone')})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="chats-hero-empty-state">
                      <p className="chats-hero-empty-desc">
                        {t('chats.noSessionsDesc', 'No connected WhatsApp session. Please connect or start a session to use chat.')}
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleSetLeftPaneMode('sessions')}
                        style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                      >
                        <Smartphone size={16} />
                        <span>{t('sessions.title', 'Go to Sessions')}</span>
                      </button>
                    </div>
                  )
                ) : leftPaneMode === 'lan-mesh' ? (
                  <div className="chats-hero-session-pill">
                    <span className="session-status-dot" />
                    <span>
                      Decentralized P2P Mesh Network
                    </span>
                  </div>
                ) : (
                  <div className="chats-hero-session-pill">
                    <span className="session-status-dot" />
                    <span>
                      {allSessions.length} {t('sessions.title', 'Sessions')} ({sessions.length} {t('sessionStatus.ready', 'Ready')})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* RIGHT SIDEBAR: Switch between Chats sidebar and Sessions list sidebar seamlessly */}
          <div className="chats-right-pane-container">
            {leftPaneMode === 'chats' ? (
              sessions.length === 0 ? (
                <aside className="chats-sidebar">
                  <div className="chats-list-empty" style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <AlertCircle size={40} className="text-warn" style={{ marginBottom: '1rem' }} />
                    <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.0625rem', fontWeight: 600 }}>
                      {t('chats.noSessionsTitle', 'No connected sessions')}
                    </h4>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '280px', lineHeight: 1.5 }}>
                      {t('chats.noSessionsDesc', 'Please connect a WhatsApp session to start using chats.')}
                    </p>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => handleSetLeftPaneMode('sessions')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Smartphone size={14} />
                      <span>{t('sessions.newSession', 'Connect Session')}</span>
                    </button>
                  </div>
                </aside>
              ) : (
                <ChatSidebar
                  activeTab={activeTab}
                  onSwitchTab={switchTab}
                  onComposeStatus={() => setComposeOpen(true)}
                  formatChatTime={formatChatTime}
                  chatsTab={{
                    loading: loadingChats,
                    chats: currentListChats,
                    activeChatId: activeChat?.id,
                    pictures: listPics.data,
                    onSelectChat: chat => {
                      handleSetLeftPaneMode('chats');
                      setActiveChat(chat);
                    },
                    onArchiveChat: handleArchiveChat,
                  }}
                  channelsTab={{
                    engineLoading: currentEngine.isLoading,
                    supported: channelsSupported,
                    query: channelsQuery,
                    channels: filteredChannels,
                    activeChannelId: activeChannel?.id,
                    onSelectChannel: setActiveChannel,
                  }}
                  statusTab={{
                    loading: statusesQuery.isLoading,
                    error: statusesQuery.isError,
                    groups: groupedStatuses,
                    activeContactId: activeStatusContactId,
                    onSelectContact: setActiveStatusContactId,
                  }}
                />
              )
            ) : leftPaneMode === 'sessions' ? (
              <SessionsManager
                standalone={false}
                selectedSessionId={selectedSessionId}
                onSessionSelect={id => {
                  setSelectedSessionId(id);
                  handleSetLeftPaneMode('chats');
                }}
                onSessionsChange={handleSessionsChange}
              />
            ) : (
              <LanMeshTab />
            )}
          </div>
        </div>
      )}

      {/* TRANSLUCENT GLASS FULL PAGE POPUP FOR SELECTED CHATS / CHANNELS / STATUSES */}
      {isRoomOpen && (
        <div
          className="chats-glass-popup-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={
            activeChat
              ? activeChat.name || activeChat.id
              : activeChannel
                ? activeChannel.name
                : activeStatusGroup?.contact?.name || 'Status'
          }
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              closeActiveRoom();
            }
          }}
        >
          <div className="chats-glass-popup-content">
            {activeChat ? (
              <div className="room-container">
                {/* Room header */}
                <header className="room-header">
                  <button
                    className="room-back"
                    onClick={closeActiveRoom}
                    aria-label={t('common.back')}
                    title={`${t('common.back')} (ESC)`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="room-avatar">
                    {activePp.data ? (
                      <img
                        src={activePp.data}
                        alt=""
                        onError={() => activePp.refetch()}
                      />
                    ) : (
                      <KindIcon kind={activeChat.kind} />
                    )}
                  </div>
                  <div className="room-contact-info">
                    <h3>
                      <EmojiText text={activeChat.name || activeChat.id.split('@')[0]} />
                    </h3>
                    <span className="room-contact-phone">
                      {activePhoneText ??
                        (activeChat.isGroup ? t('chats.groupSubtitle') : t('chats.privateContactSubtitle'))}
                    </span>
                  </div>

                  <div className="room-header-actions">
                    <button
                      type="button"
                      className="room-archive-btn"
                      onClick={() => handleArchiveChat(activeChat, !activeChat.archived)}
                      title={activeChat.archived ? t('chats.unarchiveChat') : t('chats.archiveChat')}
                      aria-label={activeChat.archived ? t('chats.unarchiveChat') : t('chats.archiveChat')}
                    >
                      {activeChat.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                      <span>{activeChat.archived ? t('chats.unarchiveChat') : t('chats.archiveChat')}</span>
                    </button>

                    <button
                      type="button"
                      className="bubble-popout-btn"
                      onClick={() => {
                        bubbleStore.addOrUpdateBubble({
                          chatId: activeChat.id,
                          sessionId: selectedSessionId,
                          name: activeChat.name || activeChat.id.split('@')[0],
                          incrementUnread: false,
                        });
                        bubbleStore.openDrawer(activeChat.id);
                      }}
                      title="Pop into Floating Bubble"
                      aria-label="Pop into Floating Bubble"
                    >
                      <ExternalLink size={13} />
                    </button>

                    <button
                      type="button"
                      className="chats-glass-popup-close-btn"
                      onClick={closeActiveRoom}
                      title="Close (ESC)"
                      aria-label={t('common.close') || 'Close'}
                    >
                      <X size={18} />
                      <kbd className="esc-key-badge">ESC</kbd>
                    </button>
                  </div>
                </header>

                {/* Messages body */}
                <ChatThread
                  sessionId={selectedSessionId}
                  activeChat={activeChat}
                  messages={messages}
                  loadingMessages={loadingMessages}
                  messagesError={messagesError}
                  messagesContainerRef={messagesContainerRef}
                  onMediaLoad={onMediaLoad}
                  onOpenImage={messageId => {
                    const idx = imageMedia.findIndex(x => x.id === messageId);
                    if (idx >= 0) setLightboxIndex(idx);
                  }}
                  onReply={setReplyingTo}
                  onReact={handleReactMessage}
                  onDelete={handleDeleteMessage}
                />

                {/* Composer */}
                <ChatComposer
                  selectedSessionId={selectedSessionId}
                  activeChat={activeChat}
                  replyingTo={replyingTo}
                  setReplyingTo={setReplyingTo}
                  onMessageAppended={onMessageAppended}
                  setChats={setChats}
                  messageInput={messageInput}
                  setMessageInput={setMessageInput}
                  attachment={attachment}
                  setAttachment={setAttachment}
                  previewUrl={previewUrl}
                  setPreviewUrl={setPreviewUrl}
                />
              </div>
            ) : activeChannel ? (
              <div key={activeChannel.id} className="channel-room">
                <header className="chats-room-header">
                  <button
                    className="room-back"
                    onClick={closeActiveRoom}
                    aria-label={t('common.back')}
                    title={`${t('common.back')} (ESC)`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <Megaphone size={20} />
                  <h2>{activeChannel.name}</h2>
                  <button
                    type="button"
                    className="chats-glass-popup-close-btn"
                    style={{ marginLeft: 'auto' }}
                    onClick={closeActiveRoom}
                    title="Close (ESC)"
                    aria-label={t('common.close') || 'Close'}
                  >
                    <X size={18} />
                    <kbd className="esc-key-badge">ESC</kbd>
                  </button>
                </header>
                <div className="messages-list" ref={channelFeedRef}>
                  {channelMessages.isLoading ? (
                    <div className="messages-loading">
                      <Loader2 className="animate-spin" size={32} />
                      <span>{t('chats.loadingMessages')}</span>
                    </div>
                  ) : channelMessages.error ? (
                    <div className="messages-empty">
                      <MessageSquare size={32} />
                      <span>{t('chats.loadMessagesError')}</span>
                    </div>
                  ) : (channelMessages.data ?? []).length === 0 ? (
                    <div className="messages-empty">
                      <MessageSquare size={32} />
                      <span>{t('chats.noMessagesInChat')}</span>
                    </div>
                  ) : (
                    (channelMessages.data ?? []).map(m => (
                      <div key={m.id} className="message-bubble incoming">
                        {m.hasMedia && m.mediaUrl && <img className="channel-media" src={m.mediaUrl} alt="" />}
                        {m.body && <MessageBody text={m.body} className="message-text" />}
                        <span className="message-time">{formatChatTime(m.timestamp)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : activeStatusGroup ? (
              <div key={activeStatusGroup.contact.id} className="channel-room">
                <header className="chats-room-header">
                  <button
                    className="room-back"
                    onClick={closeActiveRoom}
                    aria-label={t('common.back')}
                    title={`${t('common.back')} (ESC)`}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <CircleDashed size={20} />
                  <h2>
                    {activeStatusGroup.contact.name ??
                      activeStatusGroup.contact.pushName ??
                      activeStatusGroup.contact.id}
                  </h2>
                  <button
                    type="button"
                    className="chats-glass-popup-close-btn"
                    style={{ marginLeft: 'auto' }}
                    onClick={closeActiveRoom}
                    title="Close (ESC)"
                    aria-label={t('common.close') || 'Close'}
                  >
                    <X size={18} />
                    <kbd className="esc-key-badge">ESC</kbd>
                  </button>
                </header>
                <div className="messages-list" ref={statusFeedRef}>
                  {(activeStatusGroup?.items || []).map(item => (
                    <div
                      key={item.id}
                      className="message-bubble incoming"
                      style={
                        item.type === 'text' && (item.backgroundColor || item.font)
                          ? {
                              ...(item.backgroundColor ? { backgroundColor: item.backgroundColor, color: '#fff' } : {}),
                              ...statusFontStyle(item.font),
                            }
                          : undefined
                      }
                    >
                      {item.mediaUrl && (
                        <StatusMedia
                          sessionId={selectedSessionId || null}
                          statusId={item.id}
                          type={item.type === 'video' ? 'video' : item.type === 'voice' ? 'audio' : 'image'}
                        />
                      )}
                      {item.caption && <MessageBody text={item.caption} className="message-text" />}
                      <span className="message-time">
                        {formatChatTime(Math.floor(new Date(item.timestamp).getTime() / 1000))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {lightboxIndex !== null && (
        <Suspense fallback={null}>
          <MediaLightbox
            items={imageMedia}
            index={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        </Suspense>
      )}

      {composeOpen && (
        <Suspense fallback={null}>
          <StatusComposeModal
            sessionId={selectedSessionId}
            onClose={() => setComposeOpen(false)}
            onPosted={() => statusesQuery.refetch()}
          />
        </Suspense>
      )}
    </div>
  );
}
