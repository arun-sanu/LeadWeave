import { request, API_BASE_URL } from './client';
import type { Campaign, CampaignLead, CampaignStats, CampaignAnalytics } from '../api';

export const campaignApi = {
  create: (data: {
    name: string;
    sessionIds: string[];
    template: string;
    mediaUrl?: string;
    scheduledAt?: string;
    pacing?: { minDelayMs?: number; maxDelayMs?: number; simulateTyping?: boolean };
    columnsMetadata?: string[];
    leads: Array<{ phone: string; name?: string; variables?: Record<string, string> }>;
    autoLaunch?: boolean;
    dispatchMode?: 'automated' | 'manual';
  }) =>
    request<Campaign>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendSingleLead: (campaignId: string, leadId: string) =>
    request<{
      success: boolean;
      lead: CampaignLead;
      pauseReason?: string;
      remainingPending: number;
      stats: CampaignStats;
    }>(`/campaigns/${campaignId}/leads/${leadId}/send`, { method: 'POST' }),

  sendNextLead: (campaignId: string) =>
    request<{
      hasMore: boolean;
      success?: boolean;
      lead?: CampaignLead;
      message?: string;
      pauseReason?: string;
      remainingPending: number;
      stats: CampaignStats;
    }>(`/campaigns/${campaignId}/send-next`, { method: 'POST' }),

  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ items: Campaign[]; total: number }>(`/campaigns${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => request<Campaign>(`/campaigns/${id}`),

  update: (
    id: string,
    data: {
      name?: string;
      sessionIds?: string[];
      template?: string;
      mediaUrl?: string;
      dispatchMode?: 'automated' | 'manual';
      scheduledAt?: string;
      pacing?: { minDelayMs?: number; maxDelayMs?: number; simulateTyping?: boolean };
    },
  ) =>
    request<Campaign>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  start: (id: string) => request<Campaign>(`/campaigns/${id}/start`, { method: 'POST' }),

  pause: (id: string) => request<Campaign>(`/campaigns/${id}/pause`, { method: 'POST' }),

  cancel: (id: string) => request<Campaign>(`/campaigns/${id}/cancel`, { method: 'POST' }),

  addLeads: (id: string, leads: Array<{ phone: string; name?: string; variables?: Record<string, string> }>) =>
    request<{ added: number; newTotal: number }>(`/campaigns/${id}/leads`, {
      method: 'POST',
      body: JSON.stringify({ leads }),
    }),

  updateLead: (campaignId: string, leadId: string, data: { name?: string; customVariables?: Record<string, string> }) =>
    request<CampaignLead>(`/campaigns/${campaignId}/leads/${leadId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listLeads: (id: string, params?: { status?: string; search?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return request<{ items: CampaignLead[]; total: number }>(`/campaigns/${id}/leads${qs ? `?${qs}` : ''}`);
  },

  getAnalytics: (id: string) => request<CampaignAnalytics>(`/campaigns/${id}/analytics`),

  getExportUrl: (id: string) => `${API_BASE_URL}/campaigns/${id}/export`,
};
