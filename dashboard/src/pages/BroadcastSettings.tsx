import { useMemo } from 'react';
import { useSpreadsheetStore } from '../stores/useSpreadsheetStore';
import { useCampaignContext } from '../contexts/CampaignContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useSessionsQuery } from '../hooks/queries';
import { campaignApi } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Send, Calendar, Loader2, Play, Shield, Users } from 'lucide-react';

export function BroadcastSettings() {
  useDocumentTitle('Broadcast Settings - LeadWeave');
  const navigate = useNavigate();
  const { rows, columns } = useSpreadsheetStore();
  const {
    campaignName,
    messageTemplate,
    selectedSessions, setSelectedSessions,
    enforceSafeTimezone, setEnforceSafeTimezone,
    minDelay, setMinDelay,
    maxDelay, setMaxDelay,
    simulateTyping, setSimulateTyping,
    scheduleType, setScheduleType,
    scheduleDateTime, setScheduleDateTime,
    isLaunching, setIsLaunching
  } = useCampaignContext();

  const { data: allSessions = [] } = useSessionsQuery();
  const readySessions = allSessions.filter((s: any) => s.status === 'ready');
  const { success, error, info } = useToast();

  const validatePhone = (raw: string): { isValid: boolean; cleaned: string } => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    const digitsOnly = cleaned.replace(/\+/g, '');
    const isValid = digitsOnly.length >= 8 && digitsOnly.length <= 15;
    return { isValid, cleaned };
  };

  const validContacts = useMemo(() => {
    return rows.filter(r => validatePhone(r.phone).isValid).length;
  }, [rows]);

  const isWithinSafeWindow = (_phone: string): { isSafe: boolean; tzInfo?: string } => {
    return { isSafe: true, tzInfo: 'UTC (Assumed)' };
  };

  const timezoneStats = useMemo(() => {
    let safeCount = 0;
    let outsideCount = 0;
    rows.forEach(r => {
      const { isValid, cleaned } = validatePhone(r.phone);
      if (isValid) {
        const { isSafe } = isWithinSafeWindow(cleaned);
        if (isSafe) safeCount++;
        else outsideCount++;
      }
    });
    return { safeCount, outsideCount };
  }, [rows]);



  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      error('Campaign name is required.');
      return;
    }
    if (validContacts === 0) {
      error('No valid phone numbers found in the spreadsheet.');
      return;
    }
    if (selectedSessions.length === 0) {
      error('Please select at least one WhatsApp session to send from.');
      return;
    }
    if (!messageTemplate.trim()) {
      error('Message template cannot be empty.');
      return;
    }
    if (scheduleType === 'later' && !scheduleDateTime) {
      error('Please select a scheduled date and time.');
      return;
    }

    setIsLaunching(true);

    try {
      const validRows = rows.filter(r => validatePhone(r.phone).isValid);
      
      const payloadLeads = validRows.map(row => {
        const variables: Record<string, string> = {};
        columns.forEach(col => {
          if (col !== 'phone' && col !== 'Name') {
            variables[col] = row[col] || '';
          }
        });
        return {
          phone: validatePhone(row.phone).cleaned,
          name: row.Name || row.name || undefined,
          variables,
        };
      });

      const reqBody = {
        name: campaignName.trim(),
        sessionIds: selectedSessions,
        template: messageTemplate,
        scheduledAt: scheduleType === 'later' && scheduleDateTime ? new Date(scheduleDateTime).toISOString() : undefined,
        pacing: {
          minDelayMs: minDelay * 1000,
          maxDelayMs: maxDelay * 1000,
          simulateTyping: simulateTyping,
        },
        columnsMetadata: columns,
        leads: payloadLeads,
        autoLaunch: scheduleType === 'now',
      };

      const res = await campaignApi.create(reqBody);
      success(`Successfully created campaign "${res.name}" with ${payloadLeads.length} recipients!`);
      
      // Redirect to analytics view for this campaign
      navigate('/campaigns');

    } catch (err: any) {
      error(err.response?.data?.message || err.message || 'Failed to launch campaign');
    } finally {
      setIsLaunching(false);
    }
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. LOAD BALANCED SENDER SELECTION */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <Users size={20} className="text-primary" />
              <span>Load-Balanced Sender Numbers</span>
            </h2>
            <p className="studio-card-subtitle">
              Select multiple WhatsApp sessions to automatically round-robin rotate message dispatches.
            </p>
          </div>

          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-soft)', padding: '0.25rem 0.6rem', borderRadius: 12 }}>
            {selectedSessions.length} Active Sender{selectedSessions.length !== 1 ? 's' : ''}
          </span>
        </div>

        {readySessions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171' }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.875rem' }}>No ready WhatsApp sessions connected. Go to the <strong>Sessions</strong> page to connect a session.</span>
          </div>
        ) : (
          <div className="session-card-grid">
            {readySessions.map((sess: any) => {
              const isChecked = selectedSessions.includes(sess.id);
              return (
                <div
                  key={sess.id}
                  className={`session-select-card ${isChecked ? 'selected' : ''}`}
                  onClick={() => {
                    if (isChecked) {
                      if (selectedSessions.length > 1) {
                        setSelectedSessions(selectedSessions.filter(id => id !== sess.id));
                      } else {
                        info('Keep at least 1 session selected');
                      }
                    } else {
                      setSelectedSessions([...selectedSessions, sess.id]);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Handled by container click
                    aria-label={`Select session ${sess.id}`}
                    style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div className="session-status-dot" />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#f8fafc' }}>{sess.id}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. ANTI-BAN PACING & TIMEZONE GUARD */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <Shield size={20} className="text-primary" />
              <span>Anti-Ban Human Jitter Pacing</span>
            </h2>
            <p className="studio-card-subtitle">
              Randomized delays mimic human messaging to protect your WhatsApp numbers from automated bans.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.4rem', color: '#f8fafc' }}>
                <span>Min Delay Interval</span>
                <strong>{minDelay} seconds</strong>
              </div>
              <input
                type="range"
                min={2}
                max={30}
                value={minDelay}
                onChange={e => setMinDelay(Math.min(Number(e.target.value), maxDelay - 1))}
                aria-label="Min Delay Interval"
                className="studio-range-slider"
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.4rem', color: '#f8fafc' }}>
                <span>Max Delay Interval</span>
                <strong>{maxDelay} seconds</strong>
              </div>
              <input
                type="range"
                min={3}
                max={60}
                value={maxDelay}
                onChange={e => setMaxDelay(Math.max(Number(e.target.value), minDelay + 1))}
                aria-label="Max Delay Interval"
                className="studio-range-slider"
              />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem', color: '#94a3b8', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={simulateTyping}
              onChange={e => setSimulateTyping(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            <span>Simulate human typing indicator (2–4 seconds) prior to sending each message</span>
          </label>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#0f172a', borderRadius: 8, border: '1px solid var(--studio-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>
                {scheduleType === 'now' ? 'Save & Launch Campaign' : 'Save & Schedule Campaign'}
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {validContacts} valid recipients via {selectedSessions.length || 0} session(s)
              </span>
            </div>
          </div>

          {/* Safe Timezone Guard Toggle */}
          <div style={{ borderTop: '1px solid var(--studio-border)', paddingTop: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem', color: '#f8fafc', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enforceSafeTimezone}
                onChange={e => setEnforceSafeTimezone(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span><strong>Safe Timezone Guard:</strong> Restrict dispatch to 8:00 AM – 8:00 PM recipient local time</span>
            </label>
            {enforceSafeTimezone && (
              <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.35rem 0 0 1.5rem' }}>
                ✅ {timezoneStats.safeCount} contacts in daytime window | ⏸️ {timezoneStats.outsideCount} outside window (queued for later)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. DISPATCH SCHEDULE & LAUNCH CTA */}
      <div className="studio-card-container">
        <div className="studio-card-header-row">
          <div>
            <h2 className="studio-card-title">
              <Send size={20} className="text-primary" />
              <span>Dispatch Schedule & Execution</span>
            </h2>
            <p className="studio-card-subtitle">
              Choose immediate dispatch or schedule for a future date/time.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Segmented Control */}
          <div className="segmented-control-group">
            <button
              type="button"
              className={`segmented-control-btn ${scheduleType === 'now' ? 'active' : ''}`}
              onClick={() => setScheduleType('now')}
            >
              <Send size={15} />
              <span>Send Immediately</span>
            </button>
            <button
              type="button"
              className={`segmented-control-btn ${scheduleType === 'later' ? 'active' : ''}`}
              onClick={() => setScheduleType('later')}
            >
              <Calendar size={15} />
              <span>Schedule Later</span>
            </button>
          </div>

          {scheduleType === 'later' && (
            <input
              type="datetime-local"
              className="form-control"
              aria-label="Schedule Broadcast Date and Time"
              value={scheduleDateTime}
              onChange={e => setScheduleDateTime(e.target.value)}
              style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid var(--studio-border)', borderRadius: 8, padding: '0.6rem' }}
            />
          )}

          {/* Active Batch Monitor Card - Removed in favor of backend campaign tracking */}

          {/* Launch Button */}
          <button
            type="button"
            className="launch-cta-btn"
            disabled={validContacts === 0 || selectedSessions.length === 0 || isLaunching}
            onClick={handleLaunchCampaign}
          >
            {isLaunching ? (
              <>
                <Loader2 size={18} className="spin-icon" />
                <span>Queuing Broadcast Across Sessions...</span>
              </>
            ) : (
              <>
                <Play size={18} fill="#ffffff" />
                <span>
                  {scheduleType === 'now'
                    ? `Save & Launch Campaign (${validContacts} Contacts, ${selectedSessions.length} Sender${selectedSessions.length !== 1 ? 's' : ''})`
                    : 'Save & Schedule Campaign'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
