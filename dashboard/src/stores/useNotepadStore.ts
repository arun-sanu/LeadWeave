import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PastelColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

export interface StickyNote {
  id: string;
  noteId: string;
  content: string;
  color: PastelColor;
  isPinnedToScreen: boolean;
  position?: { x: number; y: number };
  alertAt?: string; // ISO string
  isAlertTriggered?: boolean;
  createdAt: string;
}

export interface Note {
  id: string;
  title: string; // custom title or empty
  content: string;
  createdAt: string;
  updatedAt: string;
  isOpen: boolean; // is this specific note window open on screen
  isPinned: boolean; // note pinned state across page navigation
  position: { x: number; y: number }; // floating window coordinates for this note
  alertAt?: string; // ISO string
  isAlertTriggered?: boolean;
  stickyNotes: StickyNote[];
}

export interface NotepadState {
  notes: Note[];
  isCalendarOpen: boolean;
  isSearchModalOpen: boolean;

  // Actions
  createNote: (customTitle?: string) => string;
  deleteNote: (id: string) => void;
  closeNote: (id: string) => void;
  openNote: (id: string) => void;
  updateNoteTitle: (id: string, title: string) => void;
  updateNoteContent: (id: string, content: string) => void;
  togglePinNote: (id: string) => void;
  setNotePosition: (id: string, pos: { x: number; y: number }) => void;
  setNoteAlert: (id: string, alertAt: string | undefined) => void;

  // Sticky Note Actions
  addStickyNote: (noteId: string, color?: PastelColor) => void;
  updateStickyNote: (noteId: string, stickyId: string, updates: Partial<Omit<StickyNote, 'id' | 'noteId'>>) => void;
  deleteStickyNote: (noteId: string, stickyId: string) => void;
  togglePinStickyNote: (noteId: string, stickyId: string) => void;
  updateStickyPosition: (stickyId: string, position: { x: number; y: number }) => void;
  moveStickyNoteToNote: (stickyId: string, sourceNoteId: string, targetNoteId: string) => void;

  // Global & UI Actions
  toggleNotepadOpen: () => void;
  setCalendarOpen: (isOpen: boolean) => void;
  setSearchModalOpen: (isOpen: boolean) => void;

  // Alert Actions
  snoozeAlert: (targetId: string, type: 'note' | 'sticky', minutes: number) => void;
  dismissAlert: (targetId: string, type: 'note' | 'sticky') => void;
}

export const PASTEL_COLORS: Record<
  PastelColor,
  { name: string; bg: string; border: string; text: string; ring: string }
> = {
  yellow: { name: 'Yellow', bg: '#FEF9C3', border: 'rgba(234, 179, 8, 0.35)', text: '#713F12', ring: '#EAB308' },
  green: { name: 'Green', bg: '#DCFCE7', border: 'rgba(34, 197, 94, 0.35)', text: '#14532D', ring: '#22C55E' },
  blue: { name: 'Blue', bg: '#E0F2FE', border: 'rgba(14, 165, 233, 0.35)', text: '#0C4A6E', ring: '#0EA5E9' },
  pink: { name: 'Pink', bg: '#FCE7F3', border: 'rgba(236, 72, 153, 0.35)', text: '#831843', ring: '#EC4899' },
  purple: { name: 'Purple', bg: '#F3E8FF', border: 'rgba(168, 85, 247, 0.35)', text: '#581C87', ring: '#A855F7' },
  orange: { name: 'Orange', bg: '#FFEDD5', border: 'rgba(249, 115, 22, 0.35)', text: '#7C2D12', ring: '#F97316' },
};

export function formatNoteDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  } catch {
    return '';
  }
}

export function getNoteDisplayName(note: Note, index: number): string {
  if (note.title && note.title.trim() !== '') {
    return note.title.trim();
  }
  const dateStr = formatNoteDate(note.createdAt);
  return `Note ${index + 1}${dateStr ? ` (${dateStr})` : ''}`;
}

export const useNotepadStore = create<NotepadState>()(
  persist(
    (set, get) => ({
      notes: [],
      isCalendarOpen: false,
      isSearchModalOpen: false,

      createNote: (customTitle?: string) => {
        const now = new Date().toISOString();
        const existingCount = get().notes.length;
        const offset = (existingCount % 5) * 32;
        const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

        const newNoteId = `note-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        const newNote: Note = {
          id: newNoteId,
          title: customTitle || '',
          content: '',
          createdAt: now,
          updatedAt: now,
          isOpen: true,
          isPinned: false,
          position: {
            x: Math.max(20, winWidth - 460 - offset),
            y: 90 + offset,
          },
          stickyNotes: [],
        };

        set(state => ({
          notes: [newNote, ...state.notes],
        }));

        return newNoteId;
      },

      deleteNote: (id: string) => {
        set(state => ({
          notes: state.notes.filter(n => n.id !== id),
        }));
      },

      closeNote: (id: string) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, isOpen: false } : n)),
        }));
      },

      openNote: (id: string) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, isOpen: true } : n)),
        }));
      },

      updateNoteTitle: (id: string, title: string) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, title, updatedAt: new Date().toISOString() } : n)),
        }));
      },

      updateNoteContent: (id: string, content: string) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, content, updatedAt: new Date().toISOString() } : n)),
        }));
      },

      togglePinNote: (id: string) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, isPinned: !n.isPinned } : n)),
        }));
      },

      setNotePosition: (id: string, pos: { x: number; y: number }) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, position: pos } : n)),
        }));
      },

      setNoteAlert: (id: string, alertAt: string | undefined) => {
        set(state => ({
          notes: state.notes.map(n => (n.id === id ? { ...n, alertAt, isAlertTriggered: false } : n)),
        }));
      },

      addStickyNote: (noteId: string, color: PastelColor = 'yellow') => {
        const now = new Date().toISOString();
        const newSticky: StickyNote = {
          id: `sticky-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          noteId,
          content: '',
          color,
          isPinnedToScreen: false,
          createdAt: now,
        };

        set(state => ({
          notes: state.notes.map(n =>
            n.id === noteId ? { ...n, stickyNotes: [...n.stickyNotes, newSticky], updatedAt: now } : n,
          ),
        }));
      },

      updateStickyNote: (noteId: string, stickyId: string, updates: Partial<Omit<StickyNote, 'id' | 'noteId'>>) => {
        set(state => ({
          notes: state.notes.map(n =>
            n.id === noteId
              ? {
                  ...n,
                  stickyNotes: n.stickyNotes.map(s => (s.id === stickyId ? { ...s, ...updates } : s)),
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        }));
      },

      deleteStickyNote: (noteId: string, stickyId: string) => {
        set(state => ({
          notes: state.notes.map(n =>
            n.id === noteId
              ? {
                  ...n,
                  stickyNotes: n.stickyNotes.filter(s => s.id !== stickyId),
                  updatedAt: new Date().toISOString(),
                }
              : n,
          ),
        }));
      },

      togglePinStickyNote: (noteId: string, stickyId: string) => {
        set(state => ({
          notes: state.notes.map(n => {
            if (n.id !== noteId) return n;
            return {
              ...n,
              stickyNotes: n.stickyNotes.map(s => {
                if (s.id !== stickyId) return s;
                const nextPinned = !s.isPinnedToScreen;
                const winWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;
                const winHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
                const defaultPos = nextPinned
                  ? {
                      x: Math.min(winWidth - 260, Math.max(20, Math.random() * 300 + 100)),
                      y: Math.min(winHeight - 260, Math.max(100, Math.random() * 200 + 100)),
                    }
                  : s.position;
                return {
                  ...s,
                  isPinnedToScreen: nextPinned,
                  position: defaultPos,
                };
              }),
            };
          }),
        }));
      },

      updateStickyPosition: (stickyId: string, position: { x: number; y: number }) => {
        set(state => ({
          notes: state.notes.map(n => ({
            ...n,
            stickyNotes: n.stickyNotes.map(s => (s.id === stickyId ? { ...s, position } : s)),
          })),
        }));
      },

      moveStickyNoteToNote: (stickyId: string, sourceNoteId: string, targetNoteId: string) => {
        const state = get();
        const sourceNote = state.notes.find(n => n.id === sourceNoteId);
        if (!sourceNote) return;

        const targetSticky = sourceNote.stickyNotes.find(s => s.id === stickyId);
        if (!targetSticky) return;

        const updatedSticky = { ...targetSticky, noteId: targetNoteId, isPinnedToScreen: false };

        set(s => ({
          notes: s.notes.map(n => {
            if (n.id === sourceNoteId) {
              return { ...n, stickyNotes: n.stickyNotes.filter(st => st.id !== stickyId) };
            }
            if (n.id === targetNoteId) {
              return { ...n, stickyNotes: [...n.stickyNotes, updatedSticky] };
            }
            return n;
          }),
        }));
      },

      toggleNotepadOpen: () => {
        const state = get();
        const anyOpen = state.notes.some(n => n.isOpen);
        if (anyOpen) {
          // Close all notes that aren't pinned
          set(s => ({
            notes: s.notes.map(n => (n.isPinned ? n : { ...n, isOpen: false })),
          }));
        } else {
          // If no notes exist, create one. Otherwise open all.
          if (state.notes.length === 0) {
            get().createNote();
          } else {
            set(s => ({
              notes: s.notes.map(n => ({ ...n, isOpen: true })),
            }));
          }
        }
      },

      setCalendarOpen: (isOpen: boolean) => set({ isCalendarOpen: isOpen }),
      setSearchModalOpen: (isOpen: boolean) => set({ isSearchModalOpen: isOpen }),

      snoozeAlert: (targetId: string, type: 'note' | 'sticky', minutes: number) => {
        const newAlertTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        set(state => ({
          notes: state.notes.map(n => {
            if (type === 'note' && n.id === targetId) {
              return { ...n, alertAt: newAlertTime, isAlertTriggered: false };
            }
            if (type === 'sticky') {
              return {
                ...n,
                stickyNotes: n.stickyNotes.map(s =>
                  s.id === targetId ? { ...s, alertAt: newAlertTime, isAlertTriggered: false } : s,
                ),
              };
            }
            return n;
          }),
        }));
      },

      dismissAlert: (targetId: string, type: 'note' | 'sticky') => {
        set(state => ({
          notes: state.notes.map(n => {
            if (type === 'note' && n.id === targetId) {
              return { ...n, alertAt: undefined, isAlertTriggered: false };
            }
            if (type === 'sticky') {
              return {
                ...n,
                stickyNotes: n.stickyNotes.map(s =>
                  s.id === targetId ? { ...s, alertAt: undefined, isAlertTriggered: false } : s,
                ),
              };
            }
            return n;
          }),
        }));
      },
    }),
    {
      name: 'leadweave_notepad_store',
      partialize: state => ({
        notes: state.notes,
      }),
    },
  ),
);
