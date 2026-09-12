import { useState, useEffect } from 'react';
import type { ChatMessage } from '../../services/api';

export interface ChatBubble {
  chatId: string;
  sessionId: string;
  name: string;
  avatarUrl?: string;
  unreadCount: number;
  isOpen: boolean;
  lastMessage?: string;
  lastMessageObject?: ChatMessage;
  timestamp?: number;
}

export interface LivelyAlert {
  id: string;
  chatId: string;
  sessionId: string;
  name: string;
  text: string;
  avatarUrl?: string;
  timestamp: number;
}

export interface BubbleStoreSnapshot {
  bubbles: ChatBubble[];
  activeBubbleId: string | null;
  expandedDocks: Record<string, boolean>;
  livelyAlert: LivelyAlert | null;
  totalUnread: number;
}

const STORAGE_KEY = 'leadweave_active_bubbles';
const MAX_BUBBLES = 25;

class BubbleStore {
  private bubbles: ChatBubble[] = [];
  private activeBubbleId: string | null = null;
  private expandedDocks: Record<string, boolean> = {}; // sessionId -> expanded
  private livelyAlert: LivelyAlert | null = null;
  private alertTimeout: ReturnType<typeof setTimeout> | null = null;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private notifyTimeout: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.bubbles = parsed.slice(0, MAX_BUBBLES);
        }
      }
    } catch {
      this.bubbles = [];
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.bubbles));
    } catch (e) {
      console.warn('Failed to save bubbles to localStorage', e);
    }
  }

  private saveToStorageDebounced() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveToStorage();
    }, 300);
  }

  private notifyListenersDebounced() {
    if (this.notifyTimeout) {
      clearTimeout(this.notifyTimeout);
    }
    this.notifyTimeout = setTimeout(() => {
      this.notifyTimeout = null;
      this.listeners.forEach((listener) => listener());
    }, 50);
  }

  private notify() {
    this.saveToStorageDebounced();
    this.notifyListenersDebounced();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getSnapshot(): BubbleStoreSnapshot {
    const totalUnread = this.bubbles.reduce((sum, b) => sum + (b.unreadCount || 0), 0);
    return {
      bubbles: this.bubbles,
      activeBubbleId: this.activeBubbleId,
      expandedDocks: this.expandedDocks,
      livelyAlert: this.livelyAlert,
      totalUnread,
    };
  }

  public toggleDock(sessionId: string) {
    const isExpanded = !!this.expandedDocks[sessionId];
    this.expandedDocks = {
      ...this.expandedDocks,
      [sessionId]: !isExpanded
    };
    
    if (isExpanded) {
      // If collapsing the dock, also close any open drawer for this session
      this.bubbles = this.bubbles.map((b) => 
        b.sessionId === sessionId ? { ...b, isOpen: false } : b
      );
      if (this.activeBubbleId) {
        const activeBubble = this.bubbles.find(b => b.chatId === this.activeBubbleId);
        if (activeBubble && activeBubble.sessionId === sessionId) {
          this.activeBubbleId = null;
        }
      }
    }
    this.notify();
  }

  public setDockExpanded(sessionId: string, expanded: boolean) {
    this.expandedDocks = {
      ...this.expandedDocks,
      [sessionId]: expanded
    };
    
    if (!expanded) {
      this.bubbles = this.bubbles.map((b) => 
        b.sessionId === sessionId ? { ...b, isOpen: false } : b
      );
      if (this.activeBubbleId) {
        const activeBubble = this.bubbles.find(b => b.chatId === this.activeBubbleId);
        if (activeBubble && activeBubble.sessionId === sessionId) {
          this.activeBubbleId = null;
        }
      }
    }
    this.notify();
  }

  public updateBubbleName(chatId: string, name: string) {
    if (!name) return;
    const existingIndex = this.bubbles.findIndex((b) => b.chatId === chatId);
    if (existingIndex >= 0) {
      const existing = this.bubbles[existingIndex];
      const isExistingNumeric = !existing.name || /^\+?\d+$/.test(existing.name.replace(/[\s()-]/g, '')) || existing.name.includes('@');
      const isNewBetter = name && !/^\+?\d+$/.test(name.replace(/[\s()-]/g, '')) && !name.includes('@');
      if (isNewBetter || isExistingNumeric) {
        this.bubbles = [
          ...this.bubbles.slice(0, existingIndex),
          { ...existing, name },
          ...this.bubbles.slice(existingIndex + 1),
        ];
        this.notify();
      }
    }
  }

  public addOrUpdateBubble(data: {
    chatId: string;
    sessionId: string;
    name: string;
    avatarUrl?: string;
    incrementUnread?: boolean;
    unreadCount?: number;
    lastMessage?: string;
    lastMessageObject?: ChatMessage;
    showLivelyAlert?: boolean;
  }) {
    const existingIndex = this.bubbles.findIndex((b) => b.chatId === data.chatId);

    if (existingIndex >= 0) {
      const existing = this.bubbles[existingIndex];
      const isExistingNumeric = !existing.name || /^\+?\d+$/.test(existing.name.replace(/[\s()-]/g, '')) || existing.name.includes('@');
      const isNewBetter = data.name && !/^\+?\d+$/.test(data.name.replace(/[\s()-]/g, '')) && !data.name.includes('@');
      const resolvedName = isNewBetter ? data.name : (!isExistingNumeric ? existing.name : data.name);
      const updatedUnread = data.incrementUnread
        ? existing.unreadCount + 1
        : (data.unreadCount !== undefined ? data.unreadCount : existing.unreadCount);

      const updated: ChatBubble = {
        ...existing,
        name: resolvedName || existing.name || data.name,
        avatarUrl: data.avatarUrl || existing.avatarUrl,
        unreadCount: updatedUnread,
        lastMessage: data.lastMessage || existing.lastMessage,
        lastMessageObject: data.lastMessageObject || existing.lastMessageObject,
        timestamp: Date.now(),
      };
      this.bubbles = [
        ...this.bubbles.slice(0, existingIndex),
        updated,
        ...this.bubbles.slice(existingIndex + 1),
      ];
    } else {
      const initialUnread = data.incrementUnread
        ? 1
        : (data.unreadCount !== undefined ? data.unreadCount : 0);

      const newBubble: ChatBubble = {
        chatId: data.chatId,
        sessionId: data.sessionId,
        name: data.name,
        avatarUrl: data.avatarUrl,
        unreadCount: initialUnread,
        isOpen: false,
        lastMessage: data.lastMessage,
        lastMessageObject: data.lastMessageObject,
        timestamp: Date.now(),
      };
      this.bubbles = [newBubble, ...this.bubbles];
      if (this.bubbles.length > MAX_BUBBLES) {
        const open = this.bubbles.filter((b) => b.isOpen);
        const closed = this.bubbles.filter((b) => !b.isOpen);
        this.bubbles = [...open, ...closed.slice(0, Math.max(0, MAX_BUBBLES - open.length))];
      }
    }

    if (data.showLivelyAlert && data.lastMessage) {
      this.triggerLivelyAlert({
        id: `alert-${Date.now()}`,
        chatId: data.chatId,
        sessionId: data.sessionId,
        name: data.name,
        text: data.lastMessage,
        avatarUrl: data.avatarUrl,
        timestamp: Date.now(),
      });
    }

    this.notify();
  }

  public batchAddOrUpdateBubbles(
    items: Array<{
      chatId: string;
      sessionId: string;
      name: string;
      avatarUrl?: string;
      incrementUnread?: boolean;
      unreadCount?: number;
      lastMessage?: string;
      lastMessageObject?: ChatMessage;
      showLivelyAlert?: boolean;
    }>,
  ) {
    if (!items || items.length === 0) return;

    let updatedBubbles = [...this.bubbles];
    let hasChanges = false;
    let latestAlertData: (typeof items)[0] | null = null;

    for (const data of items) {
      const existingIndex = updatedBubbles.findIndex((b) => b.chatId === data.chatId);

      if (existingIndex >= 0) {
        const existing = updatedBubbles[existingIndex];
        const isExistingNumeric =
          !existing.name ||
          /^\+?\d+$/.test(existing.name.replace(/[\s()-]/g, '')) ||
          existing.name.includes('@');
        const isNewBetter =
          data.name &&
          !/^\+?\d+$/.test(data.name.replace(/[\s()-]/g, '')) &&
          !data.name.includes('@');
        const resolvedName = isNewBetter ? data.name : !isExistingNumeric ? existing.name : data.name;
        const updatedUnread = data.incrementUnread
          ? existing.unreadCount + 1
          : data.unreadCount !== undefined
            ? data.unreadCount
            : existing.unreadCount;

        if (
          existing.name === (resolvedName || existing.name || data.name) &&
          existing.unreadCount === updatedUnread &&
          existing.lastMessage === (data.lastMessage || existing.lastMessage) &&
          existing.avatarUrl === (data.avatarUrl || existing.avatarUrl)
        ) {
          continue;
        }

        hasChanges = true;
        const updated: ChatBubble = {
          ...existing,
          name: resolvedName || existing.name || data.name,
          avatarUrl: data.avatarUrl || existing.avatarUrl,
          unreadCount: updatedUnread,
          lastMessage: data.lastMessage || existing.lastMessage,
          lastMessageObject: data.lastMessageObject || existing.lastMessageObject,
          timestamp: Date.now(),
        };
        updatedBubbles[existingIndex] = updated;
      } else {
        hasChanges = true;
        const initialUnread = data.incrementUnread
          ? 1
          : data.unreadCount !== undefined
            ? data.unreadCount
            : 0;

        const newBubble: ChatBubble = {
          chatId: data.chatId,
          sessionId: data.sessionId,
          name: data.name,
          avatarUrl: data.avatarUrl,
          unreadCount: initialUnread,
          isOpen: false,
          lastMessage: data.lastMessage,
          lastMessageObject: data.lastMessageObject,
          timestamp: Date.now(),
        };
        updatedBubbles.unshift(newBubble);
      }

      if (data.showLivelyAlert && data.lastMessage) {
        latestAlertData = data;
      }
    }

    if (updatedBubbles.length > MAX_BUBBLES) {
      const open = updatedBubbles.filter((b) => b.isOpen);
      const closed = updatedBubbles.filter((b) => !b.isOpen);
      updatedBubbles = [...open, ...closed.slice(0, Math.max(0, MAX_BUBBLES - open.length))];
    }

    if (hasChanges) {
      this.bubbles = updatedBubbles;
      // Emit only one notification for the entire batch, with alerts included
      if (latestAlertData) {
        this.triggerLivelyAlert({
          id: `alert-${Date.now()}`,
          chatId: latestAlertData.chatId,
          sessionId: latestAlertData.sessionId,
          name: latestAlertData.name,
          text: latestAlertData.lastMessage!,
          avatarUrl: latestAlertData.avatarUrl,
          timestamp: Date.now(),
        });
      } else {
        this.notify();
      }
    }
  }

  public triggerLivelyAlert(alert: LivelyAlert) {
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
    }
    this.livelyAlert = alert;
    this.alertTimeout = setTimeout(() => {
      this.livelyAlert = null;
      this.notifyListenersDebounced();
      this.saveToStorageDebounced();
    }, 4500);
    this.notifyListenersDebounced();
    this.saveToStorageDebounced();
  }

  public dismissLivelyAlert() {
    if (this.alertTimeout) {
      clearTimeout(this.alertTimeout);
      this.alertTimeout = null;
    }
    this.livelyAlert = null;
    this.notify();
  }

  public removeBubble(chatId: string) {
    this.bubbles = this.bubbles.filter((b) => b.chatId !== chatId);
    if (this.activeBubbleId === chatId) {
      this.activeBubbleId = null;
    }
    this.notify();
  }

  public openDrawer(chatId: string) {
    this.dismissLivelyAlert();
    this.bubbles = this.bubbles.map((b) => ({
      ...b,
      isOpen: b.chatId === chatId,
      unreadCount: b.chatId === chatId ? 0 : b.unreadCount,
    }));
    this.activeBubbleId = chatId;
    this.notify();
  }

  public toggleBubbleOpen(chatId: string) {
    this.dismissLivelyAlert();
    const target = this.bubbles.find((b) => b.chatId === chatId);
    if (!target) return;

    const willOpen = !target.isOpen;
    this.bubbles = this.bubbles.map((b) => ({
      ...b,
      isOpen: b.chatId === chatId ? willOpen : false,
      unreadCount: b.chatId === chatId ? 0 : b.unreadCount,
    }));
    this.activeBubbleId = willOpen ? chatId : null;
    this.notify();
  }

  public closeDrawer() {
    this.bubbles = this.bubbles.map((b) => ({ ...b, isOpen: false }));
    this.activeBubbleId = null;
    this.notify();
  }

  public markAsRead(chatId: string) {
    this.bubbles = this.bubbles.map((b) =>
      b.chatId === chatId ? { ...b, unreadCount: 0 } : b
    );
    this.notify();
  }
}

export const bubbleStore = new BubbleStore();

const selectWholeBubbleSnapshot = (snapshot: BubbleStoreSnapshot) => snapshot;

export function useBubbleStore<T = BubbleStoreSnapshot>(
  selector: (snapshot: BubbleStoreSnapshot) => T = selectWholeBubbleSnapshot as (snapshot: BubbleStoreSnapshot) => T,
): T {
  const [selectedSnapshot, setSelectedSnapshot] = useState(() => selector(bubbleStore.getSnapshot()));

  useEffect(() => {
    setSelectedSnapshot(selector(bubbleStore.getSnapshot()));

    return bubbleStore.subscribe(() => {
      const nextSelectedSnapshot = selector(bubbleStore.getSnapshot());
      setSelectedSnapshot(currentSnapshot =>
        Object.is(currentSnapshot, nextSelectedSnapshot) ? currentSnapshot : nextSelectedSnapshot,
      );
    });
  }, [selector]);

  return selectedSnapshot;
}
