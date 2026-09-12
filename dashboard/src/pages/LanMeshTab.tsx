import React, { useState, useEffect } from 'react';
import { useLanMeshContext, getProfileAssignedName } from '../contexts/LanMeshContext';
import { Network, Send, User, CheckCircle2, Paperclip } from 'lucide-react';

export const LanMeshTab: React.FC = () => {
  const {
    userName,
    hasJoined,
    peers,
    messages,
    isConnected,
    join,
    sendMessage,
    sendFile,
    markMessagesRead
  } = useLanMeshContext();

  const [inputName, setInputName] = useState<string>(() => userName || getProfileAssignedName());
  const [inputMessage, setInputMessage] = useState('');
  
  useEffect(() => {
    if (userName) {
      setInputName(userName);
    }
  }, [userName]);

  useEffect(() => {
    if (hasJoined) {
      markMessagesRead();
    }
  }, [messages, hasJoined, markMessagesRead]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputName.trim()) {
      join(inputName.trim());
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      sendMessage(inputMessage);
      setInputMessage('');
    }
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      sendFile(e.target.files[0]);
    }
  };

  if (!hasJoined) {
    return (
      <div className="chats-list-empty" style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Network size={40} className="text-primary" style={{ marginBottom: '1rem', opacity: 0.8 }} />
        <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.0625rem', fontWeight: 600 }}>
          Join LAN Mesh
        </h4>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: '280px', lineHeight: 1.5 }}>
          Connect to peers on your local network using your LeadWeave profile identity.
        </p>
        <form onSubmit={handleJoin} style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Profile Identity Name
            </label>
            <input
              type="text"
              className="chat-search-input"
              style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-strong)', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Your Profile Name"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
          >
            <Network size={16} /> Connect with Profile
          </button>
        </form>
      </div>
    );
  }

  // Active view
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Network Status Header */}
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ padding: '0.5rem', borderRadius: '50%', background: isConnected ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--error-rgb), 0.1)', color: isConnected ? 'var(--success)' : 'var(--error-text)' }}>
            <Network size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>LAN Mesh</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? 'var(--success)' : 'var(--status-failed)' }} />
              {isConnected ? 'Signaling Active' : 'Disconnected'}
            </div>
          </div>
        </div>

        {/* Profile Assigned User Name Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(var(--success-rgb), 0.12)', border: '1px solid rgba(var(--success-rgb), 0.25)', borderRadius: '9999px', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
          <User size={13} />
          <span>{userName}</span>
        </div>
      </div>

      {/* Peer List */}
      <div className="chats-list-scroll" style={{ flex: '0 0 auto', maxHeight: '35%', overflowY: 'auto', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Peers ({peers.length})
        </div>
        {peers.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Scanning for peers...
          </div>
        ) : (
          peers.map((peer: import('../contexts/LanMeshContext').LanPeerInfo) => (
            <div key={peer.peerId} className="chat-list-item" style={{ cursor: 'default' }}>
              <div className="chat-item-avatar-wrapper">
                <div className="chat-item-avatar">
                  <User size={20} className="chat-avatar-icon" />
                </div>
                <div className="chat-item-status-badge online" />
              </div>
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">{peer.name}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-last-msg" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
                    <CheckCircle2 size={12} /> P2P Connected
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Area inside the sidebar pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-light)', overflow: 'hidden' }}>
        <div className="chat-room-messages" style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', opacity: 0.7 }}>
              <Network size={32} style={{ marginBottom: '1rem' }} />
              <p style={{ fontSize: '0.875rem', textAlign: 'center', maxWidth: '200px' }}>Mesh network is active. Say hello!</p>
            </div>
          ) : (
            messages.map((msg: import('../contexts/LanMeshContext').ChatMessage, index: number) => {
              const isMine = msg.senderName === userName;
              const isFirstInGroup = index === 0 || messages[index - 1].senderName !== msg.senderName;
              
              return (
                <div key={msg.id || index} className={`chat-bubble-row ${isMine ? 'sent' : 'received'}`} style={{ marginTop: isFirstInGroup ? '0.75rem' : '0.125rem' }}>
                  <div className="chat-bubble">
                    {isFirstInGroup && !isMine && (
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>
                        {msg.senderName}
                      </div>
                    )}
                    <div className="chat-bubble-text" style={{ fontSize: '0.9375rem' }}>{msg.text}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Chat Input */}
        <div className="chat-room-footer" style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label className="btn-icon" style={{ cursor: 'pointer' }}>
              <Paperclip size={20} />
              <input type="file" style={{ display: 'none' }} onChange={handleFileDrop} />
            </label>
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              className="chat-room-input"
              style={{ flex: 1, padding: '0.75rem', borderRadius: '1.25rem', border: '1px solid var(--border)', background: 'var(--bg-light)', color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="btn-primary"
              style={{ borderRadius: '50%', width: '2.5rem', height: '2.5rem', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
