import { useState, useEffect } from 'react';
import { FileSpreadsheet, Globe, RefreshCw, Users2, Loader2, Code, X, Plus } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Modal } from '../components/Modal';
import { useToast } from '../hooks/useToast';
import { leadSheetApi } from '../services/api';
import { useSessionsQuery } from '../hooks/queries';
import { idbGet, idbSet } from '../utils/indexedDbStore';

const formatPhoneForDisplay = (p: string) => {
  if (!p) return '';
  const noAt = p.split('@')[0];
  if (noAt.length > 10) {
    return (
      '+' + noAt.substring(0, 1) + ' (' + noAt.substring(1, 4) + ') ' + noAt.substring(4, 7) + '-' + noAt.substring(7)
    );
  }
  return '+' + noAt;
};

type SheetInfo = { id: string; name: string; url: string };

const SHEETS_STORAGE_KEY = 'leadweave_google_sheets';
const ACTIVE_SHEET_KEY = 'leadweave_active_sheet';

export function GoogleSheetsCRM() {
  useDocumentTitle('Google Sheets CRM - LeadWeave');
  const { success, error } = useToast();
  const { data: allSessions = [] } = useSessionsQuery();
  const readySessions = allSessions.filter(s => (s as { status: string; id: string }).status === 'ready');

  // Google Sheets Integration Modal State
  const [showSheetsModal, setShowSheetsModal] = useState(false);
  const [sheetsScript, setSheetsScript] = useState('');
  const [isLoadingScript, setIsLoadingScript] = useState(false);

  // Embedded Google Sheet View State
  const [savedSheets, setSavedSheets] = useState<SheetInfo[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>('');
  const [sheetUrlInput, setSheetUrlInput] = useState('');

  useEffect(() => {
    idbGet<SheetInfo[]>(SHEETS_STORAGE_KEY)
      .then(stored => {
        if (stored && Array.isArray(stored) && stored.length > 0) {
          setSavedSheets(stored);
          idbGet<string>(ACTIVE_SHEET_KEY)
            .then(active => {
              if (active && stored.some(s => s.id === active)) {
                setActiveSheetId(active);
              } else {
                setActiveSheetId(stored[0]?.id || '');
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const activeSheet = savedSheets.find(s => s.id === activeSheetId);

  const handleAddSheet = () => {
    let cleanUrl = sheetUrlInput.trim();
    if (!cleanUrl) return;
    if (cleanUrl.includes('/edit')) {
      cleanUrl = cleanUrl.replace(/(\/edit.*)$/, '/edit?usp=sharing');
    }
    const newSheet = { id: `sheet_${Date.now()}`, name: `Sheet ${savedSheets.length + 1}`, url: cleanUrl };
    const newSheets = [...savedSheets, newSheet];
    setSavedSheets(newSheets);
    setActiveSheetId(newSheet.id);
    idbSet(SHEETS_STORAGE_KEY, newSheets).catch(() => {});
    idbSet(ACTIVE_SHEET_KEY, newSheet.id).catch(() => {});
    setSheetUrlInput('');
    success('Added new Google Sheet');
  };

  const handleRemoveSheet = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSheets = savedSheets.filter(s => s.id !== id);
    setSavedSheets(newSheets);
    idbSet(SHEETS_STORAGE_KEY, newSheets).catch(() => {});
    if (activeSheetId === id) {
      const nextActive = newSheets[0]?.id || '';
      setActiveSheetId(nextActive);
      idbSet(ACTIVE_SHEET_KEY, nextActive).catch(() => {});
    }
    success('Removed sheet');
  };

  // Live CRM Tracked Leads State
  const [trackedLeads, setTrackedLeads] = useState<Record<string, unknown>[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* GOOGLE SHEETS WORKSPACE */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <FileSpreadsheet size={20} className="text-primary" />
              <span>Google Sheet In-App Workspace</span>
            </h2>
            <p className="studio-card-subtitle">
              View, edit, and click-to-message directly from your live Google Sheet inside LeadWeave.
            </p>
          </div>

          <button
            className="btn-tool"
            style={{
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              borderColor: 'rgba(37, 211, 102, 0.3)',
            }}
            onClick={async () => {
              setShowSheetsModal(true);
              setIsLoadingScript(true);
              try {
                const activeSess = readySessions[0]?.id || 'default';
                const res = await leadSheetApi.getAppsScriptTemplate(activeSess);
                setSheetsScript(res.script);
              } catch {
                error('Failed to load Apps Script template');
              } finally {
                setIsLoadingScript(false);
              }
            }}
          >
            <Code size={14} />
            <span>Get Apps Script Code</span>
          </button>
        </div>

        {/* URL Input Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            background: '#0f172a',
            padding: '0.6rem',
            borderRadius: 8,
            border: '1px solid var(--studio-border)',
            marginBottom: '1rem',
          }}
        >
          <Globe size={18} className="text-primary" style={{ marginLeft: '0.35rem' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Paste Google Sheet URL to add a new sheet..."
            value={sheetUrlInput}
            onChange={e => setSheetUrlInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddSheet()}
            style={{ flex: 1, background: 'transparent', border: 'none', color: '#f8fafc', fontSize: '0.8125rem' }}
          />
          <button className="btn-tool btn-primary" onClick={handleAddSheet} style={{ padding: '0.45rem 1rem' }}>
            <Plus size={16} />
            <span>Add Sheet</span>
          </button>
        </div>

        {/* Sheet Tabs */}
        {savedSheets.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              marginBottom: '1rem',
              paddingBottom: '0.25rem',
            }}
          >
            {savedSheets.map(sheet => (
              <div
                key={sheet.id}
                onClick={() => {
                  setActiveSheetId(sheet.id);
                  localStorage.setItem('leadweave_active_sheet', sheet.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.85rem',
                  background: activeSheetId === sheet.id ? 'var(--primary-soft)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeSheetId === sheet.id ? 'rgba(37, 211, 102, 0.4)' : 'var(--studio-border)'}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: activeSheetId === sheet.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: activeSheetId === sheet.id ? 600 : 400,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <FileSpreadsheet size={14} className={activeSheetId === sheet.id ? 'text-primary' : ''} />
                <span>{sheet.name}</span>
                <button
                  onClick={e => handleRemoveSheet(sheet.id, e)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    padding: 2,
                    cursor: 'pointer',
                    opacity: 0.6,
                  }}
                  title="Remove Sheet"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Embedded iframe Container */}
        {activeSheet ? (
          <div
            style={{
              width: '100%',
              height: '650px',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--studio-border)',
              background: '#ffffff',
            }}
          >
            <iframe
              src={activeSheet.url}
              title="LeadWeave Embedded Google Sheet"
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : (
          <div
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.01)',
              borderRadius: 8,
              border: '1px dashed var(--studio-border)',
            }}
          >
            <FileSpreadsheet size={40} color="#64748b" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>No Google Sheet connected</h3>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', maxWidth: 450, margin: '0.25rem auto 1.5rem' }}>
              Paste your Google Spreadsheet URL above to view, edit, and click-to-message leads inside LeadWeave.
            </p>
          </div>
        )}
      </div>

      {/* LIVE CRM LEAD PIPELINE */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <Users2 size={20} className="text-primary" />
              <span>Live CRM Lead Pipeline</span>
            </h2>
            <p className="studio-card-subtitle">
              Live tracking of verified leads, greetings, STOP opt-outs, and 20h W-RNR timeouts.
            </p>
          </div>

          <button
            className="btn-tool"
            onClick={async () => {
              setIsLoadingLeads(true);
              try {
                const activeSess = readySessions[0]?.id;
                const res = await leadSheetApi.getLeads({ sessionId: activeSess });
                setTrackedLeads(res || []);
                success('Refreshed pipeline');
              } catch {
                error('Failed to refresh CRM leads');
              } finally {
                setIsLoadingLeads(false);
              }
            }}
          >
            <RefreshCw size={14} className={isLoadingLeads ? 'spin-icon' : ''} />
            <span>Refresh Pipeline</span>
          </button>
        </div>

        {isLoadingLeads ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 size={28} className="spin-icon text-primary" />
          </div>
        ) : trackedLeads.length === 0 ? (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              background: 'rgba(255,255,255,0.01)',
              borderRadius: 8,
              border: '1px dashed var(--studio-border)',
            }}
          >
            <Users2 size={36} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>No tracked leads in pipeline yet</h3>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: '0.25rem 0' }}>
              Trigger leads from your Google Sheet or launch a broadcast campaign to track lead responses.
            </p>
          </div>
        ) : (
          <div className="spreadsheet-grid-wrapper">
            <table className="spreadsheet-grid-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                  <th>Lead Name</th>
                  <th>Phone / WhatsApp</th>
                  <th>Status</th>
                  <th>Last Sent</th>
                  <th>Replied At</th>
                  <th>20h Timeout</th>
                </tr>
              </thead>
              <tbody>
                {trackedLeads.map((lead, idx) => (
                  <tr key={lead.id}>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <strong style={{ color: '#f8fafc' }}>{lead.leadName || 'Lead'}</strong>
                    </td>
                    <td>
                      <code style={{ color: '#38bdf8' }}>{formatPhoneForDisplay(lead.phoneNumber)}</code>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: 4,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background:
                            lead.status === 'REPLIED'
                              ? 'rgba(34, 197, 94, 0.15)'
                              : lead.status === 'OPT_OUT'
                                ? 'rgba(239, 68, 68, 0.15)'
                                : lead.status === 'W-RNR'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                          color:
                            lead.status === 'REPLIED'
                              ? '#22c55e'
                              : lead.status === 'OPT_OUT'
                                ? '#ef4444'
                                : lead.status === 'W-RNR'
                                  ? '#f59e0b'
                                  : '#3b82f6',
                        }}
                      >
                        {lead.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {lead.lastSentAt ? new Date(lead.lastSentAt).toLocaleTimeString() : '-'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {lead.repliedAt ? new Date(lead.repliedAt).toLocaleTimeString() : '-'}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {lead.timeoutAt ? new Date(lead.timeoutAt).toLocaleTimeString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPS SCRIPT MODAL */}
      {showSheetsModal && (
        <Modal
          open={showSheetsModal}
          onClose={() => setShowSheetsModal(false)}
          title="Google Sheets 2-Way CRM Integration"
          className="wide-modal"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5 }}>
              Connect your Google Sheet directly to LeadWeave. Sales reps can click any row to verify WhatsApp
              registration, trigger personalized greetings, auto-handle <strong>STOP</strong> opt-outs, and track{' '}
              <strong>20h W-RNR</strong> timeouts!
            </p>

            {isLoadingScript ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 size={24} className="spin-icon text-primary" />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#0b141a',
                    borderRadius: 8,
                    border: '1px solid var(--studio-border)',
                    overflow: 'hidden',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: '1rem',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: '#22c55e',
                      overflowY: 'auto',
                      maxHeight: '350px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {sheetsScript}
                  </pre>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn-tool btn-primary"
                    style={{ padding: '0.6rem 1.25rem', fontSize: '0.875rem' }}
                    onClick={() => {
                      navigator.clipboard.writeText(sheetsScript);
                      success('Apps Script code copied to clipboard!');
                    }}
                  >
                    <span>Copy Script</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
