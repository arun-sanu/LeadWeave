/* cspell:words leadweave deepdive spintax */
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
import { useRole } from '../hooks/useRole';
import { useSessionsQuery } from '../hooks/queries';
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
  Radio,
  UserCheck,
  Share2,
  History,
  LayoutGrid,
  ArrowLeft,
  Calendar,
  Layers,
  Pencil,
} from 'lucide-react';
import './CampaignAnalytics.css';

function EditableCell({ initialValue, onSave }: { initialValue: string; onSave: (val: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

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
      onBlur={() => {
        setIsEditing(false);
        if (value !== initialValue) onSave(value);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          setIsEditing(false);
          if (value !== initialValue) onSave(value);
        }
        if (e.key === 'Escape') {
          setIsEditing(false);
          setValue(initialValue);
        }
      }}
    />
  );
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
    return errorObj.response?.data?.message || errorObj.message || fallback;
  }
  return fallback;
}

export interface CampaignAnalyticsProps {
  initialViewMode?: 'directory' | 'deepdive';
}

export function CampaignAnalytics({ initialViewMode = 'deepdive' }: CampaignAnalyticsProps = {}) {
  useDocumentTitle('Campaign Analytics & Spreadsheet CRM - LeadWeave');
  const { success, error, info } = useToast();

  // User, Role & Sessions Context
  const { isAdmin } = useRole();
  const { data: allSessions = [] } = useSessionsQuery();
  const currentCompany = sessionStorage.getItem('leadweave_company_name') || '';

  // Directory vs Deep-Dive View Mode
  const [viewMode, setViewMode] = useState<'directory' | 'deepdive'>(initialViewMode);
  const [directoryTab, setDirectoryTab] = useState<'all' | 'live' | 'assigned' | 'shared' | 'previous'>('all');
  const [directorySearch, setDirectorySearch] = useState<string>('');

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

  // Edit Campaign Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editModalTab, setEditModalTab] = useState<'content' | 'settings'>('content');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editTemplate, setEditTemplate] = useState<string>('');
  const [editMediaUrl, setEditMediaUrl] = useState<string>('');
  const [editSessions, setEditSessions] = useState<string[]>([]);
  const [editScheduledAt, setEditScheduledAt] = useState<string>('');
  const [editMinDelay, setEditMinDelay] = useState<number>(3);
  const [editMaxDelay, setEditMaxDelay] = useState<number>(6);
  const [editSimulateTyping, setEditSimulateTyping] = useState<boolean>(true);
  const [editDispatchMode, setEditDispatchMode] = useState<'automated' | 'manual'>('automated');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  // Manual 1-by-1 Send State
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [isSendingNext, setIsSendingNext] = useState<boolean>(false);

  // Dynamic Custom Columns
  const [customColumns, setCustomColumns] = useState<string[]>([]);

  useEffect(() => {
    setCustomColumns([]);
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!leads || leads.length === 0) return;
    setCustomColumns(prevCols => {
      const cols = new Set<string>(prevCols);
      leads.forEach(lead => {
        if (lead.customVariables) {
          Object.keys(lead.customVariables).forEach(k => cols.add(k));
        }
      });
      const newCols = Array.from(cols);
      return newCols.length > prevCols.length ? newCols : prevCols;
    });
  }, [leads]);

  const handleCellEdit = async (leadId: string, field: 'name' | string, value: string, isCustom: boolean = false) => {
    // Optimistic update locally
    setLeads(prev =>
      prev.map(l => {
        if (l.id !== leadId) return l;
        if (!isCustom) {
          return { ...l, name: value };
        }
        return { ...l, customVariables: { ...l.customVariables, [field]: value } };
      }),
    );

    try {
      const data = isCustom ? { customVariables: { [field]: value } } : { name: value };
      await campaignApi.updateLead(selectedCampaignId, leadId, data);
      success('Cell updated');
    } catch {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      console.error('Failed to load campaign analytics', err);
    }
  }, []);

  // Load Spreadsheet Leads
  const loadLeads = useCallback(
    async (campaignId: string, filter: string, search: string, pageNum: number, isBackground: boolean = false) => {
      if (!campaignId) return;
      if (!isBackground) {
        setIsLoadingLeads(true);
      }
      try {
        const params: { page: number; limit: number; status?: string; search?: string } = {
          page: pageNum,
          limit: 50,
        };
        if (filter && filter !== 'ALL') params.status = filter;
        if (search.trim()) params.search = search.trim();

        const res = await campaignApi.listLeads(campaignId, params);
        setLeads(res.items || []);
        setLeadsTotal(res.total || 0);
      } catch (err: unknown) {
        console.error('Failed to load campaign leads', err);
      } finally {
        if (!isBackground) {
          setIsLoadingLeads(false);
        }
      }
    },
    [],
  );

  // Trigger data reload whenever campaign or filters change
  useEffect(() => {
    if (selectedCampaignId) {
      loadAnalytics(selectedCampaignId);
      loadLeads(selectedCampaignId, statusFilter, searchQuery, page, false);
    }
  }, [selectedCampaignId, statusFilter, searchQuery, page, loadAnalytics, loadLeads]);

  // Auto-refresh interval (every 6 seconds if active)
  useEffect(() => {
    if (!autoRefresh || !selectedCampaignId) return;
    const interval = setInterval(() => {
      loadAnalytics(selectedCampaignId);
      loadLeads(selectedCampaignId, statusFilter, searchQuery, page, true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedCampaignId, statusFilter, searchQuery, page, loadAnalytics, loadLeads]);

  // Campaign Actions for Deep-Dive
  const handleStartCampaign = async () => {
    if (!selectedCampaignId) return;
    try {
      await campaignApi.start(selectedCampaignId);
      success('Campaign launched / resumed successfully.');
      loadAnalytics(selectedCampaignId);
      loadCampaigns();
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to start campaign'));
    }
  };

  const handlePauseCampaign = async () => {
    if (!selectedCampaignId) return;
    try {
      await campaignApi.pause(selectedCampaignId);
      info('Campaign paused.');
      loadAnalytics(selectedCampaignId);
      loadCampaigns();
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to pause campaign'));
    }
  };

  const handleCancelCampaign = async () => {
    if (!selectedCampaignId) return;
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    try {
      await campaignApi.cancel(selectedCampaignId);
      info('Campaign cancelled.');
      loadAnalytics(selectedCampaignId);
      loadCampaigns();
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to cancel campaign'));
    }
  };

  // Manual 1-by-1 Spreadsheet Send Handlers
  const handleSendSingleLead = async (leadId: string) => {
    if (!selectedCampaignId) return;
    setSendingLeadId(leadId);
    try {
      const res = await campaignApi.sendSingleLead(selectedCampaignId, leadId);
      if (res.success) {
        success(`Message sent to +${res.lead.phoneNumber}!`);
      } else if (res.pauseReason) {
        info(`Pacing governor pause: ${res.pauseReason}`);
      } else {
        error(res.lead.errorMessage || 'Failed to dispatch message');
      }
      setLeads(prev => prev.map(l => (l.id === leadId ? res.lead : l)));
      loadAnalytics(selectedCampaignId);
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Error sending lead'));
    } finally {
      setSendingLeadId(null);
    }
  };

  const handleSendNextLead = async () => {
    if (!selectedCampaignId) return;
    setIsSendingNext(true);
    try {
      const res = await campaignApi.sendNextLead(selectedCampaignId);
      if (res.hasMore && res.lead) {
        if (res.success) {
          success(`Sent 1-by-1 to +${res.lead.phoneNumber}! (${res.remainingPending} pending remaining)`);
        } else if (res.pauseReason) {
          info(`Pacing governor pause: ${res.pauseReason}`);
        } else {
          error(res.lead.errorMessage || 'Send failure');
        }
        loadLeads(selectedCampaignId, statusFilter, searchQuery, page, false);
        loadAnalytics(selectedCampaignId);
      } else {
        info(res.message || 'All leads have already been dispatched!');
        loadLeads(selectedCampaignId, statusFilter, searchQuery, page, false);
        loadAnalytics(selectedCampaignId);
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Error sending next lead'));
    } finally {
      setIsSendingNext(false);
    }
  };

  // Direct action helpers for cards in the directory
  const handleStartCampaignById = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await campaignApi.start(id);
      success('Campaign launched / resumed.');
      loadCampaigns();
      if (selectedCampaignId === id) loadAnalytics(id);
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to start campaign'));
    }
  };

  const handlePauseCampaignById = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await campaignApi.pause(id);
      info('Campaign paused.');
      loadCampaigns();
      if (selectedCampaignId === id) loadAnalytics(id);
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to pause campaign'));
    }
  };

  const handleOpenEditModal = (camp: Campaign, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditModalTab('content');
    setEditingCampaign(camp);
    setEditName(camp.name || '');
    setEditTemplate(camp.template || '');
    setEditMediaUrl(camp.mediaUrl || '');
    setEditSessions(camp.sessionIds || []);
    if (camp.scheduledAt) {
      try {
        const d = new Date(camp.scheduledAt);
        if (!isNaN(d.getTime())) {
          const formatted = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setEditScheduledAt(formatted);
        } else {
          setEditScheduledAt('');
        }
      } catch {
        setEditScheduledAt('');
      }
    } else {
      setEditScheduledAt('');
    }
    setEditMinDelay(Math.round((camp.pacing?.minDelayMs ?? 3000) / 1000));
    setEditMaxDelay(Math.round((camp.pacing?.maxDelayMs ?? 6000) / 1000));
    setEditSimulateTyping(camp.pacing?.simulateTyping ?? true);
    setEditDispatchMode(camp.dispatchMode || 'automated');
    setShowEditModal(true);
  };

  const handleSaveCampaignEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    if (!editName.trim()) {
      error('Campaign name is required');
      return;
    }
    if (editSessions.length === 0) {
      error('Please select at least one WhatsApp sender session');
      return;
    }

    setIsSavingEdit(true);
    try {
      await campaignApi.update(editingCampaign.id, {
        name: editName.trim(),
        template: editTemplate,
        mediaUrl: editMediaUrl.trim() || undefined,
        sessionIds: editSessions,
        dispatchMode: editDispatchMode,
        scheduledAt: editScheduledAt ? new Date(editScheduledAt).toISOString() : undefined,
        pacing: {
          minDelayMs: editMinDelay * 1000,
          maxDelayMs: editMaxDelay * 1000,
          simulateTyping: editSimulateTyping,
        },
      });

      success('Campaign updated successfully');
      setShowEditModal(false);
      loadCampaigns();
      if (selectedCampaignId === editingCampaign.id) {
        loadAnalytics(editingCampaign.id);
      }
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to update campaign'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Categorized campaigns calculation
  // 1. Live: running or scheduled
  // 2. Assigned: campaign sessionIds intersect with allSessions or user's assigned sessions
  // 3. Shared: belongs to current company or has companyId
  // 4. Previous: completed, cancelled, or paused
  const activeSessionIds = React.useMemo(() => new Set(allSessions.map(s => s.id)), [allSessions]);

  const categorizedCounts = React.useMemo(() => {
    const live = campaigns.filter(c => c.status === 'running' || c.status === 'scheduled').length;
    const assigned = campaigns.filter(c => {
      if (isAdmin) return true;
      if (!c.sessionIds || c.sessionIds.length === 0) return false;
      return c.sessionIds.some((sid: string) => activeSessionIds.has(sid));
    }).length;
    const shared = campaigns.filter(c => {
      if (!c.companyId) return true;
      return !currentCompany || c.companyId === currentCompany;
    }).length;
    const previous = campaigns.filter(
      c => c.status === 'completed' || c.status === 'cancelled' || c.status === 'paused',
    ).length;

    return {
      all: campaigns.length,
      live,
      assigned,
      shared,
      previous,
    };
  }, [campaigns, isAdmin, activeSessionIds, currentCompany]);

  const filteredCampaigns = React.useMemo(() => {
    let list = [...campaigns];

    // Filter by tab category
    if (directoryTab === 'live') {
      list = list.filter(c => c.status === 'running' || c.status === 'scheduled');
    } else if (directoryTab === 'assigned') {
      list = list.filter(c => {
        if (isAdmin) return true;
        if (!c.sessionIds || c.sessionIds.length === 0) return false;
        return c.sessionIds.some((sid: string) => activeSessionIds.has(sid));
      });
    } else if (directoryTab === 'shared') {
      list = list.filter(c => {
        if (!c.companyId) return true;
        return !currentCompany || c.companyId === currentCompany;
      });
    } else if (directoryTab === 'previous') {
      list = list.filter(c => c.status === 'completed' || c.status === 'cancelled' || c.status === 'paused');
    }

    // Filter by search query
    if (directorySearch.trim()) {
      const q = directorySearch.toLowerCase().trim();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q) ||
          (c.template && c.template.toLowerCase().includes(q)) ||
          (c.creatorName && c.creatorName.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [campaigns, directoryTab, directorySearch, isAdmin, activeSessionIds, currentCompany]);

  // Overall Company-wide aggregate stats across campaigns
  const aggregateDirectoryStats = React.useMemo(() => {
    const totalCampaigns = campaigns.length;
    const activeLive = campaigns.filter(c => c.status === 'running').length;
    let totalMessagesDispatched = 0;
    let totalReplies = 0;
    let totalDelivered = 0;

    campaigns.forEach(c => {
      if (c.stats) {
        totalMessagesDispatched += c.stats.sent || 0;
        totalReplies += c.stats.replied || 0;
        totalDelivered += c.stats.delivered || 0;
      }
    });

    const avgResponseRate =
      totalMessagesDispatched > 0 ? Math.round((totalReplies / totalMessagesDispatched) * 100) : 0;

    return {
      totalCampaigns,
      activeLive,
      totalMessagesDispatched,
      totalDelivered,
      totalReplies,
      avgResponseRate,
    };
  }, [campaigns]);

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
      const lines = bulkInputText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) {
        error('Please provide at least one phone number or row.');
        return;
      }

      for (const line of lines) {
        const delimiter = line.includes('\t') ? '\t' : ',';
        const parts = line.split(delimiter).map(p => p.trim());
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
    } catch (err: unknown) {
      error(getErrorMessage(err, 'Failed to append numbers'));
    } finally {
      setIsAddingLeads(false);
    }
  };

  const currentCampaign = analyticsData?.campaign || campaigns.find(c => c.id === selectedCampaignId);
  const stats =
    analyticsData?.stats ||
    currentCampaign?.stats ||
    (currentCampaign
      ? {
          total: ((currentCampaign as any).totalLeads as number) ?? 0,
          sent: ((currentCampaign as any).sentCount as number) ?? 0,
          delivered: ((currentCampaign as any).deliveredCount as number) ?? 0,
          read: ((currentCampaign as any).readCount as number) ?? 0,
          failed: ((currentCampaign as any).failedCount as number) ?? 0,
          pending: 0,
          replied: 0,
          deliveryRate: 0,
          readRate: 0,
          replyRate: 0,
        }
      : undefined);

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
      <div
        className="page-header"
        style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Campaigns Management
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--studio-text-sub)' }}>
            Monitor and manage your broadcast campaigns.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* View Switcher: Directory vs Analytics CRM */}
          <div className="view-mode-tabs">
            <button
              className={`view-mode-btn ${viewMode === 'directory' ? 'active' : ''}`}
              onClick={() => setViewMode('directory')}
              title="Campaigns Hub / Directory"
            >
              <LayoutGrid size={15} />
              <span>Campaigns Hub</span>
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'deepdive' ? 'active' : ''}`}
              onClick={() => setViewMode('deepdive')}
              title="Campaign Analytics & Spreadsheet CRM"
            >
              <BarChart3 size={15} />
              <span>Analytics & Leads CRM</span>
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => (window.location.href = '/campaigns/new')}>
            <Plus size={16} />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          VIEW MODE 1: CAMPAIGNS HUB / DIRECTORY
          ========================================================================= */}
      {viewMode === 'directory' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. DIRECTORY KPI SUMMARY RIBBON */}
          <div className="kpi-ribbon">
            <div className="kpi-card">
              <div className="kpi-icon primary">
                <Layers size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{aggregateDirectoryStats.totalCampaigns}</span>
                <span className="kpi-label">Total Campaigns</span>
                <span className="kpi-sub">Across All Statuses</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon success">
                <Radio size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{aggregateDirectoryStats.activeLive}</span>
                <span className="kpi-label">Active Live</span>
                <span className="kpi-sub">Currently Dispatching</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon indigo">
                <Send size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{aggregateDirectoryStats.totalMessagesDispatched}</span>
                <span className="kpi-label">Dispatched</span>
                <span className="kpi-sub">{aggregateDirectoryStats.totalDelivered} Delivered</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon amber">
                <TrendingUp size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value" style={{ color: '#eab308' }}>
                  {aggregateDirectoryStats.totalReplies}
                </span>
                <span className="kpi-label">Replies Received</span>
                <span className="kpi-sub">{aggregateDirectoryStats.avgResponseRate}% Avg Rate</span>
              </div>
            </div>
          </div>

          {/* 2. DIRECTORY CATEGORY TABS & SEARCH BAR */}
          <div className="directory-toolbar">
            <div className="directory-tabs-bar" style={{ marginBottom: 0, borderBottom: 'none' }}>
              <button
                className={`directory-tab-btn ${directoryTab === 'all' ? 'active' : ''}`}
                onClick={() => setDirectoryTab('all')}
              >
                <LayoutGrid size={16} />
                <span>All Campaigns</span>
                <span className="tab-count">{categorizedCounts.all}</span>
              </button>

              <button
                className={`directory-tab-btn ${directoryTab === 'live' ? 'active' : ''}`}
                onClick={() => setDirectoryTab('live')}
              >
                <Radio size={16} />
                <span>Live Campaigns</span>
                <span className="tab-count">{categorizedCounts.live}</span>
              </button>

              <button
                className={`directory-tab-btn ${directoryTab === 'assigned' ? 'active' : ''}`}
                onClick={() => setDirectoryTab('assigned')}
              >
                <UserCheck size={16} />
                <span>Assigned Campaigns</span>
                <span className="tab-count">{categorizedCounts.assigned}</span>
              </button>

              <button
                className={`directory-tab-btn ${directoryTab === 'shared' ? 'active' : ''}`}
                onClick={() => setDirectoryTab('shared')}
              >
                <Share2 size={16} />
                <span>Shared Campaigns</span>
                <span className="tab-count">{categorizedCounts.shared}</span>
              </button>

              <button
                className={`directory-tab-btn ${directoryTab === 'previous' ? 'active' : ''}`}
                onClick={() => setDirectoryTab('previous')}
              >
                <History size={16} />
                <span>Previous Campaigns</span>
                <span className="tab-count">{categorizedCounts.previous}</span>
              </button>
            </div>

            <div className="search-input-wrap">
              <Search size={14} className="search-icon-pos" />
              <input
                type="text"
                className="search-input"
                aria-label="Search campaigns"
                placeholder="Search campaigns by name, sender..."
                value={directorySearch}
                onChange={e => setDirectorySearch(e.target.value)}
              />
            </div>
          </div>

          {/* 3. CAMPAIGNS GRID */}
          {filteredCampaigns.length === 0 ? (
            <div className="directory-empty-state">
              <div className="directory-empty-icon">
                {directoryTab === 'live' ? (
                  <Radio size={28} />
                ) : directoryTab === 'assigned' ? (
                  <UserCheck size={28} />
                ) : directoryTab === 'shared' ? (
                  <Share2 size={28} />
                ) : (
                  <History size={28} />
                )}
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                No {directoryTab === 'all' ? '' : directoryTab.charAt(0).toUpperCase() + directoryTab.slice(1)}{' '}
                Campaigns Found
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '440px', margin: 0 }}>
                {directorySearch
                  ? `No campaigns matched your search "${directorySearch}". Try a different keyword.`
                  : directoryTab === 'live'
                    ? 'There are currently no running or scheduled broadcast campaigns.'
                    : directoryTab === 'assigned'
                      ? 'No campaigns are currently dispatched using your assigned sessions.'
                      : directoryTab === 'shared'
                        ? 'No shared campaigns have been created in this workspace.'
                        : 'Previous or finished campaigns will appear here once executed.'}
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => (window.location.href = '/campaigns/new')}
                style={{ marginTop: '0.5rem' }}
              >
                <Plus size={14} />
                <span>Create New Campaign</span>
              </button>
            </div>
          ) : (
            <div className="campaign-grid">
              {filteredCampaigns.map(camp => {
                const total = camp.stats?.total || 0;
                const sent = camp.stats?.sent || 0;
                const pct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
                const isLive = camp.status === 'running';

                return (
                  <div key={camp.id} className="campaign-card">
                    <div>
                      <div className="campaign-card-header">
                        <div>
                          <h3 className="campaign-card-title">{camp.name}</h3>
                          <div className="campaign-card-meta">
                            {camp.creatorName && <span className="meta-chip">👤 {camp.creatorName}</span>}
                            <span className="meta-chip">
                              <Calendar size={12} />
                              {new Date(camp.createdAt).toLocaleDateString()}
                            </span>
                            {camp.sessionIds && camp.sessionIds.length > 0 && (
                              <span className="meta-chip">
                                📱 {camp.sessionIds.length} Sender{camp.sessionIds.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {getStatusBadge(camp.status)}
                          {camp.dispatchMode === 'manual' ? (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.4rem',
                                borderRadius: 4,
                                background: 'rgba(56, 189, 248, 0.15)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                textTransform: 'uppercase',
                              }}
                            >
                              Manual
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.4rem',
                                borderRadius: 4,
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#22c55e',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                textTransform: 'uppercase',
                              }}
                            >
                              Auto
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress Track */}
                      <div className="campaign-progress-box" style={{ marginTop: '1rem' }}>
                        <div className="progress-label-row">
                          <span>
                            Progress: {sent} / {total} Leads
                          </span>
                          <strong style={{ color: pct === 100 ? '#10b981' : '#3b82f6' }}>{pct}%</strong>
                        </div>
                        <div className="progress-track-bg">
                          <div
                            className={`progress-track-fill ${pct === 100 ? 'completed' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Mini KPI Grid */}
                      <div className="card-kpi-grid" style={{ marginTop: '1rem' }}>
                        <div className="card-kpi-item">
                          <span className="card-kpi-num">{camp.stats?.sent ?? 0}</span>
                          <span className="card-kpi-lbl">Sent</span>
                        </div>
                        <div className="card-kpi-item">
                          <span className="card-kpi-num">{camp.stats?.delivered ?? 0}</span>
                          <span className="card-kpi-lbl">Delivered</span>
                        </div>
                        <div className="card-kpi-item">
                          <span className="card-kpi-num" style={{ color: '#eab308' }}>
                            {camp.stats?.replied ?? 0}
                          </span>
                          <span className="card-kpi-lbl">Replies</span>
                        </div>
                        <div className="card-kpi-item">
                          <span className="card-kpi-num" style={{ color: '#eab308' }}>
                            {(camp.stats as any)?.replyRate ?? 0}%
                          </span>
                          <span className="card-kpi-lbl">Rate</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Action Footer */}
                    <div className="campaign-card-footer">
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {isLive ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={e => handlePauseCampaignById(camp.id, e)}
                            title="Pause Campaign"
                          >
                            <Pause size={13} />
                          </button>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={e => handleStartCampaignById(camp.id, e)}
                            title={camp.status === 'paused' ? 'Resume Campaign' : 'Launch Campaign'}
                            disabled={camp.status === 'completed'}
                          >
                            <Play size={13} />
                          </button>
                        )}

                        {['draft', 'scheduled', 'paused'].includes(camp.status) && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={e => handleOpenEditModal(camp, e)}
                            title="Edit Campaign Settings"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        <a
                          href={campaignApi.getExportUrl(camp.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost btn-sm"
                          title="Export CSV"
                          download
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={13} />
                        </a>
                      </div>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setSelectedCampaignId(camp.id);
                          setViewMode('deepdive');
                        }}
                        title="View Analytics"
                      >
                        <BarChart3 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: CAMPAIGN DEEP-DIVE & SPREADSHEET CRM
          ========================================================================= */}
      {viewMode === 'deepdive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setViewMode('directory')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Campaigns Hub</span>
            </button>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Viewing Campaign:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{currentCampaign?.name || 'Selected Campaign'}</strong>
            </span>
          </div>

          {/* 1. TOP TOOLBAR & CAMPAIGN CONTROLS */}
          <div className="analytics-toolbar">
            <div className="analytics-campaign-select-wrap">
              <FileSpreadsheet size={20} className="text-primary" />
              <select
                className="campaign-dropdown"
                aria-label="Select campaign"
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
              >
                {campaigns.length === 0 ? (
                  <option value="">No campaigns available</option>
                ) : (
                  campaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status.toUpperCase()})
                    </option>
                  ))
                )}
              </select>
              {getStatusBadge(currentCampaign?.status)}
              {currentCampaign?.dispatchMode === 'manual' ? (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 4,
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                  title="Manual Mode: Messages dispatched 1-by-1 directly from spreadsheet"
                >
                  Manual (1-by-1)
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.5rem',
                    borderRadius: 4,
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                  title="Automated Mode: Continuous background pacing with anti-ban delays"
                >
                  Automated
                </span>
              )}
            </div>

            <div className="analytics-actions-group">
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSendNextLead}
                disabled={!selectedCampaignId || isSendingNext || stats?.pending === 0}
                title="Send next pending lead 1-by-1 from queue"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background:
                    currentCampaign?.dispatchMode === 'manual'
                      ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                      : undefined,
                  borderColor: currentCampaign?.dispatchMode === 'manual' ? '#38bdf8' : undefined,
                }}
              >
                {isSendingNext ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span>Send Next (1-by-1)</span>
              </button>

              {currentCampaign?.status === 'running' ? (
                <button className="btn btn-secondary btn-sm" onClick={handlePauseCampaign} title="Pause Campaign">
                  <Pause size={15} />
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleStartCampaign}
                  disabled={!selectedCampaignId || (currentCampaign?.status === 'completed' && stats?.pending === 0)}
                  title={currentCampaign?.status === 'paused' ? 'Resume Campaign' : 'Launch Campaign'}
                >
                  <Play size={15} />
                </button>
              )}

              {currentCampaign?.status === 'running' && (
                <button className="btn btn-secondary btn-sm" onClick={handleCancelCampaign} title="Stop Campaign">
                  <Square size={15} />
                  <span>Cancel</span>
                </button>
              )}

              {currentCampaign && ['draft', 'scheduled', 'paused'].includes(currentCampaign.status) && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenEditModal(currentCampaign)}
                  title="Edit Campaign Settings"
                >
                  <Pencil size={15} />
                  <span>Edit</span>
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
                <RefreshCw
                  size={15}
                  className={autoRefresh && currentCampaign?.status === 'running' ? 'animate-spin' : ''}
                />
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
                <span className="kpi-sub">{(stats as any)?.replyRate ?? 0}% Rate</span>
              </div>
            </div>

            <div className="kpi-card">
              <div className="kpi-icon red">
                <AlertCircle size={20} />
              </div>
              <div className="kpi-info">
                <span className="kpi-value">{(stats as any)?.optOut ?? 0}</span>
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
                  Response Rate: <strong>{(stats as any)?.replyRate ?? 0}%</strong>
                </span>
              </div>

              <div className="funnel-container">
                {(analyticsData?.funnel || []).map((step: { stage: string; count: number; percent: number }) => {
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
                    {(analyticsData?.timeline || []).map(
                      (item: any, idx: number, arr: Array<any>) => {
                        const replies = Number(item.replies ?? item.sent ?? 0) || 0;
                        const optOuts = Number(item.optOuts ?? item.failed ?? 0) || 0;
                        const key = String(item.time || item.timestamp || `slot-${idx}`);
                        const maxCount = Math.max(
                          ...arr.map(
                            (x: any) =>
                              (Number(x.replies ?? x.sent ?? 0) || 0) + (Number(x.optOuts ?? x.failed ?? 0) || 0),
                          ),
                          1,
                        );
                        const barWidth = Math.max(8, 380 / (arr.length || 1) - 4);
                        const x = 10 + idx * (380 / (arr.length || 1));
                        const hReplies = (replies / maxCount) * 110;
                        const hOpt = (optOuts / maxCount) * 110;

                        return (
                          <g key={key}>
                            <rect
                              x={x}
                              y={140 - hReplies}
                              width={barWidth}
                              height={hReplies}
                              fill="#eab308"
                              rx="3"
                              opacity="0.85"
                            >
                              <title>{`${key}: ${replies} replies`}</title>
                            </rect>
                            {optOuts > 0 && (
                              <rect
                                x={x}
                                y={140 - hReplies - hOpt}
                                width={barWidth}
                                height={hOpt}
                                fill="#ef4444"
                                rx="3"
                              >
                                <title>{`${key}: ${optOuts} opt-outs`}</title>
                              </rect>
                            )}
                          </g>
                        );
                      },
                    )}
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* 4. SPREADSHEET CRM DATA TABLE WITH FILTERS */}
          <div className="spreadsheet-card">
            <div className="spreadsheet-header-bar">
              <div className="filter-pills-bar">
                {['ALL', 'PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'OPT_OUT', 'FAILED'].map(pill => (
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
                    onChange={e => {
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
                    <th>Action</th>
                    <th>Sent At</th>
                    <th>Response / Reply</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingLeads ? (
                    <tr>
                      <td
                        colSpan={8 + customColumns.length}
                        style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                      >
                        <Loader2
                          size={24}
                          className="animate-spin"
                          style={{ display: 'inline-block', marginBottom: '0.5rem' }}
                        />
                        <p>Loading spreadsheet records...</p>
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8 + customColumns.length}
                        style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                      >
                        No recipient records match the selected filter.
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead, idx) => (
                      <tr key={lead.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{(page - 1) * 50 + idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>
                          +{String(  lead.phoneNumber || '').replace(/^\+/, '')}
                        </td>
                        <td>
                          <EditableCell
                            initialValue={lead.name || ''}
                            onSave={val => handleCellEdit(lead.id, 'name', val, false)}
                          />
                        </td>
                        {customColumns.map(col => (
                          <td key={col}>
                            <EditableCell
                              initialValue={lead.customVariables?.[col] || ''}
                              onSave={val => handleCellEdit(lead.id, col, val, true)}
                            />
                          </td>
                        ))}
                        <td>{getLeadStatusBadge(lead.status)}</td>
                        <td>
                          {lead.status === 'PENDING' || lead.status === 'FAILED' ? (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleSendSingleLead(lead.id)}
                              disabled={sendingLeadId === lead.id || isSendingNext}
                              title={
                                lead.status === 'FAILED'
                                  ? 'Retry sending message to this lead'
                                  : 'Send message 1-by-1 to this lead'
                              }
                              style={{
                                padding: '0.2rem 0.55rem',
                                fontSize: '0.75rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                borderRadius: 4,
                              }}
                            >
                              {sendingLeadId === lead.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Send size={12} />
                              )}
                              <span>{lead.status === 'FAILED' ? 'Retry' : 'Send'}</span>
                            </button>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                              }}
                              title="Message dispatched"
                            >
                              <CheckCheck size={14} style={{ color: '#22c55e' }} />
                              <span>Sent</span>
                            </span>
                          )}
                        </td>
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
          <Modal title="Add Numbers to Campaign" onClose={() => setShowAddModal(false)} open={showAddModal}>
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
                    onChange={e => setBulkInputText(e.target.value)}
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
                      onChange={e => setSinglePhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Contact Name"
                      value={singleName}
                      onChange={e => setSingleName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
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
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Contact
                  </span>
                  <p style={{ fontWeight: 600 }}>
                    {selectedLeadForReply.name || 'Unnamed'} (+{selectedLeadForReply.phoneNumber})
                  </p>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Received Message
                  </span>
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
                  Replied at:{' '}
                  {selectedLeadForReply.repliedAt ? new Date(selectedLeadForReply.repliedAt).toLocaleString() : '—'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedLeadForReply(null)}>
                    Close
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* EDIT CAMPAIGN MODAL */}
      <Modal
        title={`Edit Campaign: ${editingCampaign?.name || ''}`}
        onClose={() => setShowEditModal(false)}
        open={showEditModal}
        className="edit-campaign-dialog"
      >
        {/* Minimal Tab Navigation */}
        <div className="minimal-tab-bar">
          <button
            type="button"
            className={`minimal-tab-btn ${editModalTab === 'content' ? 'active' : ''}`}
            onClick={() => setEditModalTab('content')}
          >
            <MessageSquare size={14} />
            <span>Message & Content</span>
          </button>
          <button
            type="button"
            className={`minimal-tab-btn ${editModalTab === 'settings' ? 'active' : ''}`}
            onClick={() => setEditModalTab('settings')}
          >
            <Send size={14} />
            <span>Senders & Delivery ({editSessions.length})</span>
          </button>
        </div>

        <form onSubmit={handleSaveCampaignEdit} className="minimal-form">
          {editModalTab === 'content' ? (
            <>
              <div className="minimal-field">
                <label htmlFor="edit-campaign-name">Campaign Name</label>
                <input
                  id="edit-campaign-name"
                  type="text"
                  className="minimal-input"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="e.g. Q4 Black Friday Promo"
                />
              </div>

              <div className="minimal-field">
                <div className="minimal-tag-bar">
                  <label htmlFor="edit-campaign-template">Message Template</label>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Insert Tag:</span>
                    {['{{Name}}', '{{phone}}', '{Hi|Hello|Hey}'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        className="minimal-tag-chip"
                        onClick={() => setEditTemplate(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  id="edit-campaign-template"
                  className="minimal-input minimal-textarea"
                  rows={5}
                  value={editTemplate}
                  onChange={e => setEditTemplate(e.target.value)}
                  placeholder="Enter message text with {Spintax|Variants} and {{Variable}} tags..."
                />
              </div>

              <div className="minimal-field">
                <label htmlFor="edit-media-url">Media Attachment URL (Optional)</label>
                <input
                  id="edit-media-url"
                  type="text"
                  className="minimal-input"
                  placeholder="https://example.com/image.png"
                  value={editMediaUrl}
                  onChange={e => setEditMediaUrl(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="minimal-field">
                <label>Assigned WhatsApp Senders ({editSessions.length} selected)</label>
                <div className="minimal-senders-list">
                  {allSessions.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: '#64748b', padding: '0.4rem 0' }}>
                      No connected WhatsApp sessions available
                    </span>
                  ) : (
                    allSessions.map(session => {
                      const isChecked = editSessions.includes(session.id);
                      return (
                        <label key={session.id} className="minimal-sender-item">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              if (e.target.checked) {
                                setEditSessions(prev => [...prev, session.id]);
                              } else {
                                setEditSessions(prev => prev.filter(id => id !== session.id));
                              }
                            }}
                          />
                          <span>
                            <strong>{session.name || session.id}</strong> (
                            {session.phone || session.status || 'Connected'})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="minimal-field">
                <label htmlFor="edit-scheduled-at">Schedule Date & Time</label>
                <input
                  id="edit-scheduled-at"
                  type="datetime-local"
                  className="minimal-input"
                  value={editScheduledAt}
                  onChange={e => setEditScheduledAt(e.target.value)}
                />
              </div>

              <div className="minimal-field">
                <label>Dispatch Mode</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setEditDispatchMode('automated')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: 6,
                      border: editDispatchMode === 'automated' ? '1px solid #22c55e' : '1px solid #334155',
                      background: editDispatchMode === 'automated' ? 'rgba(34, 197, 94, 0.1)' : '#1e293b',
                      color: editDispatchMode === 'automated' ? '#22c55e' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      justifyContent: 'center',
                    }}
                  >
                    ⚡ Automated (Auto-Paced)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDispatchMode('manual')}
                    style={{
                      padding: '0.6rem',
                      borderRadius: 6,
                      border: editDispatchMode === 'manual' ? '1px solid #38bdf8' : '1px solid #334155',
                      background: editDispatchMode === 'manual' ? 'rgba(56, 189, 248, 0.1)' : '#1e293b',
                      color: editDispatchMode === 'manual' ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      justifyContent: 'center',
                    }}
                  >
                    👆 Manual (1-by-1 Send)
                  </button>
                </div>
              </div>

              <div className="minimal-field">
                <label>Anti-Ban Pacing & Delays</label>
                <div className="minimal-pacing-row">
                  <div className="minimal-pacing-group">
                    <span>Delay:</span>
                    <input
                      type="number"
                      aria-label="Minimum delay in seconds"
                      className="minimal-input minimal-num-input"
                      min={1}
                      max={60}
                      value={editMinDelay}
                      onChange={e => setEditMinDelay(Number(e.target.value))}
                    />
                    <span>to</span>
                    <input
                      type="number"
                      aria-label="Maximum delay in seconds"
                      className="minimal-input minimal-num-input"
                      min={1}
                      max={120}
                      value={editMaxDelay}
                      onChange={e => setEditMaxDelay(Number(e.target.value))}
                    />
                    <span>sec</span>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      color: '#e2e8f0',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editSimulateTyping}
                      onChange={e => setEditSimulateTyping(e.target.checked)}
                    />
                    <span>Simulate typing</span>
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="minimal-footer">
            <button type="button" className="btn-minimal-cancel" onClick={() => setShowEditModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-minimal-save" disabled={isSavingEdit}>
              {isSavingEdit ? <Loader2 size={15} className="animate-spin" /> : <Pencil size={14} />}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
