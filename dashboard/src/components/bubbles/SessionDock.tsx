import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useBubbleStore, bubbleStore } from './useBubbleStore';
import { type Session } from '../../services/api';
import { BubbleItem } from './BubbleItem';
import { LivelyMessagePopup } from './LivelyMessagePopup';
import { FloatingChatDrawer } from './FloatingChatDrawer';
import { FloatingNewChatDrawer } from './FloatingNewChatDrawer';

export function SessionDock({ session }: { session: Session }) {
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

