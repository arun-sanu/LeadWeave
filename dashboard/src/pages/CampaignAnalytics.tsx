import React, { useState, useEffect, useCallback } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';
import {
  campaignApi,
  type Campaign,
  type CampaignLead,
  type CampaignAnalytics as ICampaignAnalytics,
} from '../services/api';
import { Modal } from '../components/Modal';
import {
  Play,
  Pause,
  Square,
  UserPlus,
  Download,
  RefreshCw,
  Search,
  MessageSquare,
  CheckCheck,
  Eye,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Clock,
  Send,
  Loader2,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import './CampaignAnalytics.css';

function EditableCell({ initialValue, onSave }: { initialValue: string, onSave: (val: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => { setValue(initialValue); }, [initialValue]);

  if (!isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)} 
        style={{ cursor: 'pointer', minHeight: '24px', display: 'flex', alignItems: 'center' }}
        title="Click to edit"
      >
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    );
  }

  return (
    <input
      autoFocus
      className="input"
      aria-label="Edit value"
      style={{ padding: '0.25rem 0.5rem', height: '28px', minWidth: '80px', fontSize: '0.8125rem' }}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { setIsEditing(false); if (value !== initialValue) onSave(value); }}
      onKeyDown={e => {
        if (e.key === 'Enter') { setIsEditing(false); if (value !== initialValue) onSave(value); }
        if (e.key === 'Escape') { setIsEditing(false); setValue(initialValue); }
      }}
    />
  );
}

export function CampaignAnalytics() {
  useDocumentTitle('Campaign Analytics & Spreadsheet CRM - LeadWeave');
  const { success, error, info } = useToast();

  // Campaign State
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<ICampaignAnalytics | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Leads Spreadsheet State
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [leadsTotal, setLeadsTotal] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [isLoadingLeads, setIsLoadingLeads] = useState<boolean>(false);

  // Add Numbers Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [addMode, setAddMode] = useState<'bulk' | 'single'>('bulk');
  const [bulkInputText, setBulkInputText] = useState<string>('');
  const [singlePhone, setSinglePhone] = useState<string>('');
  const [singleName, setSingleName] = useState<string>('');
  const [isAddingLeads, setIsAddingLeads] = useState<boolean>(false);

  // Reply Detail Modal State
  const [selectedLeadForReply, setSelectedLeadForReply] = useState<CampaignLead | null>(null);

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState<string[]>([]);

  useEffect(() => {
    setCustomColumns([]);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!leads || leads.length === 0) return;
    const cols = new Set<string>(customColumns);
    leads.forEach(lead => {
      if (lead.customVariables) {
        Object.keys(lead.customVariables).forEach(k => cols.add(k));
      }
    });
    const newCols = Array.from(cols);
    if (newCols.length > customColumns.length) {
      setCustomColumns(newCols);
    }
  }, [leads]);

  const handleCellEdit = async (leadId: string, field: 'name' | string, value: string, isCustom: boolean = false) => {
    // Optimistic update locally
    setLeads(prev => prev.map(l => {
      if (l.id !== leadId) return l;
      if (!isCustom) {
        return { ...l, name: value };
      }
      return { ...l, customVariables: { ...l.customVariables, [field]: value } };
    }));

    try {
      const data = isCustom ? { customVariables: { [field]: value } } : { name: value };
      await campaignApi.updateLead(selectedCampaignId, leadId, data);
      success('Cell updated');
    } catch (err: any) {
      error('Failed to save edit');
    }
  };

  // Initial Load Campaigns
  const loadCampaigns = useCallback(async () => {
    try {
      const res = await campaignApi.list({ limit: 50 });
      setCampaigns(res.items || []);
      if (res.items && res.items.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(res.items[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load campaigns', err);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load Analytics Data for Selected Campaign
  const loadAnalytics = useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    try {
      const data = await campaignApi.getAnalytics(campaignId);
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load campaign analytics', err);
    }
  }, []);

  // Load Spreadsheet Leads
  const loadLeads = useCallback(
    async (campaignId: string, filter: string, search: string, pageNum: number) => {
      if (!campaignId) return;
      setIsLoadingLeads(true);
      try {
        const params: any = { page: pageNum, limit: 50 };
        if (filter && filter !== 'ALL') params.status = filter;
        if (search.trim()) params.search = search.trim();

        const res = await campaignApi.listLeads(campaignId, params);
        setLeads(res.items || []);
        setLeadsTotal(res.total || 0);
      } catch (err: any) {
        console.error('Failed to load campaign leads', err);
      } finally {
        setIsLoadingLeads(false);
      }
    },
    [],
  );

  // Trigger data reload whenever campaign or filters change
  useEffect(() => {
    if (selectedCampaignId) {
      loadAnalytics(selectedCampaignId);
      loadLeads(selectedCampaignId, statusFilter, searchQuery, page);
    }
  }, [selectedCampaignId, statusFilter, searchQuery, page, loadAnalytics, loadLeads]);

  // Auto-refresh interval (every 6 seconds if active)
  useEffect(() => {
    if (!autoRefresh || !selectedCampaignId) return;
    const interval = setInterval(() => {
      loadAnalytics(selectedCampaignId);
      loadLeads(selectedCampaignId, statusFilter, searchQuery, page);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCampaignId, statusFilter, searchQuery, page, loadAnalytics, loadLeads]);

  // Campaign Actions
  const handleStartCampaign = async () => {
    if (!selectedCampaignId) return;
    try {
      await campaignApi.start(selectedCampaignId);
      success('Campaign launched / resumed successfully.');
      loadAnalytics(selectedCampaignId);
    } catch (err: any) {
      error(err?.message || 'Failed to start campaign');
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaignId) return;
    try {
      await campaignApi.pause(selectedCampaignId);
      info('Campaign paused.');
      loadAnalytics(selectedCampaignId);
    } catch (err: any) {
      error(err?.message || 'Failed to pause campaign');
    }
  };

  const handleCancelCampaign = async () => {
    if (!selectedCampaignId) return;
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await campaignApi.cancel(selectedCampaignId);
      info('Campaign cancelled.');
      loadAnalytics(selectedCampaignId);
    } catch (err: any) {
      error(err?.message || 'Failed to cancel campaign');
    }
  };

  // Add More Numbers Handler
  const handleAddLeadsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaignId) return;

    const leadsToAdd: Array<{ phone: string; name?: string; variables?: Record<string, string> }> = [];

    if (addMode === 'single') {
      if (!singlePhone.trim()) {
        error('Phone number is required');
        return;
      }
      leadsToAdd.push({ phone: singlePhone.trim(), name: singleName.trim() || undefined });
    } else {
      const lines = bulkInputText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) {
        error('Please provide at least one phone number or row.');
        return;
      }

      for (const line of lines) {
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map((p) => p.trim());
        const phone = parts[0];
        const name = parts[1] || undefined;
        if (phone && phone.replace(/\D/g, '').length >= 7) {
          leadsToAdd.push({ phone, name });
        }
      }
    }

    if (leadsToAdd.length === 0) {
      error('No valid phone numbers found in input.');
      return;
    }

    setIsAddingLeads(true);
    try {
      const res = await campaignApi.addLeads(selectedCampaignId, leadsToAdd);
      success(`Added ${res.added} recipient(s) to campaign! Total: ${res.newTotal}`);
      setShowAddModal(false);
      setBulkInputText('');
      setSinglePhone('');
      setSingleName('');
      loadAnalytics(selectedCampaignId);
      loadLeads(selectedCampaignId, statusFilter, searchQuery, 1);
    } catch (err: any) {
      error(err?.message || 'Failed to append numbers');
    } finally {
      setIsAddingLeads(false);
    }
  };

  const currentCampaign = analyticsData?.campaign || campaigns.find((c) => c.id === selectedCampaignId);
  const stats = analyticsData?.stats || currentCampaign?.stats;

  // Compute status badges
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'running':
        return <span className="status-badge connected">● Live Running</span>;
      case 'scheduled':
        return <span className="status-badge pending">🕒 Scheduled</span>;
      case 'paused':
        return <span className="status-badge warning">⏸ Paused</span>;
      case 'completed':
        return <span className="status-badge ready">✓ Completed</span>;
      case 'cancelled':
        return <span className="status-badge error">✕ Cancelled</span>;
      default:
        return <span className="status-badge disconnected">Draft</span>;
    }
  };

  const getLeadStatusBadge = (s: string) => {
    return <span className={`lead-badge ${s}`}>{s}</span>;
  };

  return (
    <div className="campaign-analytics-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Campaigns Management
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--studio-text-sub)' }}>
            Monitor and manage your broadcast campaigns.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => window.location.href = '/campaigns/new'}
        >
          <Plus size={16} />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* 1. TOP TOOLBAR & CAMPAIGN CONTROLS */}
      <div className="analytics-toolbar">
        <div className="analytics-campaign-select-wrap">
          <FileSpreadsheet size={20} className="text-primary" />
          <select
            className="campaign-dropdown"
            aria-label="Select campaign"
            value={selectedCampaignId}
            onChange={(e) => setSelectedCampaignId(e.target.value)}
          >
            {campaigns.length === 0 ? (
              <option value="">No campaigns available</option>
            ) : (
              campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.status.toUpperCase()})
                </option>
              ))
            )}
          </select>
          {getStatusBadge(currentCampaign?.status)}
        </div>

        <div className="analytics-actions-group">
          {currentCampaign?.status === 'running' ? (
            <button className="btn btn-secondary btn-sm" onClick={handlePauseCampaign} title="Pause Campaign">
              <Pause size={15} />
              <span>Pause</span>
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleStartCampaign}
              disabled={!selectedCampaignId || (currentCampaign?.status === 'completed' && stats?.pending === 0)}
              title="Start / Resume Campaign"
            >
              <Play size={15} />
              <span>{currentCampaign?.status === 'paused' ? 'Resume' : 'Launch'}</span>
            </button>
          )}

          {currentCampaign?.status === 'running' && (
            <button className="btn btn-secondary btn-sm" onClick={handleCancelCampaign} title="Stop Campaign">
              <Square size={15} />
              <span>Cancel</span>
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddModal(true)}
            disabled={!selectedCampaignId}
            title="Dynamically Add More Numbers"
          >
            <UserPlus size={15} />
            <span>Add Numbers</span>
          </button>

          <a
            href={selectedCampaignId ? campaignApi.getExportUrl(selectedCampaignId) : '#'}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-sm"
            download
            style={{ textDecoration: 'none' }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </a>

          <button
            className={`btn btn-sm ${autoRefresh ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? 'Live Auto-Refresh ON (6s)' : 'Live Auto-Refresh OFF'}
          >
            <RefreshCw size={15} className={autoRefresh && currentCampaign?.status === 'running' ? 'animate-spin' : ''} />
            <span>{autoRefresh ? 'Live (6s)' : 'Manual'}</span>
          </button>
        </div>
      </div>

      {/* 2. HERO KPI SUMMARY RIBBON */}
      <div className="kpi-ribbon">
        <div className="kpi-card">
          <div className="kpi-icon primary">
            <MessageSquare size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats?.total ?? 0}</span>
            <span className="kpi-label">Total Targeted</span>
            <span className="kpi-sub">{stats?.pending ?? 0} Pending</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon indigo">
            <Send size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats?.sent ?? 0}</span>
            <span className="kpi-label">Dispatched</span>
            <span className="kpi-sub">Outbound Sent</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCheck size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats?.delivered ?? 0}</span>
            <span className="kpi-label">Delivered</span>
            <span className="kpi-sub">Double Check</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <Eye size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats?.read ?? 0}</span>
            <span className="kpi-label">Read / Seen</span>
            <span className="kpi-sub">Blue Check</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon amber">
            <TrendingUp size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value" style={{ color: '#eab308' }}>
              {stats?.replied ?? 0}
            </span>
            <span className="kpi-label">Replies Received</span>
            <span className="kpi-sub">{stats?.responseRate ?? 0}% Rate</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red">
            <AlertCircle size={20} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats?.optOut ?? 0}</span>
            <span className="kpi-label">Opt-Outs (STOP)</span>
            <span className="kpi-sub">{stats?.failed ?? 0} Failed / Invalid</span>
          </div>
        </div>
      </div>

      {/* 3. VISUAL ANALYTICS & CHARTS */}
      <div className="analytics-charts-grid">
        {/* FUNNEL BAR CHART */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">
              <BarChart3 size={18} className="text-primary" />
              <span>Conversion Funnel & Drop-Off</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Response Rate: <strong>{stats?.responseRate ?? 0}%</strong>
            </span>
          </div>

          <div className="funnel-container">
            {(analyticsData?.funnel || []).map((step) => {
              let fillClass = 'target';
              if (step.stage === 'Dispatched') fillClass = 'sent';
              if (step.stage === 'Delivered') fillClass = 'delivered';
              if (step.stage === 'Read') fillClass = 'read';
              if (step.stage === 'Replied') fillClass = 'replied';

              return (
                <div key={step.stage} className="funnel-row">
                  <div className="funnel-labels">
                    <span>{step.stage}</span>
                    <span>
                      {step.count} ({step.percent}%)
                    </span>
                  </div>
                  <div className="funnel-track">
                    <div
                      className={`funnel-fill ${fillClass}`}
                      style={{ width: `${Math.max(4, Math.min(100, step.percent))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* HOURLY RESPONSES TIMELINE */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">
              <Clock size={18} className="text-primary" />
              <span>Responses & Opt-Outs Over Time</span>
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {analyticsData?.timeline?.length || 0} active hour slots
            </span>
          </div>

          <div className="timeline-svg-wrap">
            {!analyticsData?.timeline || analyticsData.timeline.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                <Clock size={28} style={{ opacity: 0.3, marginBottom: '0.5rem', display: 'inline-block' }} />
                <p>No incoming replies recorded yet. Once recipients respond, trends appear here.</p>
              </div>
            ) : (
              <svg width="100%" height="150" viewBox="0 0 400 150" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="repliesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#eab308" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#eab308" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Render bars for each time slot */}
                {(analyticsData?.timeline || []).map((item, idx, arr) => {
                  const maxCount = Math.max(...arr.map((x) => x.replies + x.optOuts), 1);
                  const barWidth = Math.max(8, 380 / arr.length - 4);
                  const x = 10 + idx * (380 / arr.length);
                  const hReplies = (item.replies / maxCount) * 110;
                  const hOpt = (item.optOuts / maxCount) * 110;

                  return (
                    <g key={item.time}>
                      <rect
                        x={x}
                        y={140 - hReplies}
                        width={barWidth}
                        height={hReplies}
                        fill="#eab308"
                        rx="3"
                        opacity="0.85"
                      >
                        <title>{`${item.time}: ${item.replies} replies`}</title>
                      </rect>
                      {item.optOuts > 0 && (
                        <rect
                          x={x}
                          y={140 - hReplies - hOpt}
                          width={barWidth}
                          height={hOpt}
                          fill="#ef4444"
                          rx="3"
                        >
                          <title>{`${item.time}: ${item.optOuts} opt-outs`}</title>
                        </rect>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* 4. SPREADSHEET CRM DATA TABLE WITH FILTERS */}
      <div className="spreadsheet-card">
        <div className="spreadsheet-header-bar">
          <div className="filter-pills-bar">
            {['ALL', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'OPT_OUT', 'FAILED'].map((pill) => (
              <button
                key={pill}
                className={`filter-pill ${statusFilter === pill ? 'active' : ''}`}
                onClick={() => {
                  setStatusFilter(pill);
                  setPage(1);
                }}
              >
                {pill}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              className="btn btn-sm btn-secondary" 
              onClick={() => {
                const colName = window.prompt('Enter new custom column name (e.g. Category, Notes):');
                if (colName && colName.trim()) {
                  const newCol = colName.trim();
                  if (!customColumns.includes(newCol)) {
                    setCustomColumns(prev => [...prev, newCol]);
                  }
                }
              }}
            >
              <Plus size={14} /> 
              <span>Add Column</span>
            </button>
            <div className="search-input-wrap">
              <Search size={14} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                aria-label="Search recipients"
                placeholder="Search phone, name, replies..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total: <strong>{leadsTotal}</strong>
            </span>
          </div>
        </div>

        <div className="spreadsheet-table-container">
          <table className="spreadsheet-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Phone Number</th>
                <th>Name</th>
                {customColumns.map(col => (
                  <th key={col}>{col}</th>
                ))}
                <th>Status</th>
                <th>Sent At</th>
                <th>Response / Reply</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingLeads ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    <Loader2 size={24} className="animate-spin" style={{ display: 'inline-block', marginBottom: '0.5rem' }} />
                    <p>Loading spreadsheet records...</p>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No recipient records match the selected filter.
                  </td>
                </tr>
              ) : (
                leads.map((lead, idx) => (
                  <tr key={lead.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {(page - 1) * 50 + idx + 1}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      +{lead.phoneNumber}
                    </td>
                    <td>
                      <EditableCell 
                        initialValue={lead.name || ''} 
                        onSave={(val) => handleCellEdit(lead.id, 'name', val, false)} 
                      />
                    </td>
                    {customColumns.map(col => (
                      <td key={col}>
                        <EditableCell 
                          initialValue={lead.customVariables?.[col] || ''} 
                          onSave={(val) => handleCellEdit(lead.id, col, val, true)} 
                        />
                      </td>
                    ))}
                    <td>{getLeadStatusBadge(lead.status)}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {lead.sentAt ? new Date(lead.sentAt).toLocaleTimeString() : '—'}
                    </td>
                    <td>
                      {lead.firstReplySnippet ? (
                        <div
                          className="reply-snippet-box"
                          onClick={() => setSelectedLeadForReply(lead)}
                          title="Click to view full reply"
                        >
                          💬 {lead.firstReplySnippet}
                        </div>
                      ) : lead.errorMessage ? (
                        <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>{lead.errorMessage}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {new Date(lead.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. ADD MORE NUMBERS MODAL */}
      <Modal
        title="Add Numbers to Campaign"
        onClose={() => setShowAddModal(false)}
        open={showAddModal}
      >
        <form onSubmit={handleAddLeadsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn btn-sm ${addMode === 'bulk' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddMode('bulk')}
            >
              Paste Spreadsheet / CSV
            </button>
            <button
              type="button"
              className={`btn btn-sm ${addMode === 'single' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setAddMode('single')}
            >
              Single Number
            </button>
          </div>

          {addMode === 'bulk' ? (
            <div>
              <label className="label">Paste Numbers & Names (One per line e.g. +123456789, John)</label>
              <textarea
                className="textarea"
                rows={6}
                placeholder={`+1234567890\tAlice\n+9876543210\tBob`}
                value={bulkInputText}
                onChange={(e) => setBulkInputText(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="label">Phone Number *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="+1234567890"
                  value={singlePhone}
                  onChange={(e) => setSinglePhone(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contact Name"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isAddingLeads}>
              {isAddingLeads ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              <span>Add Recipients</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* 6. REPLY PREVIEW MODAL */}
      <Modal
        title={`Reply from +${selectedLeadForReply?.phoneNumber || ''}`}
        onClose={() => setSelectedLeadForReply(null)}
        open={!!selectedLeadForReply}
      >
        {selectedLeadForReply && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contact</span>
              <p style={{ fontWeight: 600 }}>{selectedLeadForReply.name || 'Unnamed'} (+{selectedLeadForReply.phoneNumber})</p>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Received Message</span>
              <div
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem',
                  marginTop: '0.35rem',
                  fontSize: '0.9375rem',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedLeadForReply.firstReplySnippet}
              </div>
            </div>

            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Replied at: {selectedLeadForReply.repliedAt ? new Date(selectedLeadForReply.repliedAt).toLocaleString() : '—'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedLeadForReply(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
