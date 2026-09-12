import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Network,
  Send,
  Paperclip,
  Maximize2,
  ChevronUp,
  User,
  CheckCircle2,
  X,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useLanMeshContext, getProfileAssignedName, type ChatMessage } from '../../contexts/LanMeshContext';
import './LanMeshFloatingPill.css';

export const LanMeshFloatingPill: React.FC = () => {
  const {
    userName,
    hasJoined,
    peers,
    messages,
    isConnected,
    unreadCount,
    latestIncomingMessage,
    join,
    sendMessage,
    sendFile,
    markMessagesRead,
    clearLatestIncomingMessage,
  } = useLanMeshContext();

  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [joinNameInput, setJoinNameInput] = useState(() => userName || getProfileAssignedName());
  const [incomingToast, setIncomingToast] = useState<ChatMessage | null>(null);

  useEffect(() => {
    if (userName) {
      setJoinNameInput(userName);
    }
  }, [userName]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check if user is currently on the full LAN Mesh tab
  const isFullLanMeshPage = location.pathname === '/chats' && location.search.includes('tab=lan-mesh');

  // Handle incoming message toast when quick-drawer is closed
  useEffect(() => {
    if (!latestIncomingMessage) return;
    if (latestIncomingMessage.senderName === userName) return;

    // If user is already on full lan-mesh page or drawer is open, mark as read
    if (isFullLanMeshPage || isOpen) {
      markMessagesRead();
      clearLatestIncomingMessage();
      return;
    }

    setIncomingToast(latestIncomingMessage);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setIncomingToast(null);
      clearLatestIncomingMessage();
    }, 6000);

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [latestIncomingMessage, userName, isFullLanMeshPage, isOpen, markMessagesRead, clearLatestIncomingMessage]);

  // Auto-scroll message list when drawer is open
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Handle opening drawer
  const handleToggleDrawer = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIncomingToast(null);
      markMessagesRead();
      clearLatestIncomingMessage();
    } else {
      setIsOpen(false);
    }
  };

  const handleOpenFullPage = () => {
    setIsOpen(false);
    setIncomingToast(null);
    markMessagesRead();
    navigate('/chats?tab=lan-mesh');
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    sendMessage(inputText.trim());
    setInputText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      sendFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinNameInput.trim()) {
      join(joinNameInput.trim());
    }
  };

  if (isFullLanMeshPage) {
    return null;
  }

  return (
    <div className="lan-floating-wrapper top-right" aria-label="LAN Messenger Floating Hub">
      {/* 1. PERSISTENT LIVE ALL-PAGE DOCKED PILL (TOP RIGHT) */}
      <div
        className={`lan-docked-pill ${isOpen ? 'active-open' : ''} ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={handleToggleDrawer}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label="Toggle Live LAN Mesh Messenger"
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleDrawer();
          }
        }}
      >
        <div className="lan-pill-status-node">
          <span className={`lan-pill-dot ${isConnected ? 'live' : 'offline'}`}>
            {isConnected && <span className="lan-pill-pulse-ring" />}
          </span>
          <Network size={16} className="lan-pill-network-icon" />
        </div>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <div className="lan-pill-unread-badge" title={`${unreadCount} unread message(s)`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </div>

      {/* 2. INCOMING MESSAGE TOAST POPUP (Drops down below the top-right pill) */}
      {incomingToast && !isOpen && (
        <div
          className="lan-incoming-toast"
          onClick={handleToggleDrawer}
          role="alert"
          title="Click to open LAN Messenger"
        >
          <div className="lan-toast-avatar">
            <User size={16} />
          </div>
          <div className="lan-toast-body">
            <div className="lan-toast-header">
              <span className="lan-toast-sender">{incomingToast.senderName}</span>
              <span className="lan-toast-tag">LAN</span>
            </div>
            <div className="lan-toast-msg">
              {incomingToast.fileName ? `📎 Shared file: ${incomingToast.fileName}` : incomingToast.text}
            </div>
          </div>
          <button
            type="button"
            className="lan-toast-close"
            onClick={e => {
              e.stopPropagation();
              setIncomingToast(null);
              clearLatestIncomingMessage();
            }}
            aria-label="Dismiss message notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3. EXPANDED QUICK-DRAWER MESSENGER DIALOG (Drops down below pill) */}
      {isOpen && (
        <div className="lan-quick-drawer">
          {/* Header */}
          <div className="lan-drawer-header">
            <div className="lan-drawer-title-row">
              <div className="lan-drawer-status-badge">
                <span className={`lan-status-dot ${isConnected ? 'online' : 'offline'}`} />
                <Network size={16} className="lan-drawer-icon" />
                <span className="lan-drawer-title">LAN Mesh</span>
              </div>
              <span className="lan-peer-count-pill">
                {peers.length} {peers.length === 1 ? 'Peer' : 'Peers'}
              </span>
              <span className="lan-user-identity-chip" title={`Your Profile Identity: ${userName}`}>
                <User size={11} />
                {userName}
              </span>
            </div>

            <div className="lan-drawer-actions">
              <button
                type="button"
                className="lan-header-btn"
                onClick={handleOpenFullPage}
                title="Open in full Chats tab"
                aria-label="Open in full Chats tab"
              >
                <Maximize2 size={15} />
              </button>
              <button
                type="button"
                className="lan-header-btn"
                onClick={() => setIsOpen(false)}
                title="Minimize pill"
                aria-label="Minimize pill"
              >
                <ChevronUp size={17} />
              </button>
            </div>
          </div>

          {/* Body */}
          {!hasJoined ? (
            <div className="lan-drawer-join-view">
              <div className="lan-join-icon-glow">
                <Sparkles size={24} color="var(--success)" />
              </div>
              <h4 className="lan-join-heading">Connect to LAN Mesh</h4>
              <p className="lan-join-subtext">
                Chat and share files directly with devices on your local Wi-Fi / LAN via WebRTC.
              </p>
              <form onSubmit={handleJoin} className="lan-join-form">
                <input
                  type="text"
                  className="lan-join-input"
                  placeholder="Your display name"
                  value={joinNameInput}
                  onChange={e => setJoinNameInput(e.target.value)}
                  required
                />
                <button type="submit" className="lan-join-btn">
                  Join Mesh Network
                </button>
              </form>
            </div>
          ) : (
            <div className="lan-drawer-chat-view">
              {/* Peers Strip */}
              <div className="lan-peers-strip">
                <span className="lan-peers-label">Online Peers:</span>
                {peers.length === 0 ? (
                  <span className="lan-peers-empty">Scanning local network...</span>
                ) : (
                  peers.map(peer => (
                    <div key={peer.peerId} className="lan-peer-chip" title={`Peer ID: ${peer.peerId}`}>
                      <span className="lan-peer-avatar">
                        <User size={12} />
                      </span>
                      <span className="lan-peer-name">{peer.name}</span>
                      <CheckCircle2 size={11} color="var(--success)" />
                    </div>
                  ))
                )}
              </div>

              {/* Message Feed */}
              <div className="lan-drawer-messages">
                {messages.length === 0 ? (
                  <div className="lan-messages-empty">
                    <Network size={28} className="lan-empty-icon" />
                    <p>Mesh ready! Send a message or drop a file to everyone on your LAN.</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMine = msg.senderName === userName;
                    const isFirstInGroup = index === 0 || messages[index - 1].senderName !== msg.senderName;

                    return (
                      <div key={msg.id || index} className={`lan-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
                        <div className="lan-bubble">
                          {isFirstInGroup && !isMine && <span className="lan-bubble-sender">{msg.senderName}</span>}
                          {msg.fileName ? (
                            <div className="lan-bubble-file">
                              <FileText size={16} />
                              <span className="lan-file-name">{msg.fileName}</span>
                            </div>
                          ) : (
                            <span className="lan-bubble-text">{msg.text}</span>
                          )}
                          <span className="lan-bubble-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSend} className="lan-drawer-footer">
                <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                <button
                  type="button"
                  className="lan-input-icon-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Share file over LAN"
                  aria-label="Share file over LAN"
                >
                  <Paperclip size={17} style={{ flexShrink: 0, display: 'block' }} />
                </button>
                <input
                  type="text"
                  className="lan-msg-input"
                  placeholder="Type a LAN message..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                />
                <button
                  type="submit"
                  className="lan-send-btn"
                  disabled={!inputText.trim()}
                  aria-label="Send LAN message"
                >
                  <Send size={15} style={{ flexShrink: 0, display: 'block' }} />
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
