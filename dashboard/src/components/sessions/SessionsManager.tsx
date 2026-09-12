import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import {
  Plus,
  QrCode,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
  Play,
  Square,
  Search,
  Skull,
  Unlink,
} from 'lucide-react';
import { sessionApi, type Session, type SessionConfig, type AccountRestriction } from '../../services/api';
import { queryKeys } from '../../hooks/queries';
import {
  canForceKillSession,
  canUnlinkSession,
  classifyUnlinkError,
  isSessionStarted,
  replaceSession,
} from '../../utils/sessionActions';
import { invalidateSessionQueries, reconcileSessionCache } from '../../utils/sessionMutation';
import { canCreateSession, filterSessions, isValidPairingPhone, sessionNameIssues } from '../../utils/sessionForm';
import { useToast } from '../../hooks/useToast';
import { useRole } from '../../hooks/useRole';
import { useSessionPairing } from '../../hooks/useSessionPairing';
import type { TFunction } from 'i18next';
import { useSessionFeed } from '../../hooks/useSessionFeed';
import { useSessionCreateForm } from '../../hooks/useSessionCreateForm';
import { Modal } from '../Modal';
import './SessionsManager.css';

function restrictionTitle(restriction: AccountRestriction, t: TFunction): string {
  const parts = [t(`sessions.restriction.${restriction.kind}`), restriction.code];
  if (restriction.expiresAt) {
    parts.push(t('sessions.restriction.until', { date: new Date(restriction.expiresAt).toLocaleString() }));
  }
  return parts.join(' · ');
}

export interface SessionsManagerProps {
  onSessionSelect?: (sessionId: string) => void;
  selectedSessionId?: string;
  className?: string;
  standalone?: boolean;
  onSessionsChange?: (sessions: Session[]) => void;
}

export function SessionsManager({
  onSessionSelect,
  selectedSessionId: activeSessionId,
  className = '',
  standalone = true,
  onSessionsChange,
}: SessionsManagerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [killConfirmId, setKillConfirmId] = useState<string | null>(null);
  const [unlinkConfirmId, setUnlinkConfirmId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchSessions = useCallback(async (): Promise<Session[]> => {
    try {
      if (!initialLoadDone.current) setLoading(true);
      const data = await sessionApi.list();
      setSessions(data);
      void invalidateSessionQueries(queryClient, queryKeys.sessions);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('sessions.create.errorDefault'));
      return [];
    } finally {
      initialLoadDone.current = true;
      setLoading(false);
    }
  }, [t, queryClient]);

  const sessionsRef = useRef<Session[]>([]);
  const onSessionsChangeRef = useRef(onSessionsChange);
  useEffect(() => {
    onSessionsChangeRef.current = onSessionsChange;
  }, [onSessionsChange]);
  const lastEmittedSignatureRef = useRef<string>('');

  useEffect(() => {
    sessionsRef.current = sessions;
    const sig = sessions.map(s => `${s.id}:${s.status}:${s.phone || ''}`).join('|');
    if (lastEmittedSignatureRef.current !== sig) {
      lastEmittedSignatureRef.current = sig;
      onSessionsChangeRef.current?.(sessions);
    }
  }, [sessions]);

  const {
    qrData,
    pairingMode,
    phoneNumber,
    pairingCode,
    requestingPairing,
    pairingError,
    setPhoneNumber,
    selectPairingTab,
    handleChangeNumber,
    handleGeneratePairingCode,
    handleShowQR,
    handleCloseQRModal,
    applyQrPush,
    dismissQrForSession,
  } = useSessionPairing({ sessions, sessionsRef, reloadSessions: fetchSessions });

  const { showCreateModal, setShowCreateModal, newSessionName, setNewSessionName, creating, handleCreate } =
    useSessionCreateForm({
      onCreated: newSession => {
        setSessions(current => [...current, newSession]);
        void invalidateSessionQueries(queryClient, queryKeys.sessions);
      },
      onFailed: msg => setError(msg),
    });

  const applySessionResponse = useCallback(
    async (updated: Session) => {
      sessionsRef.current = replaceSession(sessionsRef.current, updated);
      setSessions(sessionsRef.current);
      setSelectedSession(current => (current?.id === updated.id ? updated : current));
      dismissQrForSession(updated.id);
      await reconcileSessionCache(queryClient, queryKeys.sessions, updated);
    },
    [queryClient, dismissQrForSession],
  );

  useSessionFeed({
    sessions,
    sessionsRef,
    onQRCode: applyQrPush,
    onSessionRestriction: useCallback(() => {
      void fetchSessions();
    }, [fetchSessions]),
    onSessionStatus: useCallback(
      (event: { sessionId: string; status: string }) => {
        const prev = sessionsRef.current.find(s => s.id === event.sessionId);
        if (prev && prev.status === event.status) return;
        sessionsRef.current = sessionsRef.current.map(s =>
          s.id === event.sessionId ? { ...s, status: event.status as Session['status'], engineLoaded: undefined } : s,
        );
        setSessions(sessionsRef.current);
        void invalidateSessionQueries(queryClient, queryKeys.sessions);
        if (event.status === 'ready') {
          toast.success(t('sessions.toasts.readyTitle'), t('sessions.toasts.readyDesc'));
        } else if (event.status === 'disconnected') {
          void fetchSessions();
          toast.warning(t('sessions.toasts.disconnectedTitle'), t('sessions.toasts.disconnectedDesc'));
        } else if (event.status === 'action_required') {
          void fetchSessions();
          toast.warning(t('sessions.toasts.actionRequiredTitle'), t('sessions.toasts.actionRequiredDesc'));
        } else if (event.status === 'failed') {
          void fetchSessions();
          toast.error(t('sessions.toasts.failedTitle'), t('sessions.toasts.failedDesc'));
        }
      },
      [toast, t, fetchSessions, queryClient],
    ),
  });

  useEffect(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try {
      await sessionApi.delete(id);
      setSessions(current => current.filter(s => s.id !== id));
      await invalidateSessionQueries(queryClient, queryKeys.sessions);
      toast.success(
        t('sessions.delete.successTitle'),
        session
          ? t('sessions.delete.successDescNamed', { name: session.name })
          : t('sessions.delete.successDescGeneric'),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('sessions.delete.errorDefault');
      console.error('Failed to delete:', err);
      toast.error(t('sessions.delete.errorTitle'), msg);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStart = async (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session && ['initializing', 'qr_ready'].includes(session.status)) {
      handleShowQR(id);
      return;
    }

    try {
      const started = await sessionApi.start(id);
      setSessions(current => replaceSession(current, started));
      await fetchSessions();
      if (['qr_ready', 'initializing'].includes(started.status)) {
        handleShowQR(id);
      }
    } catch (err) {
      console.error('Failed to start:', err);
      const code = (err as { code?: string } | null | undefined)?.code;
      if (code === 'SESSION_NAME_TEARDOWN_PENDING') {
        const msg = err instanceof Error && err.message ? err.message : t('sessions.start.teardownPending');
        toast.warning(t('sessions.start.teardownPendingTitle'), msg);
        await fetchSessions();
        return;
      }
      const fresh = await fetchSessions();
      const current = fresh.find(s => s.id === id);
      if (current && ['qr_ready', 'initializing'].includes(current.status)) handleShowQR(id);
    }
  };

  const selectedSessionId = selectedSession?.id ?? null;
  useEffect(() => {
    setSessionConfig(null);
    if (!selectedSessionId) return;
    let cancelled = false;
    sessionApi
      .getConfig(selectedSessionId)
      .then(cfg => {
        if (!cancelled) setSessionConfig(cfg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  const handleAutoRejectToggle = async (next: boolean) => {
    if (!selectedSessionId || !sessionConfig) return;
    const previous = sessionConfig;
    setSessionConfig({ ...sessionConfig, autoRejectCalls: next });
    setSavingConfig(true);
    try {
      setSessionConfig(await sessionApi.updateConfig(selectedSessionId, { autoRejectCalls: next }));
    } catch (err) {
      setSessionConfig(previous);
      toast.error(t('sessions.details.autoRejectCalls'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleStop = async (id: string) => {
    try {
      const updated = await sessionApi.stop(id);
      await applySessionResponse(updated);
    } catch (err) {
      console.error('Failed to stop:', err);
      await fetchSessions();
    }
  };

  const handleForceKill = async (id: string) => {
    try {
      const updated = await sessionApi.forceKill(id);
      await applySessionResponse(updated);
      toast.success(t('sessions.forceKill.successTitle'), t('sessions.forceKill.success'));
    } catch (err) {
      console.error('Failed to force-kill:', err);
      toast.error(t('sessions.forceKill.failedTitle'), t('sessions.forceKill.failed'));
      await fetchSessions();
    } finally {
      setKillConfirmId(null);
    }
  };

  const handleUnlink = async (id: string) => {
    if (unlinkingId) return;
    setUnlinkingId(id);
    try {
      const updated = await sessionApi.logout(id);
      await applySessionResponse(updated);
      toast.success(t('sessions.unlink.successTitle'), t('sessions.unlink.success'));
    } catch (err) {
      console.error('Failed to unlink:', err);
      await fetchSessions();
      if (classifyUnlinkError(err) === 'incomplete') {
        const msg = err instanceof Error && err.message ? err.message : t('sessions.unlink.incomplete');
        toast.warning(t('sessions.unlink.incompleteTitle'), msg);
      } else {
        toast.error(t('sessions.unlink.failedTitle'), t('sessions.unlink.failed'));
      }
    } finally {
      setUnlinkConfirmId(null);
      setUnlinkingId(null);
    }
  };

  const formatLastActive = (date?: string | null) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  const filteredSessions = filterSessions(sessions, searchQuery, statusFilter);
  const existingSessionNames = sessions.map(s => s.name);
  const nameIssues = newSessionName ? sessionNameIssues(newSessionName, existingSessionNames) : [];

  if (loading) {
    return (
      <div className={`sessions-manager-wrapper ${className}`}>
        <div className="sessions-manager-loading">
          <Loader2 className="animate-spin" size={32} />
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`sessions-manager-wrapper ${standalone ? 'standalone-layout' : 'embedded-layout'} ${className}`}>
      {/* LEFT SIDE: Big Hero Title & Description (when standalone /sessions page) */}
      {standalone && (
        <div className="sessions-hero-left">
          <div className="sessions-hero-content">
            <h1 className="sessions-hero-title">Sessions</h1>
            <p className="sessions-hero-subtitle">{t('sessions.subtitle')}</p>
            <div className="sessions-hero-stat-pill">
              <span className="sessions-stat-dot" />
              <span>{sessions.length} {t('sessions.title', 'Sessions')} Connected</span>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SIDE: Controls, Filter pills, New Session button, and Session Cards */}
      <div className="sessions-pane-right">
        <div className="sessions-right-top-bar">
          <div className="sessions-search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder={t('sessions.searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="sessions-filter-pills" role="tablist">
            {[
              { value: 'all', label: t('sessions.filter.all') },
              { value: 'active', label: t('sessions.filter.active') },
              { value: 'inactive', label: t('sessions.filter.inactive') },
              { value: 'connecting', label: t('sessions.filter.connecting') },
            ].map(tab => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.value}
                className={`sessions-filter-pill ${statusFilter === tab.value ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {canWrite && (
            <button className="btn-primary sessions-new-btn" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} />
              {t('sessions.newSession')}
            </button>
          )}
        </div>

        {error && (
          <div className="sessions-error-banner">
            {error}
          </div>
        )}

        {/* Grid of obsidian glass session cards */}
        <div className="sessions-obsidian-grid">
        {filteredSessions.length === 0 ? (
          <div className="sessions-empty-glass">
            <QrCode size={48} className="empty-icon" />
            <h3>{t('sessions.empty.title')}</h3>
            <p>{t('sessions.empty.description')}</p>
            {canWrite && (
              <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ marginTop: '1rem' }}>
                <Plus size={16} />
                {t('sessions.newSession')}
              </button>
            )}
          </div>
        ) : (
          filteredSessions.map(session => {
            const isCurrentActive = activeSessionId === session.id;
            return (
              <div
                key={session.id}
                className={`session-glass-card session-card ${session.status} ${isCurrentActive ? 'selected-active-session' : ''}`}
                onClick={() => onSessionSelect?.(session.id)}
              >
                <div className="card-glass-header">
                  <div className="card-session-title">
                    <span className={`session-status-led ${session.status}`} />
                    <h3 title={session.name}>{session.name}</h3>
                  </div>
                  <span className={`status-tag status-${session.status}`}>{formatStatus(session.status)}</span>
                </div>

                {session.status === 'initializing' || session.status === 'qr_ready' ? (
                  <div className="card-qr-banner">
                    <QrCode size={48} className="qr-preview-icon" />
                    <p>{session.status === 'qr_ready' ? t('sessions.qr.scanToConnect') : t('sessions.qr.preparing')}</p>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={e => {
                        e.stopPropagation();
                        handleShowQR(session.id);
                      }}
                      disabled={session.status !== 'qr_ready'}
                    >
                      {session.status === 'qr_ready' ? t('sessions.qr.showQr') : t('sessions.qr.loading')}
                    </button>
                  </div>
                ) : (
                  <div className="card-specs-list">
                    <div className="spec-row">
                      <span className="spec-label">{t('sessions.card.phone')}</span>
                      <span className="spec-value">{session.phone || '—'}</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">{t('sessions.card.sessionId')}</span>
                      <span className="spec-value">{session.name || session.phone || session.id}</span>
                    </div>
                    <div className="spec-row">
                      <span className="spec-label">{t('sessions.card.lastActive')}</span>
                      <span className="spec-value">{formatLastActive(session.lastActive)}</span>
                    </div>
                    {(session.status === 'failed' || session.status === 'action_required') && session.lastError ? (
                      <div className="spec-row error-row">
                        <span className="spec-label">{t('sessions.card.error')}</span>
                        <span className="spec-value error-text" title={session.lastError}>
                          {session.lastError}
                        </span>
                      </div>
                    ) : null}
                    {session.restriction ? (
                      <div className="spec-row restriction-row">
                        <span className="spec-label">{t('sessions.card.restriction')}</span>
                        <span className="spec-value restriction-text" title={restrictionTitle(session.restriction, t)}>
                          {t(`sessions.restriction.${session.restriction.kind}`)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="card-actions-cluster">
                  <button
                    type="button"
                    className="glass-action-btn"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedSession(session);
                    }}
                    title={t('sessions.actions.view')}
                  >
                    <Eye size={15} />
                    <span>{t('sessions.actions.view')}</span>
                  </button>

                  {canWrite && isSessionStarted(session) ? (
                    <button
                      type="button"
                      className="glass-action-btn"
                      onClick={e => {
                        e.stopPropagation();
                        void handleStop(session.id);
                      }}
                      title={t('sessions.actions.stop')}
                    >
                      <Square size={15} />
                      <span>{t('sessions.actions.stop')}</span>
                    </button>
                  ) : canWrite && (session.status === 'created' || session.status === 'disconnected') ? (
                    <button
                      type="button"
                      className="glass-action-btn primary"
                      onClick={e => {
                        e.stopPropagation();
                        void handleStart(session.id);
                      }}
                      title={t('sessions.actions.start')}
                    >
                      <Play size={15} />
                      <span>{t('sessions.actions.start')}</span>
                    </button>
                  ) : canWrite ? (
                    <button
                      type="button"
                      className="glass-action-btn primary"
                      onClick={e => {
                        e.stopPropagation();
                        void handleStart(session.id);
                      }}
                      title={t('sessions.actions.reconnect')}
                    >
                      <RefreshCw size={15} />
                      <span>{t('sessions.actions.reconnect')}</span>
                    </button>
                  ) : null}

                  {canUnlinkSession(session, canWrite) && (
                    <button
                      type="button"
                      className="glass-action-btn danger"
                      onClick={e => {
                        e.stopPropagation();
                        setUnlinkConfirmId(session.id);
                      }}
                      title={t('sessions.actions.unlink')}
                    >
                      <Unlink size={15} />
                      <span>{t('sessions.actions.unlink')}</span>
                    </button>
                  )}

                  {canWrite && (
                    <button
                      type="button"
                      className="glass-action-btn danger"
                      onClick={e => {
                        e.stopPropagation();
                        setDeleteConfirmId(session.id);
                      }}
                      title={t('sessions.actions.delete')}
                      aria-label={t('sessions.actions.delete')}
                    >
                      <Trash2 size={15} />
                      <span>{t('sessions.actions.delete')}</span>
                    </button>
                  )}

                  {canForceKillSession(session, canWrite) && (
                    <button
                      type="button"
                      className="glass-action-btn danger"
                      onClick={e => {
                        e.stopPropagation();
                        setKillConfirmId(session.id);
                      }}
                      title={t('sessions.actions.killStuck')}
                      aria-label={t('sessions.actions.killStuck')}
                    >
                      <Skull size={15} />
                      <span>{t('sessions.actions.killStuck')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>

      {/* CREATE SESSION MODAL */}
      {showCreateModal && (
        <Modal
          open
          onClose={() => setShowCreateModal(false)}
          title={t('sessions.create.title')}
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-primary"
                onClick={handleCreate}
                disabled={creating || !canCreateSession(newSessionName, existingSessionNames)}
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : t('common.create')}
              </button>
            </>
          }
        >
          <label htmlFor="sess-1">{t('sessions.create.label')}</label>
          <input
            id="sess-1"
            type="text"
            placeholder={t('sessions.create.placeholder')}
            value={newSessionName}
            onChange={e => {
              const value = e.target.value.toLowerCase().replace(/\s+/g, '-');
              setNewSessionName(value);
            }}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <p className="input-hint">
            <Trans i18nKey="sessions.create.hint" components={{ code: <code /> }} />
          </p>
          {nameIssues.includes('format') && <p className="input-error">{t('sessions.create.invalidChars')}</p>}
          {nameIssues.includes('too-long') && (
            <p className="input-error">{t('sessions.create.tooLong', { length: newSessionName.length })}</p>
          )}
          {nameIssues.includes('duplicate') && <p className="input-error">{t('sessions.create.duplicate')}</p>}
        </Modal>
      )}

      {/* QR / PHONE PAIRING MODAL */}
      {qrData && (
        <Modal
          open
          onClose={handleCloseQRModal}
          className="qr-modal"
          closeLabel={t('common.close')}
          title={
            <span className="modal-title">
              {pairingMode ? t('sessions.pairing.tabPhone') : t('sessions.qr.title')}
              <span className="session-name" style={{ marginLeft: '6px', color: 'var(--text-secondary, #94a3b8)', fontWeight: 'normal' }}>
                - {qrData.sessionName}
              </span>
            </span>
          }
        >
          <div className="qr-horizontal-layout">
            <div className="qr-left-pane">
              {!pairingMode ? (
                qrData.qrCode ? (
                  <div className="qr-code-wrapper">
                    <img src={qrData.qrCode} alt="QR" style={{ maxWidth: '240px', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={48} />
                    <p>
                      {(() => {
                        const sess = sessions.find(s => s.id === qrData.sessionId);
                        if (sess && (sess.status === 'authenticating' || sess.status === 'initializing')) {
                          return t('sessions.qr.authenticating', 'Authenticating connection...');
                        }
                        return t('sessions.qr.generating', 'Generating QR code...');
                      })()}
                    </p>
                  </div>
                )
              ) : (
                <div className="pairing-container" role="tabpanel" style={{ width: '100%', maxWidth: '300px' }}>
                  {pairingError && <div className="pairing-error">{pairingError}</div>}

                  {!pairingCode ? (
                    <div className="pairing-form">
                      <label htmlFor="pairing-phone" className="pairing-label">
                        {t('sessions.pairing.phoneLabel')}
                      </label>
                      <input
                        id="pairing-phone"
                        className="pairing-input"
                        type="tel"
                        inputMode="numeric"
                        maxLength={15}
                        placeholder={t('sessions.pairing.phonePlaceholder')}
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && handleGeneratePairingCode()}
                      />
                      <p className="input-hint" style={{ marginBottom: '1.5rem' }}>
                        {t('sessions.pairing.phoneHint')}
                      </p>
                      <button
                        className="btn-primary"
                        onClick={handleGeneratePairingCode}
                        disabled={requestingPairing || !isValidPairingPhone(phoneNumber)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        {requestingPairing ? (
                          <>
                            <Loader2 className="animate-spin" size={16} />
                            <span style={{ marginLeft: '0.5rem' }}>{t('sessions.pairing.generating')}</span>
                          </>
                        ) : (
                          t('sessions.pairing.generateButton')
                        )}
                      </button>
                    </div>
                  ) : (
                    <>
                      <label style={{ display: 'block', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        {t('sessions.pairing.codeLabel')}
                      </label>
                      <div className="pairing-code-display">
                        {pairingCode.substring(0, 4)} - {pairingCode.substring(4)}
                      </div>
                      
                      <div style={{ marginTop: '1.5rem' }}>
                        <button className="btn-secondary" onClick={handleChangeNumber} style={{ width: '100%' }}>
                          {t('sessions.pairing.changeNumber')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="qr-right-pane">
              {!pairingCode && (
                <div className="pairing-tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={!pairingMode}
                    className={`pairing-tab-btn ${!pairingMode ? 'active' : ''}`}
                    onClick={() => selectPairingTab(false)}
                  >
                    {t('sessions.pairing.tabQr')}
                  </button>
                  <button
                    role="tab"
                    aria-selected={pairingMode}
                    className={`pairing-tab-btn ${pairingMode ? 'active' : ''}`}
                    onClick={() => selectPairingTab(true)}
                  >
                    {t('sessions.pairing.tabPhone')}
                  </button>
                </div>
              )}

              {!pairingMode ? (
                <>
                  <div className="qr-instructions">
                    <p className="qr-step">
                      <Trans i18nKey="sessions.qr.step1" components={{ strong: <strong /> }} />
                    </p>
                    <p className="qr-step">
                      <Trans i18nKey="sessions.qr.step2" components={{ strong: <strong /> }} />
                    </p>
                    <p className="qr-step">
                      <Trans i18nKey="sessions.qr.step3" components={{ strong: <strong /> }} />
                    </p>
                  </div>
                  <p className="qr-auto-refresh" style={{ marginTop: 'auto' }}>
                    <RefreshCw size={14} className="spin-slow" /> {t('sessions.qr.autoRefresh')}
                  </p>
                </>
              ) : (
                <>
                  {pairingCode ? (
                    <div className="qr-instructions">
                      <p className="pairing-instructions-title">{t('sessions.pairing.instructions')}</p>
                      <p className="qr-step">
                        <Trans i18nKey="sessions.pairing.step1" components={{ strong: <strong /> }} />
                      </p>
                      <p className="qr-step">
                        <Trans i18nKey="sessions.pairing.step2" components={{ strong: <strong /> }} />
                      </p>
                      <p className="qr-step">
                        <Trans i18nKey="sessions.pairing.step3" components={{ strong: <strong /> }} />
                      </p>
                      <p className="qr-step">
                        <Trans i18nKey="sessions.pairing.step4" components={{ strong: <strong /> }} />
                      </p>
                    </div>
                  ) : null}
                  <p className="qr-auto-refresh" style={{ marginTop: pairingCode ? 'auto' : '0' }}>
                    <RefreshCw size={14} className="spin-slow" /> {t('sessions.pairing.waitingConnection')}
                  </p>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* SESSION DETAILS MODAL */}
      {selectedSession && (
        <Modal
          open
          onClose={() => setSelectedSession(null)}
          title={t('sessions.details.title')}
          closeLabel={t('common.close')}
          footer={
            <button className="btn-secondary" onClick={() => setSelectedSession(null)}>
              {t('common.close')}
            </button>
          }
        >
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.name')}</span>
              <span className="detail-value">{selectedSession.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.status')}</span>
              <span className={`status-tag status-${selectedSession.status}`}>{formatStatus(selectedSession.status)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.sessionId')}</span>
              <span className="detail-value mono">{selectedSession.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.phone')}</span>
              <span className="detail-value">{selectedSession.phone || t('sessions.details.phoneNone')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.created')}</span>
              <span className="detail-value">{new Date(selectedSession.createdAt).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">{t('sessions.details.lastActive')}</span>
              <span className="detail-value">
                {selectedSession.lastActive ? new Date(selectedSession.lastActive).toLocaleString() : t('common.never')}
              </span>
            </div>
            {sessionConfig && (
              <div className="detail-item detail-item-toggle">
                <div className="detail-toggle-row">
                  <span className="detail-label" id="auto-reject-calls-label">
                    {t('sessions.details.autoRejectCalls')}
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      aria-labelledby="auto-reject-calls-label"
                      checked={sessionConfig.autoRejectCalls}
                      disabled={!canWrite || savingConfig}
                      onChange={e => void handleAutoRejectToggle(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <small className="detail-hint">{t('sessions.details.autoRejectCallsHint')}</small>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* CONFIRMATION MODALS */}
      {deleteConfirmId && (
        <Modal
          open
          onClose={() => setDeleteConfirmId(null)}
          title={t('sessions.delete.title')}
          className="confirm-modal"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirmId)}>
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>
            <Trans
              i18nKey="sessions.delete.message"
              values={{ name: sessions.find(s => s.id === deleteConfirmId)?.name }}
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-muted">{t('sessions.delete.warning')}</p>
        </Modal>
      )}

      {killConfirmId && (
        <Modal
          open
          onClose={() => setKillConfirmId(null)}
          title={t('sessions.forceKill.title')}
          className="confirm-modal"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setKillConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={() => handleForceKill(killConfirmId)}>
                {t('sessions.forceKill.confirm')}
              </button>
            </>
          }
        >
          <p>
            <Trans
              i18nKey="sessions.forceKill.message"
              values={{ name: sessions.find(s => s.id === killConfirmId)?.name }}
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-muted">{t('sessions.forceKill.warning')}</p>
        </Modal>
      )}

      {unlinkConfirmId && (
        <Modal
          open
          onClose={() => setUnlinkConfirmId(null)}
          title={t('sessions.unlink.title')}
          className="confirm-modal"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setUnlinkConfirmId(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn-danger"
                onClick={() => handleUnlink(unlinkConfirmId)}
                disabled={unlinkingId !== null}
              >
                {t('sessions.unlink.confirm')}
              </button>
            </>
          }
        >
          <p>
            <Trans
              i18nKey="sessions.unlink.message"
              values={{ name: sessions.find(s => s.id === unlinkConfirmId)?.name }}
              components={{ strong: <strong /> }}
            />
          </p>
          <p className="text-muted">{t('sessions.unlink.warning')}</p>
        </Modal>
      )}
    </div>
  );
}

export default SessionsManager;
