import { useState, useRef, useMemo } from 'react';
import { useCampaignContext } from '../contexts/CampaignContext';
import { useSpreadsheetStore } from '../stores/useSpreadsheetStore';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Shuffle, ChevronLeft, ChevronRight, MessageSquare, Sparkles, Plus } from 'lucide-react';
import { countSpintaxVariations, parseSpintax } from '../utils/spintax';

export function BroadcastTemplates() {
  useDocumentTitle('Campaign Templates - LeadWeave');
  const { messageTemplate, setMessageTemplate } = useCampaignContext();
  const { columns, rows } = useSpreadsheetStore();
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [spintaxSeed, setSpintaxSeed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const availableVariables = ['Phone', ...columns];

  const handleInsertVariable = (v: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const updated = messageTemplate.substring(0, start) + `{{${v}}}` + messageTemplate.substring(end);
    setMessageTemplate(updated);
  };

  const totalSpintaxVariations = useMemo(() => countSpintaxVariations(messageTemplate), [messageTemplate]);

  // Dynamic Variable Interpolation Preview with Spintax
  const previewMessage = useMemo(() => {
    if (rows.length === 0) return 'No recipient data available.';
    const currentRow = rows[Math.min(previewRowIndex, rows.length - 1)];
    if (!currentRow) return messageTemplate;

    // 1. Resolve Spintax first (seeded by spintaxSeed for preview variations)
    let spinEvaluated = parseSpintax(messageTemplate);

    // 2. Replace {{Phone}}
    spinEvaluated = spinEvaluated.replace(/{{\s*phone\s*}}/gi, currentRow.phone || '');

    // 3. Replace dynamic columns
    columns.forEach((col: string) => {
      const regex = new RegExp(`{{\\s*${col}\\s*}}`, 'gi');
      spinEvaluated = spinEvaluated.replace(regex, currentRow[col] || `[${col}]`);
    });

    return spinEvaluated;
  }, [messageTemplate, rows, columns, previewRowIndex, spintaxSeed]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
      {/* LEFT COLUMN: COMPOSER & CHIPS */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <MessageSquare size={20} className="text-primary" />
              <span>Message Composer</span>
            </h2>
            <p className="studio-card-subtitle">
              Draft template using <code>{`{{Variable}}`}</code> tags and <code>{`{Hi|Hello}`}</code> Spintax.
            </p>
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: totalSpintaxVariations > 1 ? 'var(--primary)' : '#64748b' }}>
            {totalSpintaxVariations > 1 ? `⚡ ${totalSpintaxVariations} variations` : 'Spintax ready'}
          </span>
        </div>

        {/* Dynamic Variable Chips */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
            Insert Dynamic Tag:
          </label>
          <div className="variable-chips-container">
            {availableVariables.map(v => (
              <button
                key={v}
                type="button"
                className="variable-chip-btn"
                onClick={() => handleInsertVariable(v)}
              >
                <Plus size={12} />
                <span>{`{{${v}}}`}</span>
              </button>
            ))}
            <button
              type="button"
              className="variable-chip-btn spintax-chip"
              onClick={() => {
                const sample = '{Hi|Hello|Hey}';
                if (!textareaRef.current) return;
                const start = textareaRef.current.selectionStart;
                const end = textareaRef.current.selectionEnd;
                const updated = messageTemplate.substring(0, start) + sample + messageTemplate.substring(end);
                setMessageTemplate(updated);
              }}
            >
              <Sparkles size={12} />
              <span>+ Spintax Helper</span>
            </button>
          </div>
        </div>

        {/* Textarea Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <textarea
            ref={textareaRef}
            className="form-control"
            rows={10}
            value={messageTemplate}
            onChange={e => setMessageTemplate(e.target.value)}
            placeholder="Type your message with {{Name}} tags and {Hi|Hello} Spintax..."
            style={{
              width: '100%',
              background: '#0f172a',
              color: '#f8fafc',
              border: '1px solid var(--studio-border)',
              borderRadius: '8px',
              padding: '0.85rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              fontFamily: 'sans-serif',
              resize: 'vertical',
              minHeight: '220px',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
            {messageTemplate.length} characters
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: AUTHENTIC WHATSAPP PREVIEW MOCKUP */}
      <div className="studio-card-container" style={{ padding: '1.25rem' }}>
        <div className="studio-card-header-row" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em', margin: 0 }}>
              Live WhatsApp Preview
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn-tool"
              onClick={() => setSpintaxSeed(s => s + 1)}
              title="Shuffle Spintax Variations"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              <Shuffle size={12} />
              <span>Shuffle Spin</span>
            </button>

            {rows.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#0f172a', padding: '2px 6px', borderRadius: 6, border: '1px solid var(--studio-border)' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginRight: '4px' }}>
                  {previewRowIndex + 1}/{rows.length}
                </span>
                <button
                  className="spreadsheet-header-del-btn"
                  disabled={previewRowIndex === 0}
                  onClick={() => setPreviewRowIndex(p => Math.max(0, p - 1))}
                  style={{ opacity: previewRowIndex === 0 ? 0.3 : 1 }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  className="spreadsheet-header-del-btn"
                  disabled={previewRowIndex >= rows.length - 1}
                  onClick={() => setPreviewRowIndex(p => Math.min(rows.length - 1, p + 1))}
                  style={{ opacity: previewRowIndex >= rows.length - 1 ? 0.3 : 1 }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Phone frame */}
        <div className="whatsapp-phone-frame">
          <div className="whatsapp-mock-header">
            <div className="whatsapp-avatar-info">
              <div className="whatsapp-avatar">
                {rows[previewRowIndex]?.Name?.charAt(0) || 'L'}
              </div>
              <div>
                <p className="whatsapp-contact-name">
                  {rows[previewRowIndex]?.Name || rows[previewRowIndex]?.phone || 'Lead Contact'}
                </p>
                <span className="whatsapp-contact-status">online</span>
              </div>
            </div>
          </div>

          <div className="whatsapp-chat-bg">
            <div className="whatsapp-out-bubble">
              {previewMessage}
              <div className="whatsapp-bubble-footer">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="whatsapp-ticks">✓✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
