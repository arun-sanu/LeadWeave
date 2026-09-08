import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Send,
  ExternalLink,
  Minimize2,
  MessageSquare,
  Paperclip,
  Image as ImageIcon,
  Music,
  Video,
  File as FileIcon,
  Trash2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  Calendar,
} from 'lucide-react';
import { useBubbleStore, bubbleStore, type ChatBubble, type LivelyAlert } from './useBubbleStore';
import { sessionApi, messageApi, type ChatMessage, type Session, type Chat } from '../../services/api';
import { ChatReminderModal } from '../chats/ChatReminderModal';
import { formatPhoneForDisplay } from '../../utils/formatPhone';
import './FloatingBubbleContainer.css';

function getBubbleDisplayName(chatId: string, name?: string): string {
  if (!name) return formatPhoneForDisplay(chatId) || chatId.split('@')[0];
  if (!/^\+?\d+$/.test(name.replace(/[\s()\-]/g, '')) && !name.includes('@')) {
    return name;
  }
  return formatPhoneForDisplay(name) || formatPhoneForDisplay(chatId) || name;
}

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

        for (const sess of activeSessions) {
          try {
            const chats = await sessionApi.getChats(sess.id);
            if (!isMounted) return;
            if (Array.isArray(chats)) {
              chats.forEach((chat) => {
                const displayName =
                  chat.name && !/^\+?\d+$/.test(chat.name.replace(/[\s()\-]/g, '')) && !chat.name.includes('@')
                    ? chat.name
                    : (formatPhoneForDisplay(chat.name || chat.id) || chat.name || chat.id.split('@')[0]);

                bubbleStore.addOrUpdateBubble({
                  chatId: chat.id,
                  sessionId: sess.id,
                  name: displayName,
                  unreadCount: chat.unreadCount || 0,
                  lastMessage: chat.lastMessage || '',
                });
              });
            }
          } catch (e) {
            console.warn(`[FloatingBubbleContainer] Failed to fetch chats for session ${sess.id}:`, e);
          }
        }
      } catch (err) {
        console.error('[FloatingBubbleContainer] Failed to fetch sessions:', err);
      }
    };

    void fetchActiveSessionsAndChats();
    const interval = setInterval(fetchActiveSessionsAndChats, 15000);

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
        pointerEvents: 'auto',
      }}
    >
      {sessions.map((session) => (
        <SessionDock key={session.id} session={session} />
      ))}
    </div>
  );
}

function SessionDock({ session }: { session: Session }) {
  const store = useBubbleStore();
  const sessionBubbles = store.bubbles.filter((b) => b.sessionId === session.id);
  const activeBubble = sessionBubbles.find((b) => b.isOpen);
  const isDockExpanded = !!store.expandedDocks[session.id];
  const navigate = useNavigate();

  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  // Global ESC key listener to close active drawer or collapse bubbles dock
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeBubble || isNewChatOpen) {
          bubbleStore.closeDrawer();
          setIsNewChatOpen(false);
        } else if (isDockExpanded) {
          bubbleStore.setDockExpanded(session.id, false);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeBubble, isNewChatOpen, isDockExpanded, session.id]);

  const totalUnread = sessionBubbles.reduce((sum, b) => sum + (b.unreadCount || 0), 0);
  const livelyAlert = store.livelyAlert?.sessionId === session.id ? store.livelyAlert : null;

  const handlePillClick = () => {
    if (activeBubble || isNewChatOpen) {
      bubbleStore.closeDrawer();
      setIsNewChatOpen(false);
      return;
    }
    bubbleStore.toggleDock(session.id);
  };

  const maxVisibleBubbles = 4;
  const showOverflow = sessionBubbles.length > maxVisibleBubbles;
  const visibleBubbles = showOverflow ? sessionBubbles.slice(0, maxVisibleBubbles) : sessionBubbles;
  const overflowCount = showOverflow ? sessionBubbles.length - maxVisibleBubbles : 0;

  return (
    <div className="floating-bubble-dock">
      {/* Session Pill */}
      <button
        type="button"
        className={`floating-chats-pill ${isDockExpanded ? 'expanded' : ''} ${activeBubble ? 'active' : ''}`}
        onClick={handlePillClick}
        title={isDockExpanded ? 'Stack Bubbles inside Pill' : `Pop Up Chat Dock`}
        aria-label={`Toggle WhatsApp Chat Bubbles for ${session.name}`}
      >
        <span className="pill-status-dot" title="Real-Time Connected" />

        {!isDockExpanded && sessionBubbles.length > 0 ? (
          <div className="pill-stacked-avatars" aria-hidden="true">
            {visibleBubbles.slice(0, 3).map((b, i) => (
              <div
                key={b.chatId}
                className="pill-mini-avatar"
                style={{ zIndex: 3 - i, transform: `translateX(-${i * 6}px)` }}
              >
                {b.avatarUrl ? (
                  <img src={b.avatarUrl} alt="" />
                ) : (
                  <span>{(b.name || b.chatId).substring(0, 1).toUpperCase()}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MessageCircle size={18} className="pill-icon" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>{session.name}</span>
          </div>
        )}

        {totalUnread > 0 && (
          <span className="pill-unread-badge">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}

        {sessionBubbles.length > 0 && (
          <span className="pill-toggle-indicator">
            {isDockExpanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </span>
        )}
      </button>

      {isDockExpanded && (
        <div className="bubble-stack-container">
          {/* New Chat Button */}
          <div 
            className={`floating-bubble-item ${isNewChatOpen ? 'active' : ''}`}
            onClick={() => {
              setIsNewChatOpen(!isNewChatOpen);
              bubbleStore.closeDrawer();
            }}
            title="New Message"
          >
            <span className="floating-bubble-initials"><Plus size={20} /></span>
          </div>

          {showOverflow && (
            <div 
              className="floating-bubble-item overflow-bubble"
              onClick={() => {
                bubbleStore.closeDrawer();
                navigate(`/chats?session=${session.id}`);
              }}
              title={`View ${overflowCount} more active chats`}
              style={{ background: 'rgba(255,255,255,0.1)' }}
            >
              <span className="floating-bubble-initials" style={{ color: '#fff' }}>+{overflowCount}</span>
            </div>
          )}

          {visibleBubbles.map((bubble, index) => (
            <BubbleItem
              key={bubble.chatId}
              bubble={bubble}
              index={index}
            />
          ))}
        </div>
      )}

      {livelyAlert && !activeBubble && (
        <LivelyMessagePopup alert={livelyAlert} />
      )}

      {activeBubble && !isNewChatOpen && <FloatingChatDrawer bubble={activeBubble} navigate={navigate} />}

      {isNewChatOpen && (
        <FloatingNewChatDrawer 
          sessionId={session.id}
          onClose={() => setIsNewChatOpen(false)}
          onChatStarted={(chatId, name, text, msg) => {
            setIsNewChatOpen(false);
            bubbleStore.addOrUpdateBubble({
              chatId,
              sessionId: session.id,
              name,
              lastMessage: text,
              lastMessageObject: msg,
            });
            bubbleStore.setDockExpanded(session.id, true);
            bubbleStore.openDrawer(chatId);
          }}
        />
      )}
    </div>
  );
}

function LivelyMessagePopup({ alert }: { alert: LivelyAlert }) {
  const displayName = getBubbleDisplayName(alert.chatId, alert.name);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  const handleClick = () => {
    bubbleStore.setDockExpanded(alert.sessionId, true);
    bubbleStore.openDrawer(alert.chatId);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    bubbleStore.dismissLivelyAlert();
  };

  return (
    <div className="lively-message-popup" onClick={handleClick} role="alert">
      <div className="lively-popup-avatar">
        {alert.avatarUrl ? (
          <img src={alert.avatarUrl} alt={displayName} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="lively-popup-content">
        <div className="lively-popup-header">
          <span className="lively-popup-sender">{displayName}</span>
          <button
            type="button"
            className="lively-popup-close"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
          >
            <X size={12} />
          </button>
        </div>
        <p className="lively-popup-snippet">{alert.text}</p>
      </div>
    </div>
  );
}

function BubbleItem({ bubble, index }: { bubble: ChatBubble; index: number }) {
  const displayName = getBubbleDisplayName(bubble.chatId, bubble.name);
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  return (
    <div
      className={`floating-bubble-item ${bubble.isOpen ? 'active' : ''}`}
      style={{ '--bubble-index': index } as React.CSSProperties}
      onClick={() => bubbleStore.toggleBubbleOpen(bubble.chatId)}
      title={`${displayName}${bubble.lastMessage ? `: ${bubble.lastMessage}` : ''}`}
    >
      <button
        type="button"
        className="floating-bubble-close-btn"
        onClick={(e) => {
          e.stopPropagation();
          bubbleStore.removeBubble(bubble.chatId);
        }}
        title="Close Bubble"
      >
        <X size={12} />
      </button>

      {bubble.avatarUrl ? (
        <img src={bubble.avatarUrl} alt={displayName} className="floating-bubble-avatar" />
      ) : (
        <span className="floating-bubble-initials">{initials}</span>
      )}

      {bubble.unreadCount > 0 && (
        <span className="floating-bubble-badge">{bubble.unreadCount}</span>
      )}
    </div>
  );
}

function FloatingChatDrawer({
  bubble,
  navigate,
}: {
  bubble: ChatBubble;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial message history
  useEffect(() => {
    let isMounted = true;
    async function loadMessages() {
      try {
        const res = await sessionApi.getChatMessages(bubble.sessionId, bubble.chatId, 25);
        if (isMounted && res && Array.isArray(res.messages)) {
          setMessages([...res.messages].reverse());
        }
      } catch (err) {
        console.warn('Failed to load bubble messages', err);
      }
    }
    void loadMessages();
    return () => {
      isMounted = false;
    };
  }, [bubble.sessionId, bubble.chatId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time sync for new messages while drawer is open
  useEffect(() => {
    if (bubble.lastMessageObject) {
      setMessages((prev) => {
        if (
          prev.some(
            (m) =>
              m.id === bubble.lastMessageObject?.id ||
              (bubble.lastMessageObject?.waMessageId && m.waMessageId === bubble.lastMessageObject.waMessageId)
          )
        ) {
          return prev;
        }
        return [...prev, bubble.lastMessageObject!];
      });
    }
  }, [bubble.lastMessageObject]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const messageTemplates = [
    { id: 1, title: 'Greeting', text: 'Hello! How can I help you today?' },
    { id: 2, title: 'Follow-up', text: 'Just checking in to see if you have any questions.' },
    { id: 3, title: 'Thank you', text: 'Thank you for your business. Let us know if you need anything else.' },
    { id: 4, title: 'Out of Office', text: 'I am currently out of the office and will reply as soon as possible.' },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachment(e.target.files[0]);
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTemplateClick = (text: string) => {
    setInputText((prev) => (prev ? prev + '\n' + text : text));
    setShowTemplatePicker(false);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !attachment) || sending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);
    setShowTemplatePicker(false);

    try {
      if (attachment) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(attachment);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        const mimetype = attachment.type;
        const filename = attachment.name;
        const b64Data = base64.split(',')[1];

        let res;
        if (mimetype.startsWith('image/')) {
          res = await messageApi.sendMedia(bubble.sessionId, bubble.chatId, 'image', {
            base64: b64Data,
            mimetype,
            filename,
            caption: textToSend,
          });
        } else if (mimetype.startsWith('video/')) {
          res = await messageApi.sendMedia(bubble.sessionId, bubble.chatId, 'video', {
            base64: b64Data,
            mimetype,
            filename,
            caption: textToSend,
          });
        } else if (mimetype.startsWith('audio/')) {
          res = await messageApi.sendMedia(bubble.sessionId, bubble.chatId, 'audio', {
            base64: b64Data,
            mimetype,
            filename,
          });
        } else {
          res = await messageApi.sendMedia(bubble.sessionId, bubble.chatId, 'document', {
            base64: b64Data,
            mimetype,
            filename,
            caption: textToSend,
          });
        }

        if (res) {
          const newMsg: ChatMessage = {
            id: res.messageId || `temp-${Date.now()}`,
            waMessageId: res.messageId || `temp-${Date.now()}`,
            chatId: bubble.chatId,
            direction: 'outgoing',
            body: textToSend,
            type: (mimetype.split('/')[0] as ChatMessage['type']) || 'document',
            timestamp: res.timestamp || Math.floor(Date.now() / 1000),
            createdAt: new Date().toISOString(),
            status: 'sent',
            from: 'me',
            to: bubble.chatId,
            metadata: {
              media: { mimetype, filename, data: b64Data },
            },
          };
          setMessages((prev) => [...prev, newMsg]);
        }
        clearAttachment();
      } else {
        // Text only
        const res = await messageApi.sendText(bubble.sessionId, bubble.chatId, textToSend);

        if (res) {
          const newMsg: ChatMessage = {
            id: res.messageId || `temp-${Date.now()}`,
            waMessageId: res.messageId || `temp-${Date.now()}`,
            chatId: bubble.chatId,
            direction: 'outgoing',
            body: textToSend,
            type: 'text',
            timestamp: res.timestamp || Math.floor(Date.now() / 1000),
            createdAt: new Date().toISOString(),
            status: 'sent',
            from: 'me',
            to: bubble.chatId,
          };
          setMessages((prev) => [...prev, newMsg]);
        }
      }
    } catch (err) {
      console.error('Failed to send message from bubble', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleOpenFullChat = () => {
    bubbleStore.closeDrawer();
    navigate(`/chats?session=${bubble.sessionId}&chat=${bubble.chatId}`);
  };

  const activeChatObj: Chat = {
    id: bubble.chatId,
    name: bubble.name || bubble.chatId.split('@')[0],
    timestamp: Math.floor(Date.now() / 1000),
    unreadCount: 0,
    isGroup: bubble.chatId.endsWith('@g.us'),
    kind: bubble.chatId.endsWith('@g.us') ? 'group' : 'individual',
  };

  return (
    <div className="floating-chat-drawer">
      {/* Header */}
      <div className="floating-drawer-header">
        <div className="floating-drawer-contact">
          <div>
            <h4 className="floating-drawer-name">{getBubbleDisplayName(bubble.chatId, bubble.name)}</h4>
          </div>
        </div>

        <div className="floating-drawer-actions">
          <button
            type="button"
            className="floating-drawer-icon-btn"
            onClick={handleOpenFullChat}
            title="Open in Full Chat"
          >
            <ExternalLink size={15} />
          </button>
          <button
            type="button"
            className="floating-drawer-icon-btn"
            onClick={() => bubbleStore.closeDrawer()}
            title="Minimize"
          >
            <Minimize2 size={15} />
          </button>
        </div>
      </div>

      {/* Messages Thread Body */}
      <div className="floating-drawer-messages">
        {messages.length === 0 ? (
          <div className="floating-drawer-empty">
            <MessageSquare size={32} style={{ opacity: 0.35, marginBottom: '8px' }} />
            <p style={{ fontSize: '13px', margin: 0 }}>No recent messages</p>
          </div>
        ) : (
          messages.map((msg) => {
            const hasMedia = msg.metadata?.media && msg.metadata.media.data;
            const mediaSrc = hasMedia
              ? `data:${msg.metadata!.media!.mimetype};base64,${msg.metadata!.media!.data}`
              : undefined;
            const isImage = msg.metadata?.media?.mimetype?.startsWith('image/');
            const isAudio = msg.metadata?.media?.mimetype?.startsWith('audio/');
            const isVideo = msg.metadata?.media?.mimetype?.startsWith('video/');

            return (
              <div
                key={msg.id}
                className={`floating-msg-bubble ${msg.direction === 'outgoing' ? 'outgoing' : 'incoming'}`}
              >
                {hasMedia && (
                  <div className="floating-msg-media">
                    {isImage && <img src={mediaSrc} alt="media" className="floating-img-preview" />}
                    {isVideo && <video src={mediaSrc} controls className="floating-video-preview" />}
                    {isAudio && <audio src={mediaSrc} controls className="floating-audio-preview" />}
                    {!isImage && !isVideo && !isAudio && (
                      <div className="floating-file-preview">
                        <FileIcon size={16} /> <span>{msg.metadata!.media!.filename || 'Document'}</span>
                      </div>
                    )}
                  </div>
                )}
                {msg.body && <div className="floating-msg-body">{msg.body}</div>}
                <div className="floating-msg-time">
                  {new Date((msg.timestamp || Math.floor(Date.now() / 1000)) * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Input Box */}
      <div className="floating-drawer-composer-container">
        {/* Templates Picker Dropdown */}
        {showTemplatePicker && (
          <div className="floating-drawer-template-picker">
            <div className="floating-template-header">
              <span>Quick Templates</span>
              <button
                type="button"
                onClick={() => setShowTemplatePicker(false)}
                className="floating-template-close-btn"
              >
                <X size={14} />
              </button>
            </div>
            <div className="floating-template-list">
              {messageTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="floating-template-item"
                  onClick={() => handleTemplateClick(template.text)}
                >
                  <div className="floating-template-title">{template.title}</div>
                  <div className="floating-template-text">{template.text}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {attachment && (
          <div className="floating-attachment-preview">
            <div className="attachment-info">
              {attachment.type.startsWith('image/') ? (
                <ImageIcon size={14} />
              ) : attachment.type.startsWith('video/') ? (
                <Video size={14} />
              ) : attachment.type.startsWith('audio/') ? (
                <Music size={14} />
              ) : (
                <FileIcon size={14} />
              )}
              <span className="attachment-name">{attachment.name}</span>
            </div>
            <button type="button" className="remove-attachment-btn" onClick={clearAttachment}>
              <Trash2 size={14} />
            </button>
          </div>
        )}
        <div className="floating-drawer-composer">
          <button
            type="button"
            className="floating-drawer-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`floating-drawer-attach-btn ${showTemplatePicker ? 'active' : ''}`}
            onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            title="Message Templates"
          >
            <FileText size={16} />
          </button>

          <button
            type="button"
            className="floating-drawer-attach-btn"
            onClick={() => setShowReminderModal(true)}
            title="Add Reminder / Follow-up"
          >
            <Calendar size={16} />
          </button>

          <input
            type="text"
            className="floating-drawer-input"
            placeholder={attachment ? 'Add a caption...' : 'Type a message...'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="floating-drawer-send-btn"
            onClick={() => void handleSend()}
            disabled={(!inputText.trim() && !attachment) || sending}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Calendar Reminder Modal */}
      {showReminderModal && (
        <ChatReminderModal
          open={showReminderModal}
          onClose={() => setShowReminderModal(false)}
          activeChat={activeChatObj}
        />
      )}
    </div>
  );
}

function FloatingNewChatDrawer({
  sessionId,
  onClose,
  onChatStarted,
}: {
  sessionId: string;
  onClose: () => void;
  onChatStarted: (chatId: string, name: string, text: string, msg: ChatMessage) => void;
}) {
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phone.trim() || !text.trim() || sending) return;
    setSending(true);
    try {
      const cleaned = phone.replace(/\D/g, '');
      const chatId = `${cleaned}@s.whatsapp.net`;
      
      const res = await messageApi.sendText(sessionId, chatId, text.trim());
      if (res) {
        const newMsg: ChatMessage = {
          id: res.messageId || `temp-${Date.now()}`,
          waMessageId: res.messageId || `temp-${Date.now()}`,
          chatId: chatId,
          direction: 'outgoing',
          body: text.trim(),
          type: 'text',
          timestamp: res.timestamp || Math.floor(Date.now() / 1000),
          createdAt: new Date().toISOString(),
          status: 'sent',
          from: 'me',
          to: chatId,
        };
        onChatStarted(chatId, phone.trim(), text.trim(), newMsg);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="floating-chat-drawer">
      <div className="floating-drawer-header">
        <div className="floating-drawer-contact">
          <h4 className="floating-drawer-name">New Message</h4>
        </div>
        <div className="floating-drawer-actions">
          <button type="button" className="floating-drawer-icon-btn" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>
      </div>
      
      <div className="floating-drawer-messages" style={{ padding: '20px', gap: '12px' }}>
        
        <div>
          <label style={{ fontSize: '12px', color: '#9da3b4', marginBottom: '4px', display: 'block' }}>To (WhatsApp Number)</label>
          <input
            type="text"
            className="floating-drawer-input"
            style={{ width: '100%' }}
            placeholder="e.g. 1234567890"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p style={{ fontSize: '11px', color: '#606778', marginTop: '6px' }}>Include country code, no + or spaces.</p>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <label style={{ fontSize: '12px', color: '#9da3b4', marginBottom: '4px', display: 'block' }}>Message</label>
          <textarea
            className="floating-drawer-input"
            style={{ width: '100%', flex: 1, resize: 'none', padding: '10px' }}
            placeholder="Type your message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        
        <button
          className="floating-drawer-send-btn"
          style={{ width: '100%', borderRadius: '12px', height: '40px', marginTop: '10px' }}
          onClick={() => void handleSend()}
          disabled={!phone.trim() || !text.trim() || sending}
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}
