import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, Webhook, Activity, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import {
  useSessionsQuery,
  useSessionStatsQuery,
  useWebhooksQuery,
  useStopSessionMutation,
  useStatsOverviewQuery,
  useSessionSpecificStatsQuery,
} from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import { SciFiGauges } from '../components/SciFiGauges';
import type { Session } from '../services/api';
import './Dashboard.css';

function SessionGaugeBlock({ session }: { session: Session }) {
  const { data: stats } = useSessionSpecificStatsQuery(session.id);

  return (
    <div className="session-gauge-block">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {session.name}
        <span className={`status-pill ${session.status}`}>{session.status}</span>
      </h3>
      
      <SciFiGauges
        messagesSentToday={stats?.messages?.today ?? 0}
        dailyMessageLimit={5000}
        usersReachedToday={stats?.messages?.today ?? 0}
        dailyUserLimit={2500}
        currentMsgsPerMin={0}
        maxMessagesPerMinute={30}
      />
    </div>
  );
}

export function Dashboard() {
  const { t } = useTranslation();
  useDocumentTitle(t('dashboard.title'));
  const navigate = useNavigate();
  const { data: sessions = [], isLoading: loadingSessions, error: sessionsError } = useSessionsQuery();
  
  const { data: stats } = useSessionStatsQuery();
  const { data: webhooks = [] } = useWebhooksQuery();
  
  // /stats/overview is ADMIN-only; for a non-admin key it 403s → overview stays undefined and the
  // message cards fall back to '—' without breaking the (un-gated) session cards.
  const { data: statsOverview } = useStatsOverviewQuery();
  const stopMutation = useStopSessionMutation();
  
  const loading = loadingSessions;
  const error =
    sessionsError instanceof Error ? sessionsError.message : sessionsError ? t('dashboard.loadError') : null;
  const webhookCount = webhooks.length;

  const handleDisconnect = async (id: string) => {
    try {
      await stopMutation.mutateAsync(id);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const messagesToday = statsOverview?.messages?.today ? statsOverview.messages.today.sent + statsOverview.messages.today.received : '—';
  const totalMessages = statsOverview?.messages ? statsOverview.messages.sent + statsOverview.messages.received : '—';

  const globalStatsCards = [
    {
      label: t('dashboard.stats.activeSessions'),
      value: stats?.ready ?? 0,
      icon: MessageSquare,
      detail: stats ? t('dashboard.stats.sessionsDetail', { running: stats.active, total: stats.total }) : undefined,
    },
    { label: t('dashboard.stats.webhooksConfigured'), value: webhookCount, icon: Webhook },
    { label: t('dashboard.stats.messagesToday'), value: messagesToday, icon: Send },
    { label: t('dashboard.stats.totalMessages'), value: totalMessages, icon: Activity },
  ];

  const formatLastActive = (date?: string | null) => {
    if (!date) return t('common.never');
    const diff = Date.now() - new Date(date).getTime();
    if (diff < 60000) return t('common.justNow');
    if (diff < 3600000) return t('common.minAgo', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('common.hoursAgo', { count: Math.floor(diff / 3600000) });
    return new Date(date).toLocaleDateString();
  };

  const formatStatus = (status: string) => t(`sessionStatus.${status}`, { defaultValue: status });

  if (loading) {
    return (
      <div
        className="dashboard"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}
      >
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard" style={{ padding: '2rem' }}>
        <div
          style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '1rem', borderRadius: '8px', color: 'var(--error)' }}
        >
          {t('dashboard.errorPrefix', { message: error })}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        badge={
          <span className={`status-badge ${stats && stats.ready > 0 ? 'connected' : 'disconnected'}`}>
            {stats && stats.ready > 0 ? t('common.connected') : t('common.disconnected')}
          </span>
        }
      />

      {/* Global Summary Stats */}
      <div className="stats-grid">
        {globalStatsCards.map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="stat-card">
            <Icon className="stat-watermark" />
            <div className="stat-header">
              <span className="stat-label">{label}</span>
              <Icon size={20} className="stat-icon" />
            </div>
            <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            {detail && <div className="stat-detail">{detail}</div>}
          </div>
        ))}
      </div>

      <section className="sessions-overview-section" style={{ marginTop: '3rem' }}>
        <div className="section-header">
          <h2>{t('dashboard.sessionsOverview')}</h2>
        </div>

        {sessions.length === 0 ? (
          <div className="table-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
            {t('dashboard.noSessions')}
          </div>
        ) : (
          <div className="session-dashboard-cards">
            {sessions.map(session => (
              <SessionGaugeBlock key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      {/* Old Table view below if needed, but we can replace it or keep it. Let's keep it below the cards */}
      <section className="sessions-section" style={{ marginTop: '3rem' }}>
        <div className="section-header">
          <h2>Session Details Table</h2>
        </div>
        <div className="sessions-table">
          <div className="table-header">
            <span>{t('dashboard.columns.sessionId')}</span>
            <span>{t('dashboard.columns.phone')}</span>
            <span>{t('dashboard.columns.status')}</span>
            <span>{t('dashboard.columns.lastActive')}</span>
            <span>{t('dashboard.columns.actions')}</span>
          </div>
          {sessions.length === 0 ? (
            <div className="table-row" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
              {t('dashboard.noSessions')}
            </div>
          ) : (
            sessions.map(session => (
              <div key={session.id} className="table-row">
                <div className="session-info-cell">
                  <span className="session-id">{session.id.substring(0, 12)}</span>
                  <span className="session-name" title={session.name}>
                    {session.name}
                  </span>
                </div>
                <span className="phone">{session.phone || '—'}</span>
                <span className={`status-pill ${session.status}`}>{formatStatus(session.status)}</span>
                <span className="last-active">{formatLastActive(session.lastActive)}</span>
                <div className="actions">
                  <button className="btn-sm" onClick={() => navigate('/sessions')}>
                    {t('dashboard.view')}
                  </button>
                  {['ready', 'initializing', 'qr_ready'].includes(session.status) && (
                    <button className="btn-sm danger" onClick={() => handleDisconnect(session.id)}>
                      {t('dashboard.disconnect')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
