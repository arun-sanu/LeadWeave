import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Megaphone, Loader2, MessageSquare, X } from 'lucide-react';
import MessageBody from './MessageBody';
import type { Channel, ChannelMessage } from '../../services/api';
import type { UseQueryResult } from '@tanstack/react-query';

interface ChannelRoomViewProps {
  activeChannel: Channel;
  closeActiveRoom: () => void;
  channelMessages: UseQueryResult<ChannelMessage[], Error>;
  formatChatTime: (timestamp?: number) => string;
}

export function ChannelRoomView({
  activeChannel,
  closeActiveRoom,
  channelMessages,
  formatChatTime,
}: ChannelRoomViewProps) {
  const { t } = useTranslation();

  const channelFeedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = channelFeedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeChannel.id, channelMessages.data]);

  return (
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
  );
}

export default ChannelRoomView;
