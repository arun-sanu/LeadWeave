/**
 * LeadWeave JavaScript/TypeScript SDK.
 *
 * Official client library for the LeadWeave WhatsApp API Gateway.
 *
 * @example
 * ```typescript
 * import { LeadWeaveClient, LeadWeaveApiError } from '@arun-sanu/leadweave';
 *
 * const client = new LeadWeaveClient({
 *   baseUrl: 'http://localhost:2785',
 *   apiKey: 'owa_k1_…',
 * });
 *
 * await client.sessions.start('my-session');
 * const result = await client.messages.sendText('my-session', {
 *   chatId: '628123456789@c.us',
 *   text: 'Hello from the LeadWeave SDK!',
 * });
 * console.log(result.messageId);
 * ```
 *
 * @packageDocumentation
 */

export { LeadWeaveClient } from './client.js';
export { default } from './client.js';
export type { LeadWeaveClientOptions } from './client.js';
export * from './errors.js';
export type * from './types.js';
export type { BinaryResponse, ClientConfig, FetchLike, HttpMethod, RequestOptions } from './http.js';
export { buildUrl, warnIfInsecureHttpUrl } from './http.js';
