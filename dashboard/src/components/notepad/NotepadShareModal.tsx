import React, { useState } from 'react';
import { Share2, X, Send, Network, Copy, Check, Lock } from 'lucide-react';
import { useLanMeshContext } from '../../contexts/LanMeshContext';
import { messageApi, sessionApi } from '../../services/api';

interface NotepadShareModalProps {
  type: 'note' | 'sticky';
  title?: string;
  content: string;
  onClose: () => void;
}

export const NotepadShareModal: React.FC<NotepadShareModalProps> = ({
  type,
  title,
  content,
  onClose,
}) => {
  const lanMesh = useLanMeshContext();
  const [activeTab, setActiveTab] = useState<'lan' | 'chat'>('lan');
  
  // WhatsApp Chat states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch active sessions when switching to Chat tab
  const handleTabChange = async (tab: 'lan' | 'chat') => {
    if (type === 'sticky' && tab === 'chat') return; // Sticky notes cannot be shared to chat
    setActiveTab(tab);
    setStatusMsg(null);

    if (tab === 'chat' && sessions.length === 0) {
      try {
        const list = await sessionApi.list();
        if (Array.isArray(list) && list.length > 0) {
          setSessions(list.map((s: any) => ({ id: s.id, name: s.sessionName || s.id })));
          setSessionId(list[0].id);
        }
      } catch {
        // ignore fallback
      }
    }
  };

  const formattedShareText = type === 'note'
    ? `📝 *${title || 'Notepad'}*\n${content || ''}`
    : `📌 *Sticky Note*\n${content || ''}`;

  // LAN Share Handler
  const handleShareToLan = () => {
    if (!content.trim() && !title?.trim()) {
      setStatusMsg({ type: 'error', text: 'Note content is empty' });
      return;
    }

    try {
      if (lanMesh?.sendMessage) {
        lanMesh.sendMessage(formattedShareText);
        setStatusMsg({ type: 'success', text: 'Shared successfully with LAN Mesh members!' });
      } else {
        setStatusMsg({ type: 'error', text: 'LAN Mesh service unavailable' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to share to LAN' });
    }
  };

  // WhatsApp Chat Share Handler
  const handleShareToChat = async () => {
    if (type === 'sticky') return;
    if (!phoneNumber.trim()) {
      setStatusMsg({ type: 'error', text: 'Please enter target phone number / Chat ID' });
      return;
    }
    if (!sessionId) {
      setStatusMsg({ type: 'error', text: 'No active session available' });
      return;
    }

    setIsSending(true);
    setStatusMsg(null);

    try {
      const formattedChatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber.replace(/\D/g, '')}@c.us`;
      await messageApi.sendText(sessionId, formattedChatId, formattedShareText);
      setStatusMsg({ type: 'success', text: 'Sent to WhatsApp chat successfully!' });
      setPhoneNumber('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Failed to send message' });
    } finally {
      setIsSending(false);
    }
  };

  // Copy to Clipboard Handler
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedShareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="notepad-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${type === 'note' ? 'Note' : 'Sticky Note'}`}
    >
      <div className="notepad-search-modal" style={{ width: '480px' }} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="notepad-search-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={18} color="#38bdf8" />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>
              Share {type === 'note' ? 'Note' : 'Sticky Note'}
            </span>
          </div>
          <button className="notepad-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Share Tabs */}
        <div className="notepad-search-toolbar" style={{ justifyContent: 'flex-start', gap: '8px' }}>
          <button
            className={`filter-pill ${activeTab === 'lan' ? 'active' : ''}`}
            onClick={() => handleTabChange('lan')}
          >
            <Network size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            Share to LAN
          </button>

          <button
            className={`filter-pill ${activeTab === 'chat' ? 'active' : ''} ${type === 'sticky' ? 'disabled' : ''}`}
            onClick={() => handleTabChange('chat')}
            disabled={type === 'sticky'}
            title={type === 'sticky' ? 'Sticky notes can only be shared with LAN members' : 'Share to WhatsApp Chat'}
            style={type === 'sticky' ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            {type === 'sticky' ? (
              <Lock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            ) : (
              <Send size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
            )}
            Share to Chat
          </button>
        </div>

        {/* Share Content Body */}
        <div className="notepad-catalog-list" style={{ gap: '14px' }}>
          {/* Note Preview Box */}
          <div
            style={{
              background: '#27272a',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>Share Preview:</span>
            <p style={{ margin: 0, fontSize: '12.5px', color: '#e4e4e7', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
              {formattedShareText}
            </p>
          </div>

          {/* Status Message Banner */}
          {statusMsg && (
            <div
              style={{
                background: statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${statusMsg.type === 'success' ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                color: statusMsg.type === 'success' ? '#4ade80' : '#fca5a5',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Tab 1: Share to LAN Mesh */}
          {activeTab === 'lan' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
                Broadcast this {type === 'note' ? 'note' : 'sticky note'} directly to active peer members on your LAN Network.
                {lanMesh?.peers ? ` (${lanMesh.peers.length} LAN peer(s) active)` : ''}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="notepad-btn-add"
                  style={{ flex: 1, justifyContent: 'center', padding: '8px' }}
                  onClick={handleShareToLan}
                >
                  <Network size={15} />
                  <span>Broadcast to LAN Members</span>
                </button>

                <button
                  className="notepad-btn-icon"
                  style={{ padding: '8px 12px', border: '1px solid rgba(255, 255, 255, 0.12)' }}
                  onClick={handleCopy}
                  title="Copy formatted note text"
                >
                  {copied ? <Check size={15} color="#4ade80" /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Share to WhatsApp Chat */}
          {activeTab === 'chat' && type === 'note' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
                Send this note to a WhatsApp contact or active chat session.
              </div>

              {sessions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Select Session:</label>
                  <select
                    className="notepad-sort-select"
                    value={sessionId}
                    onChange={e => setSessionId(e.target.value)}
                    style={{ width: '100%', padding: '6px' }}
                  >
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Recipient Phone Number / Chat ID:</label>
                <input
                  type="text"
                  className="notepad-search-input"
                  placeholder="e.g. 15551234567 or chat_id"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  style={{ background: '#27272a', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '6px', padding: '6px 10px' }}
                />
              </div>

              <button
                className="notepad-btn-add"
                style={{ width: '100%', justifyContent: 'center', padding: '8px', marginTop: '4px' }}
                onClick={handleShareToChat}
                disabled={isSending}
              >
                <Send size={15} />
                <span>{isSending ? 'Sending...' : 'Send Note to Chat'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
