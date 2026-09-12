import { useState } from 'react';
import { X } from 'lucide-react';
import { messageApi, type ChatMessage } from '../../services/api';

export function FloatingNewChatDrawer({
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

