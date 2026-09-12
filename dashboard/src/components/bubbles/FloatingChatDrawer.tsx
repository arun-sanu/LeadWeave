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
  FileText,
  Calendar,
} from 'lucide-react';
import { bubbleStore, type ChatBubble } from './useBubbleStore';
import { sessionApi, messageApi, type ChatMessage, type Chat } from '../../services/api';
import { ChatReminderModal } from '../chats/ChatReminderModal';
import { getBubbleDisplayName } from './bubbleUtils';

export function FloatingChatDrawer({
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
      setMessages(prev => {
        if (
          prev.some(
            m =>
              m.id === bubble.lastMessageObject?.id ||
              (bubble.lastMessageObject?.waMessageId && m.waMessageId === bubble.lastMessageObject.waMessageId),
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
    setInputText(prev => (prev ? prev + '\n' + text : text));
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
          setMessages(prev => [...prev, newMsg]);
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
          setMessages(prev => [...prev, newMsg]);
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
          messages.map(msg => {
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
              {messageTemplates.map(template => (
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
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />

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
            onChange={e => setInputText(e.target.value)}
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
