import React, { useState, useMemo } from 'react';
import { Search, Plus, Pin, PinOff, Trash2, X, ExternalLink, FileText, Share2, Bell } from 'lucide-react';
import { useNotepadStore, getNoteDisplayName, formatNoteDate } from '../../stores/useNotepadStore';
import { LeadWeaveLogo } from '../LeadWeaveLogo';
import { NotepadShareModal } from './NotepadShareModal';

interface NotepadSearchModalProps {
  onClose: () => void;
}

export const NotepadSearchModal: React.FC<NotepadSearchModalProps> = ({ onClose }) => {
  const { notes, createNote, openNote, closeNote, deleteNote, togglePinNote } = useNotepadStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'open' | 'pinned' | 'reminders'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [shareNoteTarget, setShareNoteTarget] = useState<{ title?: string; content: string } | null>(null);

  // Filter & Search Logic
  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => {
        // Category Filter
        if (filterCategory === 'open' && !note.isOpen) return false;
        if (filterCategory === 'pinned' && !note.isPinned) return false;
        if (filterCategory === 'reminders' && !note.alertAt) return false;

        // Search Query Filter (Title, Content, and Sticky Notes Content)
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const titleMatch = (note.title || '').toLowerCase().includes(q);
        const contentMatch = (note.content || '').toLowerCase().includes(q);
        const stickyMatch = note.stickyNotes.some(s => s.content.toLowerCase().includes(q));
        return titleMatch || contentMatch || stickyMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sortBy === 'title') return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
        return 0;
      });
  }, [notes, searchQuery, filterCategory, sortBy]);

  const counts = useMemo(() => {
    return {
      all: notes.length,
      open: notes.filter(n => n.isOpen).length,
      pinned: notes.filter(n => n.isPinned).length,
      reminders: notes.filter(n => n.alertAt).length,
    };
  }, [notes]);

  const handleCreateWithTitle = () => {
    const newId = createNote(searchQuery.trim() || undefined);
    openNote(newId);
    onClose();
  };

  return (
    <div
      className="notepad-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notes Search and Manager"
    >
      <div className="notepad-search-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="notepad-search-header">
          <div className="notepad-search-brand" style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '4px' }}>
            <LeadWeaveLogo size={24} />
          </div>

          <div className="notepad-search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="notepad-search-input"
              placeholder="Search across 100s of notes by title or text..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              autoFocus
              aria-label="Search notes"
            />
            {searchQuery && (
              <button
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="notepad-btn-add"
              onClick={handleCreateWithTitle}
              title="Create New Note"
            >
              <Plus size={15} />
              <span>New Note</span>
            </button>
            <button className="notepad-modal-close" onClick={onClose} aria-label="Close search manager">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Sorting bar */}
        <div className="notepad-search-toolbar">
          <div className="notepad-filter-pills">
            <button
              className={`filter-pill ${filterCategory === 'all' ? 'active' : ''}`}
              onClick={() => setFilterCategory('all')}
            >
              All ({counts.all})
            </button>
            <button
              className={`filter-pill ${filterCategory === 'open' ? 'active' : ''}`}
              onClick={() => setFilterCategory('open')}
            >
              Open ({counts.open})
            </button>
            <button
              className={`filter-pill ${filterCategory === 'pinned' ? 'active' : ''}`}
              onClick={() => setFilterCategory('pinned')}
            >
              Pinned ({counts.pinned})
            </button>
            <button
              className={`filter-pill ${filterCategory === 'reminders' ? 'active' : ''}`}
              onClick={() => setFilterCategory('reminders')}
            >
              Reminders ({counts.reminders})
            </button>
          </div>

          <div className="notepad-sort-wrapper">
            <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Sort:</span>
            <select
              className="notepad-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Sort notes"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Notes Catalog List */}
        <div className="notepad-catalog-list">
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note, idx) => {
              const displayName = getNoteDisplayName(note, idx);
              const previewText = note.content || '(Empty note content)';
              const hasStickies = note.stickyNotes.length > 0;

              return (
                <div
                  key={note.id}
                  className={`notepad-catalog-card ${note.isOpen ? 'is-open' : ''}`}
                  onClick={() => {
                    openNote(note.id);
                    onClose();
                  }}
                >
                  <div className="catalog-card-header">
                    <div className="catalog-card-title-group">
                      <FileText size={16} color="#38bdf8" />
                      <span className="catalog-card-title">{displayName}</span>
                      {note.isOpen && <span className="badge-open">Open Window</span>}
                      {note.isPinned && <span className="badge-pinned">📌 Pinned</span>}
                      {note.alertAt && (
                        <span className="badge-alert" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Bell size={11} color="#facc15" fill="#facc15" />
                          <span>Alert</span>
                        </span>
                      )}
                    </div>

                    <div className="catalog-card-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className="catalog-btn-icon"
                        onClick={() => setShareNoteTarget({ title: note.title, content: note.content })}
                        title="Share Note to WhatsApp Chats or LAN Members"
                        aria-label="Share note"
                      >
                        <Share2 size={14} color="#38bdf8" />
                      </button>

                      <button
                        className="catalog-btn-icon"
                        onClick={() => togglePinNote(note.id)}
                        title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
                        aria-label={note.isPinned ? 'Unpin note' : 'Pin note'}
                      >
                        {note.isPinned ? <Pin size={14} color="#38bdf8" /> : <PinOff size={14} />}
                      </button>

                      {note.isOpen ? (
                        <button
                          className="catalog-btn-icon"
                          onClick={() => closeNote(note.id)}
                          title="Close Window"
                          aria-label="Close window"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <button
                          className="catalog-btn-icon"
                          onClick={() => openNote(note.id)}
                          title="Open Window"
                          aria-label="Open note window"
                        >
                          <ExternalLink size={14} color="#38bdf8" />
                        </button>
                      )}

                      <button
                        className="catalog-btn-icon danger"
                        onClick={() => deleteNote(note.id)}
                        title="Delete Note"
                        aria-label="Delete note"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <p className="catalog-card-snippet">{previewText}</p>

                  <div className="catalog-card-footer">
                    <span className="catalog-card-date">{formatNoteDate(note.createdAt)}</span>
                    {hasStickies && (
                      <span className="catalog-card-stickies">
                        {note.stickyNotes.length} Sticky Note{note.stickyNotes.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="notepad-catalog-empty">
              <FileText size={36} color="#52525b" />
              <h3>No notes found</h3>
              <p>
                {searchQuery
                  ? `No notes matching "${searchQuery}". Click below to create one!`
                  : 'You have no saved notes yet.'}
              </p>
              <button className="notepad-btn-add" onClick={handleCreateWithTitle}>
                <Plus size={15} />
                <span>Create "{searchQuery || 'New Note'}"</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {shareNoteTarget && (
        <NotepadShareModal
          type="note"
          title={shareNoteTarget.title}
          content={shareNoteTarget.content}
          onClose={() => setShareNoteTarget(null)}
        />
      )}
    </div>
  );
};

