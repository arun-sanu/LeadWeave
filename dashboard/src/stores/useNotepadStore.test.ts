import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatNoteDate, getNoteDisplayName, type Note } from './useNotepadStore.ts';

describe('Notepad Store Helpers', () => {
  it('formats ISO dates correctly', () => {
    const iso = '2026-09-10T08:45:00.000Z';
    const formatted = formatNoteDate(iso);
    assert.ok(formatted.includes('2026-09-10'));
  });

  it('generates fallback title when custom title is empty', () => {
    const note: Note = {
      id: 'test-1',
      title: '',
      content: 'hello world',
      createdAt: '2026-09-10T08:45:00.000Z',
      updatedAt: '2026-09-10T08:45:00.000Z',
      isOpen: true,
      isPinned: false,
      position: { x: 100, y: 100 },
      stickyNotes: [],
    };

    const displayName = getNoteDisplayName(note, 0);
    assert.ok(displayName.startsWith('Note 1 (2026-09-10'));
  });

  it('uses custom title when provided', () => {
    const note: Note = {
      id: 'test-2',
      title: 'Meeting Notes',
      content: 'discuss API',
      createdAt: '2026-09-10T08:45:00.000Z',
      updatedAt: '2026-09-10T08:45:00.000Z',
      isOpen: true,
      isPinned: false,
      position: { x: 100, y: 100 },
      stickyNotes: [],
    };

    const displayName = getNoteDisplayName(note, 1);
    assert.equal(displayName, 'Meeting Notes');
  });
});
