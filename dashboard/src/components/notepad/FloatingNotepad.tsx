import React, { useState, useEffect } from 'react';
import { Plus, Pin, PinOff, Calendar, Search, X, Trash2, Bell, Clock, Palette, Share2 } from 'lucide-react';
import {
  useNotepadStore,
  PASTEL_COLORS,
  formatNoteDate,
  getNoteDisplayName,
  type PastelColor,
  type Note,
} from '../../stores/useNotepadStore';
import { NotepadCalendarModal } from './NotepadCalendarModal';
import { NotepadSearchModal } from './NotepadSearchModal';
import { NotepadShareModal } from './NotepadShareModal';
import { FloatingScreenStickyNotes } from './FloatingScreenStickyNotes';
import { LeadWeaveLogo } from '../LeadWeaveLogo';
import './FloatingNotepad.css';

const StickyNoteColorfulIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Back Blue Note */}
    <rect x="7" y="3" width="13" height="13" rx="1.5" fill="#BAE6FD" transform="rotate(8 13.5 9.5)" />
    {/* Middle Pink Note */}
    <rect x="3" y="6" width="13" height="13" rx="1.5" fill="#FBCFE8" transform="rotate(-6 9.5 12.5)" />
    {/* Top Yellow Post-It Note */}
    <rect x="5" y="5" width="14" height="14" rx="1.5" fill="#FEF08A" stroke="#FACC15" stroke-width="0.75" />
    {/* Folded Corner */}
    <path d="M14 14H19L14 19V14Z" fill="#EAB308" />
  </svg>
);

export const FloatingNotepad: React.FC = () => {
  const { notes, isCalendarOpen, setCalendarOpen, isSearchModalOpen, setSearchModalOpen, updateStickyNote } =
    useNotepadStore();

  // Background Alert Reminder Checker
  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();

      notes.forEach(note => {
        if (note.alertAt && new Date(note.alertAt).getTime() <= nowMs && !note.isAlertTriggered) {
          useNotepadStore.setState(s => ({
            notes: s.notes.map(n =>
              n.id === note.id ? { ...n, isAlertTriggered: true, isOpen: true, isPinned: true } : n,
            ),
          }));
        }

        note.stickyNotes.forEach(s => {
          if (s.alertAt && new Date(s.alertAt).getTime() <= nowMs && !s.isAlertTriggered) {
            updateStickyNote(note.id, s.id, { isAlertTriggered: true, isPinnedToScreen: true });
          }
        });
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [notes, updateStickyNote]);

  const openNotes = notes.filter(n => n.isOpen);

  return (
    <>
      <FloatingScreenStickyNotes />

      {/* Render each open Note in its own separate floating window */}
      {openNotes.map((note, index) => (
        <SingleNotepadWindow key={note.id} note={note} index={index} />
      ))}

      {isCalendarOpen && <NotepadCalendarModal onClose={() => setCalendarOpen(false)} />}
      {isSearchModalOpen && <NotepadSearchModal onClose={() => setSearchModalOpen(false)} />}
    </>
  );
};

interface SingleNotepadWindowProps {
  note: Note;
  index: number;
}

const SingleNotepadWindow: React.FC<SingleNotepadWindowProps> = ({ note, index }) => {
  const {
    createNote,
    deleteNote,
    closeNote,
    updateNoteTitle,
    updateNoteContent,
    togglePinNote,
    setNotePosition,
    setNoteAlert,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    togglePinStickyNote,
    moveStickyNoteToNote,
    setCalendarOpen,
    setSearchModalOpen,
    snoozeAlert,
    dismissAlert,
  } = useNotepadStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [alertMenuOpenNoteId, setAlertMenuOpenNoteId] = useState<string | null>(null);
  const [colorPickerStickyId, setColorPickerStickyId] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'note' | 'sticky'; title?: string; content: string } | null>(
    null,
  );

  const windowPos = note.position || { x: 100 + index * 30, y: 90 + index * 30 };
  const displayName = getNoteDisplayName(note, index);

  // Drag handle logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if (
      (e.target as HTMLElement).closest('.notepad-navbar-actions') ||
      (e.target as HTMLElement).tagName === 'BUTTON'
    ) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - windowPos.x,
      y: e.clientY - windowPos.y,
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = Math.max(10, Math.min(window.innerWidth - 300, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 150, e.clientY - dragOffset.y));
    setNotePosition(note.id, { x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      className={`floating-notepad-window ${note.isPinned ? 'pinned' : ''} ${isDragOver ? 'drag-over' : ''}`}
      style={{
        left: `${windowPos.x}px`,
        top: `${windowPos.y}px`,
      }}
      onDragOver={e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={e => {
        e.preventDefault();
        setIsDragOver(false);
        try {
          const rawData = e.dataTransfer.getData('text/plain');
          if (rawData) {
            const data = JSON.parse(rawData);
            if (data.stickyId && data.sourceNoteId && data.sourceNoteId !== note.id) {
              moveStickyNoteToNote(data.stickyId, data.sourceNoteId, note.id);
            }
          }
        } catch {
          // ignore invalid drop payload
        }
      }}
    >
      {/* Window Navbar Header */}
      <div
        className="notepad-navbar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div className="notepad-navbar-brand">
          <LeadWeaveLogo size={18} />
          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </span>
          {note.isPinned && (
            <span
              style={{
                fontSize: '10px',
                background: 'rgba(56, 189, 248, 0.2)',
                color: '#38bdf8',
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              Pinned
            </span>
          )}
        </div>

        <div className="notepad-navbar-actions">
          {/* Search & Catalog All Notes Button */}
          <button
            className="notepad-btn-icon"
            onClick={() => setSearchModalOpen(true)}
            title="Search & Browse All Notes (100s)"
            aria-label="Search and browse notes"
          >
            <Search size={15} />
          </button>

          {/* New Separate Window Button */}
          <button
            className="notepad-btn-icon"
            onClick={() => createNote()}
            title="Open New Separate Notepad Window"
            aria-label="New notepad window"
          >
            <Plus size={16} />
          </button>

          {/* Pin Toggle */}
          <button
            className={`notepad-btn-icon ${note.isPinned ? 'active' : ''}`}
            onClick={() => togglePinNote(note.id)}
            title={note.isPinned ? 'Unpin Window' : 'Pin Window on Top Across Pages'}
            aria-label={note.isPinned ? 'Unpin window' : 'Pin window to stay on top'}
            aria-pressed={note.isPinned}
          >
            {note.isPinned ? <Pin size={15} /> : <PinOff size={15} />}
          </button>

          {/* Calendar Button */}
          <button
            className="notepad-btn-icon"
            onClick={() => setCalendarOpen(true)}
            title="Notepad Calendar & Reminders"
            aria-label="Notepad calendar"
          >
            <Calendar size={15} />
          </button>

          {/* Share Note Button */}
          <button
            className="notepad-btn-icon"
            onClick={() => setShareTarget({ type: 'note', title: note.title, content: note.content })}
            title="Share Note to WhatsApp Chats or LAN Members"
            aria-label="Share note"
          >
            <Share2 size={15} />
          </button>

          {/* Delete / Close Window Button */}
          <button
            className="notepad-btn-icon"
            onClick={() => closeNote(note.id)}
            title="Close Window"
            aria-label="Close notepad window"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Triggered Alert Notification Banner */}
      {note.isAlertTriggered && (
        <div className="notepad-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Bell size={15} color="#facc15" fill="#facc15" />
            <span>
              Reminder: <strong>{displayName}</strong>
            </span>
          </div>
          <div className="alert-banner-actions">
            <button className="alert-btn" onClick={() => snoozeAlert(note.id, 'note', 15)}>
              Remind in 15m
            </button>
            <button className="alert-btn" onClick={() => dismissAlert(note.id, 'note')}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Note Body */}
      <div className="notepad-body">
        {/* Header: Timestamp + Title Input */}
        <div className="note-header-meta">
          <div className="note-timestamp-badge">
            <Clock size={12} />
            <span>{formatNoteDate(note.createdAt)}</span>
          </div>

          <div className="note-title-input-row">
            <input
              type="text"
              className="note-title-input"
              placeholder="Enter note title..."
              value={note.title}
              onChange={e => updateNoteTitle(note.id, e.target.value)}
              aria-label="Note title"
            />
            <button
              className={`notepad-btn-icon ${note.alertAt ? 'active' : ''}`}
              onClick={() => setAlertMenuOpenNoteId(alertMenuOpenNoteId === note.id ? null : note.id)}
              title="Set Reminder Alert"
              aria-label="Set reminder"
              style={note.alertAt ? { color: '#facc15', background: 'rgba(250, 204, 21, 0.15)' } : {}}
            >
              <Bell size={15} color="#facc15" fill={note.alertAt ? '#facc15' : 'none'} />
            </button>

            <button
              className="notepad-btn-icon"
              onClick={() => deleteNote(note.id)}
              title="Delete Note"
              aria-label="Delete note"
              style={{ color: '#ef4444' }}
            >
              <Trash2 size={15} />
            </button>
          </div>

          {/* Quick Alert Setter Popup */}
          {alertMenuOpenNoteId === note.id && (
            <div
              style={{
                background: '#27272a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
              }}
              role="dialog"
              aria-label="Set Alert Reminder"
            >
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>Set Alert Date & Time:</span>
              <input
                type="datetime-local"
                value={note.alertAt ? note.alertAt.substring(0, 16) : ''}
                onChange={e => {
                  if (e.target.value) {
                    setNoteAlert(note.id, new Date(e.target.value).toISOString());
                  } else {
                    setNoteAlert(note.id, undefined);
                  }
                  setAlertMenuOpenNoteId(null);
                }}
                style={{
                  background: '#18181b',
                  color: '#ffffff',
                  border: '1px solid #3f3f46',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                }}
                aria-label="Reminder datetime"
              />
              {note.alertAt && (
                <button
                  onClick={() => {
                    setNoteAlert(note.id, undefined);
                    setAlertMenuOpenNoteId(null);
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  Clear Reminder
                </button>
              )}
            </div>
          )}
        </div>

        {/* Note Textarea */}
        <textarea
          className="note-textarea"
          placeholder="Write your note here..."
          value={note.content}
          onChange={e => updateNoteContent(note.id, e.target.value)}
          aria-label="Note content"
        />

        {/* Sticky Notes Section */}
        <div className="sticky-section">
          <div className="sticky-section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <button
                className="notepad-btn-icon"
                onClick={() => addStickyNote(note.id)}
                title="Add Colorful Sticky Note"
                aria-label="Add sticky note"
                style={{
                  background: 'rgba(254, 249, 195, 0.15)',
                  border: '1px solid rgba(250, 204, 21, 0.35)',
                  padding: '3px 5px',
                  borderRadius: '6px',
                }}
              >
                <StickyNoteColorfulIcon size={18} />
              </button>
            </div>
          </div>

          {/* Grid of Sticky Notes inside note */}
          {note.stickyNotes.length > 0 ? (
            <div className="sticky-notes-grid">
              {note.stickyNotes.map(sticky => {
                const colorScheme = PASTEL_COLORS[sticky.color] || PASTEL_COLORS.yellow;
                const isColorOpen = colorPickerStickyId === sticky.id;

                return (
                  <div
                    key={sticky.id}
                    className="pastel-sticky-card"
                    draggable={true}
                    onDragStart={e => {
                      e.dataTransfer.setData(
                        'text/plain',
                        JSON.stringify({ stickyId: sticky.id, sourceNoteId: note.id }),
                      );
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    style={{
                      backgroundColor: colorScheme.bg,
                      borderColor: colorScheme.border,
                      color: colorScheme.text,
                      cursor: 'grab',
                    }}
                    title="Drag and drop onto any note window to move"
                  >
                    <div className="pastel-sticky-header">
                      <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
                        {sticky.isPinnedToScreen ? '📌 Pinned' : ''}
                      </span>
                      <div className="pastel-sticky-actions">
                        {/* Color Change Toggle */}
                        <button
                          className={`sticky-action-btn ${isColorOpen ? 'active' : ''}`}
                          onClick={() => setColorPickerStickyId(isColorOpen ? null : sticky.id)}
                          title="Change Sticky Color"
                          aria-label="Change color"
                          aria-pressed={isColorOpen}
                          style={{ color: colorScheme.text }}
                        >
                          <Palette size={12} />
                        </button>

                        {/* Color Change Popover */}
                        {isColorOpen && (
                          <div className="card-color-popover">
                            {(Object.keys(PASTEL_COLORS) as PastelColor[]).map(cKey => (
                              <button
                                key={cKey}
                                className={`card-color-dot ${sticky.color === cKey ? 'active' : ''}`}
                                style={{
                                  backgroundColor: PASTEL_COLORS[cKey].bg,
                                  borderColor: sticky.color === cKey ? '#ffffff' : 'rgba(0, 0, 0, 0.2)',
                                  boxShadow: sticky.color === cKey ? `0 0 0 2px ${PASTEL_COLORS[cKey].ring}` : 'none',
                                }}
                                onClick={() => {
                                  updateStickyNote(note.id, sticky.id, { color: cKey });
                                  setColorPickerStickyId(null);
                                }}
                                aria-label={`Set color to ${PASTEL_COLORS[cKey].name}`}
                              />
                            ))}
                          </div>
                        )}

                        {/* Pin to Screen toggle */}
                        <button
                          className={`sticky-action-btn ${sticky.isPinnedToScreen ? 'active' : ''}`}
                          onClick={() => togglePinStickyNote(note.id, sticky.id)}
                          title={sticky.isPinnedToScreen ? 'Unpin from Screen' : 'Pin to Screen'}
                          aria-label={sticky.isPinnedToScreen ? 'Unpin sticky note' : 'Pin sticky note to screen'}
                          aria-pressed={sticky.isPinnedToScreen}
                          style={{ color: colorScheme.text }}
                        >
                          <Pin size={12} />
                        </button>

                        {/* Share Sticky to LAN Members */}
                        <button
                          className="sticky-action-btn"
                          onClick={() => setShareTarget({ type: 'sticky', content: sticky.content })}
                          title="Share Sticky Note with LAN Members"
                          aria-label="Share sticky note with LAN members"
                          style={{ color: colorScheme.text }}
                        >
                          <Share2 size={12} />
                        </button>

                        {/* Delete Sticky */}
                        <button
                          className="sticky-action-btn"
                          onClick={() => deleteStickyNote(note.id, sticky.id)}
                          title="Delete Sticky Note"
                          aria-label="Delete sticky note"
                          style={{ color: colorScheme.text }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="pastel-sticky-textarea"
                      style={{ color: colorScheme.text }}
                      placeholder="Type a sticky note..."
                      value={sticky.content}
                      onChange={e => updateStickyNote(note.id, sticky.id, { content: e.target.value })}
                      aria-label="Sticky note content"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {shareTarget && (
        <NotepadShareModal
          type={shareTarget.type}
          title={shareTarget.title}
          content={shareTarget.content}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
};
