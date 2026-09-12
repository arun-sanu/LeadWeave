import { request, requestBlob } from './client';
import type {
  Session,
  SessionConfig,
  SessionStats,
  Chat,
  ChatMessage,
  EngineHistoryMessage,
  Channel,
  ChannelMessage,
  StatusUpdate,
} from '../api';

export const sessionApi = {
  list: () => request<Session[]>('/sessions'),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (name: string) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  getConfig: (id: string) => request<SessionConfig>(`/sessions/${id}/config`),
  updateConfig: (id: string, patch: Partial<Record<keyof SessionConfig, boolean | number | null>>) =>
    request<SessionConfig>(`/sessions/${id}/config`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  start: (id: string) => request<Session>(`/sessions/${id}/start`, { method: 'POST' }),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: 'POST' }),
  logout: (id: string) => request<Session>(`/sessions/${id}/logout`, { method: 'POST' }),
  forceKill: (id: string) => request<Session>(`/sessions/${id}/force-kill`, { method: 'POST' }),
  getQR: (id: string) => request<{ qrCode: string; status: string }>(`/sessions/${id}/qr`),
  requestPairingCode: (id: string, phoneNumber: string) =>
    request<{ pairingCode: string; status: string }>(`/sessions/${id}/pairing-code`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    }),
  getStats: () => request<SessionStats>('/sessions/stats/overview'),
  getGroups: (id: string) =>
    request<{ id: string; name: string; linkedParentJID?: string | null }[]>(`/sessions/${id}/groups`),
  getChats: (id: string) => request<Chat[]>(`/sessions/${id}/chats`),
  archiveChat: (id: string, chatId: string, archive: boolean) =>
    request<{ success: boolean }>(`/sessions/${id}/chats/archive`, {
      method: 'POST',
      body: JSON.stringify({ chatId, archive }),
    }),
  markChatRead: (id: string, chatId: string) =>
    request<{ success: boolean }>(`/sessions/${id}/chats/read`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    }),
  getChatMessages: (id: string, chatId: string, limit = 100) =>
    request<{ messages: ChatMessage[]; total: number }>(
      `/sessions/${id}/messages?chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
    ),
  getChatHistory: (id: string, chatId: string, limit = 100, includeMedia = false) =>
    request<EngineHistoryMessage[]>(
      `/sessions/${id}/messages/${encodeURIComponent(chatId)}/history?limit=${limit}${
        includeMedia ? '&includeMedia=true' : ''
      }`,
    ),
  getMessageMediaBlob: (id: string, chatId: string, messageId: string) =>
    requestBlob(`/sessions/${id}/messages/${encodeURIComponent(chatId)}/${encodeURIComponent(messageId)}/media`),
  getSubscribedChannels: (id: string) => request<Channel[]>(`/sessions/${id}/channels`),
  getChannelMessages: (id: string, channelId: string, limit = 50) =>
    request<ChannelMessage[]>(`/sessions/${id}/channels/${encodeURIComponent(channelId)}/messages?limit=${limit}`),
  getContactStatuses: (id: string) => request<{ statuses: StatusUpdate[] }>(`/sessions/${id}/status`),
  getStatusMediaBlob: (id: string, statusId: string) =>
    requestBlob(`/sessions/${id}/status/${encodeURIComponent(statusId)}/media`),
  postTextStatus: (
    id: string,
    text: string,
    recipients?: string[],
    extra?: { backgroundColor?: string; font?: number },
  ) =>
    request(`/sessions/${id}/status/send-text`, {
      method: 'POST',
      body: JSON.stringify({ text, recipients, ...extra }),
    }),
  postImageStatus: (
    id: string,
    image: { url?: string; base64?: string; mimetype?: string },
    recipients?: string[],
    caption?: string,
  ) =>
    request(`/sessions/${id}/status/send-image`, {
      method: 'POST',
      body: JSON.stringify({ image, recipients, caption }),
    }),
};
