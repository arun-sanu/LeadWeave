import { request } from './client';
import type {
  MessageResponse,
  SendMediaPayload,
  SendLocationPayload,
  SendContactPayload,
  SendPollPayload,
  ForwardMessagePayload,
  SendBulkPayload,
  BulkBatchResponse,
  BatchStatusResponse,
} from '../api';

export const messageApi = {
  sendText: (sessionId: string, chatId: string, text: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text }),
    }),
  sendMedia: (
    sessionId: string,
    chatId: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    payload: SendMediaPayload,
  ) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-${mediaType}`, {
      method: 'POST',
      body: JSON.stringify({ chatId, ...payload }),
    }),
  sendLocation: (sessionId: string, data: SendLocationPayload) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-location`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendContact: (sessionId: string, data: SendContactPayload) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-contact`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendSticker: (sessionId: string, chatId: string, payload: SendMediaPayload) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-sticker`, {
      method: 'POST',
      body: JSON.stringify({ chatId, ...payload }),
    }),
  sendPoll: (sessionId: string, data: SendPollPayload) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-poll`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  forward: (sessionId: string, data: ForwardMessagePayload) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/forward`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  sendBulk: (sessionId: string, data: SendBulkPayload) =>
    request<BulkBatchResponse>(`/sessions/${sessionId}/messages/send-bulk`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBatchStatus: (sessionId: string, batchId: string) =>
    request<BatchStatusResponse>(`/sessions/${sessionId}/messages/batch/${encodeURIComponent(batchId)}`),
  cancelBatch: (sessionId: string, batchId: string) =>
    request<BatchStatusResponse>(`/sessions/${sessionId}/messages/batch/${encodeURIComponent(batchId)}/cancel`, {
      method: 'POST',
    }),
  reply: (sessionId: string, data: { chatId: string; quotedMessageId: string; text: string }) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  react: (sessionId: string, data: { chatId: string; messageId: string; emoji: string }) =>
    request<void>(`/sessions/${sessionId}/messages/react`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (sessionId: string, data: { chatId: string; messageId: string; forEveryone?: boolean }) =>
    request<void>(`/sessions/${sessionId}/messages/delete`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
