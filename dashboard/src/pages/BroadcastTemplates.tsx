import { useState, useRef, useMemo } from 'react';
import { useCampaignContext } from '../contexts/CampaignContext';
import { useSpreadsheetStore } from '../stores/useSpreadsheetStore';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import { useSessionsQuery, useCreateTemplateMutation } from '../hooks/queries';
import { Modal } from '../components/Modal';
import {
  Shuffle,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Plus,
  BookmarkPlus,
  FolderOpen,
  Search,
  Trash2,
} from 'lucide-react';
import { countSpintaxVariations, parseSpintax } from '../utils/spintax';

export interface SavedTemplate {
  id: string;
  name: string;
  content: string;
  isPreset?: boolean;
  createdAt?: string;
}

const DEFAULT_PRESETS: SavedTemplate[] = [
  {
    id: 'preset-order-confirm',
    name: 'Order Confirmation & Tracking',
    content:
      '{Hi|Hello|Hey} {{Name}}! 📦 Your order #{{OrderNumber}} has been confirmed. Total amount: {{Amount}}. {Thank you for choosing LeadWeave!|Have a wonderful day!}',
    isPreset: true,
  },
  {
    id: 'preset-promo-discount',
    name: 'Special Discount Offer',
    content:
      '{Hi|Hey|Hello} {{Name}}, {exclusive deal|special offer} for you today! Get {10%|15%|20%} off on your next purchase. Use coupon code: {{CouponCode}}. Reply YES to claim now!',
    isPreset: true,
  },
  {
    id: 'preset-appointment-rem',
    name: 'Appointment Reminder',
    content:
      'Dear {{Name}}, this is a friendly reminder for your appointment scheduled on {{Date}} at {{Time}}. Please reply 1 to confirm or 2 to reschedule.',
    isPreset: true,
  },
  {
    id: 'preset-feedback-req',
    name: 'Service Feedback Request',
    content:
      '{Hi|Hello} {{Name}}, how was your recent experience with our service? We would love to hear your feedback!',
    isPreset: true,
  },
];

export function BroadcastTemplates() {
  useDocumentTitle('Campaign Templates - LeadWeave');
  const toast = useToast();
  const { messageTemplate, setMessageTemplate } = useCampaignContext();
  const { columns, rows } = useSpreadsheetStore();
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [spintaxSeed, setSpintaxSeed] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Template Saving & Loading State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');

  const { data: sessions = [] } = useSessionsQuery();
  const createTemplateMutation = useCreateTemplateMutation();

  const [customSavedTemplates, setCustomSavedTemplates] = useState<SavedTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('leadweave_saved_broadcast_templates');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const allSavedTemplates = useMemo(() => {
    return [...customSavedTemplates, ...DEFAULT_PRESETS];
  }, [customSavedTemplates]);

  const filteredSavedTemplates = useMemo(() => {
    const q = templateSearchTerm.trim().toLowerCase();
    if (!q) return allSavedTemplates;
    return allSavedTemplates.filter(t => t.name.toLowerCase().includes(q) || t.content.toLowerCase().includes(q));
  }, [allSavedTemplates, templateSearchTerm]);

  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) return;
    if (!messageTemplate.trim()) {
      toast.warning('Template content is empty', 'Please type a message before saving.');
      return;
    }

    const newTpl: SavedTemplate = {
      id: `tpl-${Date.now()}`,
      name: newTemplateName.trim(),
      content: messageTemplate,
      createdAt: new Date().toISOString(),
    };

    const updated = [newTpl, ...customSavedTemplates];
    setCustomSavedTemplates(updated);
    try {
      localStorage.setItem('leadweave_saved_broadcast_templates', JSON.stringify(updated));
    } catch {
      // Fallback
    }

    // Sync with backend API if session exists
    if (sessions.length > 0) {
      createTemplateMutation.mutate({
        sessionId: sessions[0].id,
        data: {
          name: newTemplateName.trim(),
          body: messageTemplate,
        },
      });
    }

    toast.success('Template saved!', `"${newTemplateName.trim()}" is now saved.`);
    setNewTemplateName('');
    setIsSaveModalOpen(false);
  };

  const handleDeleteSavedTemplate = (id: string) => {
    const updated = customSavedTemplates.filter(t => t.id !== id);
    setCustomSavedTemplates(updated);
    try {
      localStorage.setItem('leadweave_saved_broadcast_templates', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save to localStorage:', err);
    }
    toast.info('Template removed');
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageTemplate, rows, columns, previewRowIndex, spintaxSeed]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '1.5rem',
        alignItems: 'start',
      }}
    >
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

          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: totalSpintaxVariations > 1 ? 'var(--primary)' : '#64748b',
            }}
          >
            {totalSpintaxVariations > 1 ? `⚡ ${totalSpintaxVariations} variations` : 'Spintax ready'}
          </span>
        </div>

        {/* Dynamic Variable Chips */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#64748b',
              marginBottom: '0.5rem',
              letterSpacing: '0.05em',
            }}
          >
            Insert Dynamic Tag:
          </label>
          <div className="variable-chips-container">
            {availableVariables.map(v => (
              <button key={v} type="button" className="variable-chip-btn" onClick={() => handleInsertVariable(v)}>
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

          {/* Template Actions Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.4rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (!messageTemplate.trim()) {
                    toast.warning('Empty template', 'Type a message before saving.');
                    return;
                  }
                  setIsSaveModalOpen(true);
                }}
                title="Save current message as template"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'rgba(37, 99, 235, 0.18)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <BookmarkPlus size={14} />
                <span>Save as Template</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLoadModalOpen(true)}
                title="Load saved template or preset"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#e2e8f0',
                  border: '1px solid var(--studio-border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <FolderOpen size={14} />
                <span>Load Saved Template</span>
              </button>
            </div>

            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{messageTemplate.length} characters</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AUTHENTIC WHATSAPP PREVIEW MOCKUP */}
      <div className="studio-card-container" style={{ padding: '1.25rem' }}>
        <div className="studio-card-header-row" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
          <div>
            <h3
              style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#64748b',
                letterSpacing: '0.05em',
                margin: 0,
              }}
            >
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: '#0f172a',
                  padding: '2px 6px',
                  borderRadius: 6,
                  border: '1px solid var(--studio-border)',
                }}
              >
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
              <div className="whatsapp-avatar">{rows[previewRowIndex]?.Name?.charAt(0) || 'L'}</div>
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

      {/* SAVE TEMPLATE MODAL */}
      <Modal
        open={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title="Save Message Template"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsSaveModalOpen(false)}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8125rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid var(--studio-border)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim()}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8125rem',
                borderRadius: '6px',
                cursor: newTemplateName.trim() ? 'pointer' : 'not-allowed',
                opacity: newTemplateName.trim() ? 1 : 0.5,
              }}
            >
              Save Template
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: '#e2e8f0',
              }}
            >
              Template Name
            </label>
            <input
              type="text"
              placeholder="e.g. Q4 Order Confirmation, Promotional Spintax"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              style={{
                width: '100%',
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid var(--studio-border)',
                borderRadius: '6px',
                padding: '0.6rem 0.75rem',
                fontSize: '0.875rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && newTemplateName.trim()) {
                  handleSaveTemplate();
                }
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8125rem',
                fontWeight: 600,
                marginBottom: '0.35rem',
                color: '#94a3b8',
              }}
            >
              Template Preview
            </label>
            <div
              style={{
                background: '#090d16',
                border: '1px solid var(--studio-border)',
                borderRadius: '6px',
                padding: '0.75rem',
                fontSize: '0.8125rem',
                color: '#cbd5e1',
                whiteSpace: 'pre-wrap',
                maxHeight: '140px',
                overflowY: 'auto',
                lineHeight: '1.5',
              }}
            >
              {messageTemplate || '(Empty template)'}
            </div>
          </div>
        </div>
      </Modal>

      {/* LOAD SAVED TEMPLATE MODAL */}
      <Modal
        open={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        title="Saved Templates & Presets"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsLoadModalOpen(false)}
              style={{
                padding: '0.4rem 0.85rem',
                fontSize: '0.8125rem',
                borderRadius: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                border: '1px solid var(--studio-border)',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
          {/* Search Filter Input */}
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#64748b',
              }}
            />
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearchTerm}
              onChange={e => setTemplateSearchTerm(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: '32px',
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid var(--studio-border)',
                borderRadius: '6px',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                fontSize: '0.8125rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* List of Templates */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '340px', overflowY: 'auto' }}
          >
            {filteredSavedTemplates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                No templates found.
              </div>
            ) : (
              filteredSavedTemplates.map(tpl => (
                <div
                  key={tpl.id}
                  style={{
                    background: '#0f172a',
                    border: '1px solid var(--studio-border)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#f8fafc' }}>{tpl.name}</span>
                      {tpl.isPreset ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Preset
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.3rem 0.75rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          setMessageTemplate(tpl.content);
                          setIsLoadModalOpen(false);
                          toast.info('Template Applied', `Loaded "${tpl.name}" into message composer.`);
                        }}
                      >
                        Apply Template
                      </button>
                      {!tpl.isPreset && (
                        <button
                          type="button"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Delete saved template"
                          onClick={() => handleDeleteSavedTemplate(tpl.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: '#94a3b8',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '65px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.4',
                    }}
                  >
                    {tpl.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
