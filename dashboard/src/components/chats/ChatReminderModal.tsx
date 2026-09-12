import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { useToast } from '../../hooks/useToast';
import { idbGet, idbSet } from '../../utils/indexedDbStore';
import type { Chat } from '../../services/api';
import type { NoticeTask } from '../../pages/NoticeBoard';

const STORAGE_KEY = 'leadweave_noticeboard_tasks';

interface ChatReminderModalProps {
  open: boolean;
  onClose: () => void;
  activeChat: Chat;
}

export function ChatReminderModal({ open, onClose, activeChat }: ChatReminderModalProps) {
  const { success, error: toastError } = useToast();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('10:00');
  const [type, setType] = useState<NoticeTask['type']>('followup');
  const [priority, setPriority] = useState<NoticeTask['priority']>('medium');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset form values when modal opens
  useEffect(() => {
    if (open && activeChat) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      setTitle(`Follow up with ${activeChat.name || activeChat.id}`);
      setDueDate(tomorrowStr);
      setDueTime('10:00');
      setType(activeChat.isGroup ? 'followup' : 'whatsapp');
      setPriority('medium');
      setNotes('');
    }
  }, [open, activeChat]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      toastError('Please fill in the required fields (Title and Due Date)');
      return;
    }

    setSubmitting(true);
    try {
      // Extract phone / JID clean display
      const contactPhone = activeChat.id.includes('@') ? activeChat.id.split('@')[0] : activeChat.id;

      const newTask: NoticeTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        contactName: activeChat.name || contactPhone,
        contactPhone: contactPhone,
        dueDate,
        dueTime: dueTime || '10:00',
        type,
        priority,
        notes: notes.trim() ? notes.trim() : undefined,
        completed: false,
        createdAt: new Date().toISOString(),
      };

      const existing = (await idbGet<NoticeTask[]>(STORAGE_KEY)) || [];
      const updated = [newTask, ...existing];
      await idbSet(STORAGE_KEY, updated);

      success(`Reminder saved for ${activeChat.name || contactPhone}! Added to Notice Board.`);
      onClose();
    } catch {
      toastError('Failed to save reminder to Notice Board');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>Set Chat Reminder</span>
        </div>
      }
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={submitting}
            style={{ fontSize: '0.8125rem', padding: '0.5rem 0.9rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={submitting}
            style={{ fontSize: '0.8125rem', padding: '0.5rem 0.9rem' }}
          >
            {submitting ? 'Saving...' : 'Save Reminder'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Title */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}
          >
            Reminder Title *
          </label>
          <input
            type="text"
            className="form-control"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Follow up on proposal"
            aria-label="Reminder Title"
            required
            autoFocus
            style={{ fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
          />
        </div>

        {/* Date & Time Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Due Date *
            </label>
            <input
              type="date"
              className="form-control"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              aria-label="Due Date"
              required
              style={{ fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Due Time
            </label>
            <input
              type="time"
              className="form-control"
              value={dueTime}
              onChange={e => setDueTime(e.target.value)}
              aria-label="Due Time"
              style={{ fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
            />
          </div>
        </div>

        {/* Type & Priority Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Action Type
            </label>
            <select
              className="form-control"
              value={type}
              onChange={e => setType(e.target.value as NoticeTask['type'])}
              aria-label="Action Type"
              style={{ width: '100%', fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
            >
              <option value="whatsapp">WhatsApp Message</option>
              <option value="call">Phone Call</option>
              <option value="followup">Follow-up Task</option>
              <option value="other">General Reminder</option>
            </select>
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '0.25rem',
              }}
            >
              Priority
            </label>
            <select
              className="form-control"
              value={priority}
              onChange={e => setPriority(e.target.value as NoticeTask['priority'])}
              aria-label="Priority"
              style={{ width: '100%', fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: '0.25rem',
            }}
          >
            Notes (Optional)
          </label>
          <textarea
            className="form-control"
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            aria-label="Notes"
            placeholder="Context or talking points..."
            style={{ width: '100%', resize: 'vertical', fontSize: '0.8125rem', padding: '0.55rem 0.75rem' }}
          />
        </div>
      </form>
    </Modal>
  );
}
