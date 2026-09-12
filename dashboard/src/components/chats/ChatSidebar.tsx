import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CircleDashed,
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  Users,
} from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import type { Channel, Chat, ContactStatusGroup } from '../../services/api';
import ChatAvatar from './ChatAvatar';
import EmojiText from './EmojiText';

export type ChatsTab = 'chats' | 'groups' | 'channels' | 'status' | 'archive';

const TAB_ICONS = {
  chats: MessageSquare,
  groups: Users,
  channels: Megaphone,
  status: CircleDashed,
  archive: Archive,
};

interface ChatSidebarProps {
  activeTab: ChatsTab;
  onSwitchTab: (tab: ChatsTab) => void;
  onComposeStatus: () => void;
  formatChatTime: (timestamp?: number) => string;

  chatsTab: {
    loading: boolean;
    chats: Chat[];
    activeChatId?: string;
    pictures?: Record<string, string | null>;
    onSelectChat: (chat: Chat) => void;
    onArchiveChat?: (chat: Chat, archive: boolean) => void;
  };
  channelsTab: {
    engineLoading: boolean;
    supported: boolean;
    query: UseQueryResult<Channel[], Error>;
    channels: Channel[];
    activeChannelId?: string;
    onSelectChannel: (channel: Channel) => void;
  };
  statusTab: {
    loading: boolean;
    error: boolean;
    groups: ContactStatusGroup[];
    activeContactId: string | null;
    onSelectContact: (contactId: string) => void;
  };
}

// RIGHT SIDEBAR: session selector (if multi-session), Chats/Channels/Status tab bar, search, and lists.
// The page owns all queries/state; this component renders them and reports interactions up.
function ChatSidebar({
  activeTab,
  onSwitchTab,
  onComposeStatus,
  formatChatTime,

  chatsTab,
  channelsTab,
  statusTab,
}: ChatSidebarProps) {
  const { t } = useTranslation();
  const chatsContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: chatsTab.chats.length,
    getScrollElement: () => chatsContainerRef.current,
    estimateSize: () => 72,
    overscan: 6,
    initialRect: { width: 300, height: 800 },
  });

  const formatLastMessageSnippet = (chat: Chat) => chat.lastMessage || '';

  // Shared row markup for the Chats and Status lists — a plain function (not memoized) since it
  // closes over render-scoped props (chatsTab.activeChatId, chatsTab.pictures) that already
  // change every render.
  const renderChatRow = (chat: Chat) => {
    const isActive = chatsTab.activeChatId === chat.id;
    return (
      <div
        key={chat.id}
        role="button"
        tabIndex={0}
        aria-current={isActive ? 'true' : undefined}
        className={`chat-item-card ${isActive ? 'active' : ''}`}
        onClick={() => chatsTab.onSelectChat(chat)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            chatsTab.onSelectChat(chat);
          }
        }}
      >
        <ChatAvatar pictureUrl={chatsTab.pictures?.[chat.id]} kind={chat.kind} />

        <div className="chat-item-info">
          <div className="chat-item-top">
            <span className="chat-item-name" title={chat.name || chat.id}>
              <EmojiText text={chat.name || chat.id.split('@')[0]} />
            </span>
            {chat.kind !== 'individual' && chat.kind !== 'unknown' && (
              <span className={`chat-kind-badge kind-${chat.kind}`}>{t(`chats.kind.${chat.kind}`)}</span>
            )}
            {/* Ternary, not `&&`: a chat with no messages carries timestamp 0, and React
                renders the number 0 as text — so `0 && <span/>` painted a literal "0"
                where the time belongs, on every such row. */}
            {chat.timestamp ? <span className="chat-item-time">{formatChatTime(chat.timestamp)}</span> : null}
          </div>
          <div className="chat-item-bottom">
            <span className="chat-item-snippet" title={formatLastMessageSnippet(chat)}>
              {formatLastMessageSnippet(chat) ? (
                <EmojiText text={formatLastMessageSnippet(chat)} />
              ) : (
                <span className="no-message">{t('chats.noMessageYet')}</span>
              )}
            </span>
            <div className="chat-item-actions-cluster">
              {chat.unreadCount > 0 && (
                <span
                  className="chat-unread-badge"
                  title={t('chats.unreadBadge', { count: chat.unreadCount })}
                  aria-label={t('chats.unreadBadge', { count: chat.unreadCount })}
                >
                  {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                </span>
              )}
              {chatsTab.onArchiveChat && (
                <button
                  type="button"
                  className="chat-item-quick-action"
                  title={chat.archived ? t('chats.unarchiveChat') : t('chats.archiveChat')}
                  aria-label={chat.archived ? t('chats.unarchiveChat') : t('chats.archiveChat')}
                  onClick={e => {
                    e.stopPropagation();
                    chatsTab.onArchiveChat!(chat, !chat.archived);
                  }}
                >
                  {chat.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside className="chats-sidebar">
      <div className="sidebar-header-box">
        {/* Chats / Groups / Channels / Status / Archive tabs */}
        <div className="chats-tabs" role="tablist">
          {(['chats', 'groups', 'channels', 'status', 'archive'] as const).map(tab => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                className={`chats-tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => onSwitchTab(tab)}
              >
                <Icon size={13} />
                <span>{t(`chats.tab.${tab}`)}</span>
              </button>
            );
          })}
        </div>

        {/* Compose a new status — only meaningful on the Status tab. */}
        {activeTab === 'status' && (
          <button type="button" className="btn-primary status-compose-trigger" onClick={onComposeStatus}>
            <Plus size={16} />
            {t('chats.status.compose')}
          </button>
        )}
      </div>

      {/* Chat / Group / Archive list */}
      {(activeTab === 'chats' || activeTab === 'groups' || activeTab === 'archive') && (
        <div className="chats-list" ref={chatsContainerRef}>
          {chatsTab.loading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
              <span>{t('chats.loadingChats')}</span>
            </div>
          ) : chatsTab.chats.length === 0 ? (
            <div className="chats-list-empty">
              <span>
                {activeTab === 'groups'
                  ? t('chats.emptyGroups')
                  : activeTab === 'archive'
                    ? t('chats.emptyArchive')
                    : t('chats.empty')}
              </span>
            </div>
          ) : chatsTab.chats.length > 50 ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const chat = chatsTab.chats[virtualRow.index];
                return (
                  <div
                    key={chat.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderChatRow(chat)}
                  </div>
                );
              })}
            </div>
          ) : (
            chatsTab.chats.map(renderChatRow)
          )}
        </div>
      )}

      {/* Channels list — wwjs-only (newsletter/channel API isn't implemented on Baileys, which
          throws 501 for both listing and reading). channelsQuery is gated off entirely on that
          engine, so the branch order below never depends on a request having actually run. */}
      {activeTab === 'channels' && (
        <div className="chats-list">
          {channelsTab.engineLoading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : !channelsTab.supported ? (
            <div className="chats-list-empty">
              <span>{t('chats.channels.notSupported')}</span>
            </div>
          ) : channelsTab.query.isLoading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : channelsTab.query.error ? (
            <div className="chats-list-empty">
              <AlertCircle size={24} className="text-warn" />
              <span>{t('chats.channels.notReady')}</span>
            </div>
          ) : (channelsTab.query.data?.length ?? 0) === 0 ? (
            <div className="chats-list-empty">
              <span>{t('chats.channels.empty')}</span>
            </div>
          ) : (
            channelsTab.channels.map(ch => (
              <div
                key={ch.id}
                role="button"
                tabIndex={0}
                aria-current={channelsTab.activeChannelId === ch.id ? 'true' : undefined}
                className={`chat-item-card ${channelsTab.activeChannelId === ch.id ? 'active' : ''}`}
                onClick={() => channelsTab.onSelectChannel(ch)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    channelsTab.onSelectChannel(ch);
                  }
                }}
              >
                <div className="chat-avatar">
                  <Megaphone size={20} />
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{ch.name}</span>
                  </div>
                  {ch.subscriberCount != null && (
                    <div className="chat-item-bottom">
                      <span className="chat-item-snippet">
                        {t('chats.channels.subscribers', { count: ch.subscriberCount })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Status list — per-contact status groups read from the 24h store. Not engine-gated:
          both engines now have status content. */}
      {activeTab === 'status' && (
        <div className="chats-list">
          {statusTab.loading ? (
            <div className="chats-list-loading">
              <Loader2 className="animate-spin" size={24} />
            </div>
          ) : statusTab.error ? (
            <div className="chats-list-empty">
              <AlertCircle size={24} className="text-warn" />
              <span>{t('chats.status.loadError')}</span>
            </div>
          ) : statusTab.groups.length === 0 ? (
            <div className="chats-list-empty">
              <span>{t('chats.status.empty')}</span>
            </div>
          ) : (
            statusTab.groups.map(group => (
              <div
                key={group.contact.id}
                role="button"
                tabIndex={0}
                aria-current={statusTab.activeContactId === group.contact.id ? 'true' : undefined}
                className={`chat-item-card ${statusTab.activeContactId === group.contact.id ? 'active' : ''}`}
                onClick={() => statusTab.onSelectContact(group.contact.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    statusTab.onSelectContact(group.contact.id);
                  }
                }}
              >
                <div className="chat-avatar">
                  <CircleDashed size={20} />
                </div>
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">
                      {group.contact.name ?? group.contact.pushName ?? group.contact.id}
                    </span>
                    <span className="chat-item-time">
                      {formatChatTime(Math.floor(new Date(group.latest).getTime() / 1000))}
                    </span>
                  </div>
                  <div className="chat-item-bottom">
                    <span className="chat-item-snippet">
                      {t('chats.status.itemCount', { count: group.items.length })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}

export default ChatSidebar;
