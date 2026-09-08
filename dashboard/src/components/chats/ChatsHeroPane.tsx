import { useTranslation } from 'react-i18next';
import { Search, Smartphone, MessageCircle, Network } from 'lucide-react';
import type { Session } from '../../services/api';

interface ChatsHeroPaneProps {
  leftPaneMode: 'chats' | 'sessions' | 'lan-mesh';
  onSetLeftPaneMode: (mode: 'chats' | 'sessions' | 'lan-mesh') => void;
  sessions: Session[];
  allSessions: Session[];
  selectedSessionId: string;
  onSelectSessionId: (id: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export function ChatsHeroPane({
  leftPaneMode,
  onSetLeftPaneMode,
  sessions,
  allSessions,
  selectedSessionId,
  onSelectSessionId,
  searchQuery,
  onSearchQueryChange,
}: ChatsHeroPaneProps) {
  const { t } = useTranslation();

  return (
    <main className="chats-room">
      {/* Top View Selector Bar on Left Pane */}
      <div className="left-pane-view-toggle-bar">
        <div className="left-pane-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={leftPaneMode === 'sessions'}
            className={`left-pane-tab ${leftPaneMode === 'sessions' ? 'active' : ''}`}
            onClick={() => onSetLeftPaneMode('sessions')}
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
            onClick={() => onSetLeftPaneMode('chats')}
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
            onClick={() => onSetLeftPaneMode('lan-mesh')}
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
                  onChange={e => onSearchQueryChange(e.target.value)}
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
                      onChange={e => onSelectSessionId(e.target.value)}
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
                  onClick={() => onSetLeftPaneMode('sessions')}
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
              <span>Decentralized P2P Mesh Network</span>
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
  );
}

export default ChatsHeroPane;
