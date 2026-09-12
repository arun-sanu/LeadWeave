import React, { useState } from 'react';
import { Calendar, Bell, X, Trash2, Clock } from 'lucide-react';
import { useNotepadStore, formatNoteDate, getNoteDisplayName } from '../../stores/useNotepadStore';

interface NotepadCalendarModalProps {
  onClose: () => void;
}

export const NotepadCalendarModal: React.FC<NotepadCalendarModalProps> = ({ onClose }) => {
  const { notes, setNoteAlert, updateStickyNote } = useNotepadStore();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');

  // Gather all reminders across notes and sticky notes
  const allReminders: Array<{
    id: string;
    type: 'note' | 'sticky';
    title: string;
    alertAt: string;
    noteId: string;
    stickyId?: string;
    color?: string;
  }> = [];

  notes.forEach((n, nIdx) => {
    if (n.alertAt) {
      allReminders.push({
        id: n.id,
        type: 'note',
        title: getNoteDisplayName(n, nIdx),
        alertAt: n.alertAt,
        noteId: n.id,
      });
    }

    n.stickyNotes.forEach(s => {
      if (s.alertAt) {
        allReminders.push({
          id: s.id,
          type: 'sticky',
          title: s.content
            ? s.content.substring(0, 25) + (s.content.length > 25 ? '...' : '')
            : `Sticky Note (${s.color})`,
          alertAt: s.alertAt,
          noteId: n.id,
          stickyId: s.id,
          color: s.color,
        });
      }
    });
  });

  const nowMs = Date.now();
  const sortedReminders = allReminders
    .filter(r => {
      const rTime = new Date(r.alertAt).getTime();
      if (filter === 'upcoming') return rTime >= nowMs;
      if (filter === 'past') return rTime < nowMs;
      return true;
    })
    .sort((a, b) => new Date(a.alertAt).getTime() - new Date(b.alertAt).getTime());

  const handleRemoveReminder = (r: (typeof allReminders)[0]) => {
    if (r.type === 'note') {
      setNoteAlert(r.noteId, undefined);
    } else if (r.stickyId) {
      updateStickyNote(r.noteId, r.stickyId, { alertAt: undefined });
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Notepad Calendar and Reminders"
    >
      <div
        style={{
          background: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          width: '440px',
          maxWidth: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          color: '#f4f4f5',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#27272a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
            <Calendar size={20} color="#38bdf8" />
            <span>Notepad Calendar & Reminders</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Controls */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '8px',
          }}
        >
          {(['all', 'upcoming', 'past'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'rgba(56, 189, 248, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                color: filter === f ? '#38bdf8' : '#94a3b8',
                border: filter === f ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                textTransform: 'capitalize',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List of Scheduled Reminders */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {sortedReminders.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              <Bell
                size={28}
                color="#facc15"
                fill="#facc15"
                style={{ margin: '0 auto 8px auto', display: 'block', opacity: 0.85 }}
              />
              No scheduled reminders found.
            </div>
          ) : (
            sortedReminders.map(r => {
              const isPast = new Date(r.alertAt).getTime() < Date.now();
              return (
                <div
                  key={r.id}
                  style={{
                    background: isPast ? 'rgba(30, 41, 59, 0.4)' : 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          background: r.type === 'note' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(250, 204, 21, 0.2)',
                          color: r.type === 'note' ? '#38bdf8' : '#facc15',
                        }}
                      >
                        {r.type === 'note' ? 'Note' : `Sticky Note (${r.color})`}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{r.title}</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: isPast ? '#ef4444' : '#34d399',
                      }}
                    >
                      <Clock size={12} />
                      <span>{formatNoteDate(r.alertAt)}</span>
                      {isPast && <span style={{ fontWeight: 700 }}>(Past Due)</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveReminder(r)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '6px',
                    }}
                    title="Delete Reminder"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
