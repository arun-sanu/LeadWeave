import React from 'react';
import { X } from 'lucide-react';
import { bubbleStore, type ChatBubble } from './useBubbleStore';
import { getBubbleDisplayName } from './bubbleUtils';

export function BubbleItem({ bubble, index }: { bubble: ChatBubble; index: number }) {
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

