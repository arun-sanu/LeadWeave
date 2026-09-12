import { EngineStatus } from '../models/engine-status.enum';
import type {
  EngineEventCallbacks,
  MessageResult,
  MediaInput,
  LocationInput,
  ContactCard,
  PollInput,
  CustomLinkPreview,
  Quotable,
  MessageReaction,
  IncomingMessage,
  Contact,
  Group,
  GroupInfo,
  GroupJoinInfo,
  GroupMemberAddMode,
  GroupMembershipRequest,
  ParticipantOperationResult,
  AccountRestriction,
  PresenceUpdateEvent,
  Status,
  StatusPostOptions,
  StatusResult,
  Channel,
  ChannelMessage,
  Catalog,
  Product,
  ProductQueryOptions,
  PaginatedProducts,
  ChatSummary,
  ChatState,
  Label,
  LabelInput,
} from '../whatsapp-engine.interface';

export interface SessionLifecycleCapability {
  initialize(callbacks: EngineEventCallbacks): Promise<void>;
  disconnect(): Promise<void>;
  logout(): Promise<void>;
  destroy(): Promise<void>;
  forceDestroy(): Promise<void>;
  getStatus(): EngineStatus;
  probeLiveness?(): Promise<boolean>;
  getQRCode(): string | null;
  requestPairingCode(phoneNumber: string): Promise<string>;
  getPhoneNumber(): string | null;
  getPushName(): string | null;
}

export interface MessagingCapability {
  sendTextMessage(
    chatId: string,
    text: string,
    mentions?: string[],
    options?: { linkPreview?: boolean; customPreview?: CustomLinkPreview } & Quotable,
  ): Promise<MessageResult>;
  sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
  sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
  sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
  sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
  sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult>;
  sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult>;
  sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
  sendPollMessage(chatId: string, poll: PollInput): Promise<MessageResult>;
  replyToMessage(chatId: string, quotedMsgId: string, text: string, mentions?: string[]): Promise<MessageResult>;
  forwardMessage(fromChatId: string, toChatId: string, messageId: string): Promise<MessageResult>;
}

export interface MessageOperationsCapability {
  reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void>;
  getMessageReactions(chatId: string, messageId: string): Promise<MessageReaction[]>;
  deleteMessage(chatId: string, messageId: string, forEveryone?: boolean): Promise<void>;
  editMessage(chatId: string, messageId: string, body: string, mentions?: string[]): Promise<MessageResult>;
  starMessage(chatId: string, messageId: string, star: boolean): Promise<void>;
  votePoll(chatId: string, pollMessageId: string, options: string[]): Promise<void>;
  pinMessage(chatId: string, messageId: string, durationSeconds: number): Promise<void>;
  unpinMessage(chatId: string, messageId: string): Promise<void>;
}

export interface ChatHistoryCapability {
  getChatHistory(
    chatId: string,
    limit?: number,
    includeMedia?: boolean,
    mediaMaxBytes?: number,
    signal?: AbortSignal,
  ): Promise<IncomingMessage[]>;
}

