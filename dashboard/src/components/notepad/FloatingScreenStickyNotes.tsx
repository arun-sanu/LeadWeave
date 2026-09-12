import React, { useState, useRef } from 'react';
import { PinOff, Trash2, Share2 } from 'lucide-react';
import { useNotepadStore, PASTEL_COLORS, type StickyNote } from '../../stores/useNotepadStore';
import { NotepadShareModal } from './NotepadShareModal';

export const FloatingScreenStickyNotes: React.FC = () => {
  const { notes, updateStickyNote, togglePinStickyNote, updateStickyPosition, deleteStickyNote } = useNotepadStore();
  const [shareStickyContent, setShareStickyContent] = useState<string | null>(null);

  // Find all sticky notes that are pinned to the screen
  const screenPinnedStickyNotes: Array<{ sticky: StickyNote; noteId: string }> = [];
  notes.forEach(n => {
    n.stickyNotes.forEach(s => {
      if (s.isPinnedToScreen) {
        screenPinnedStickyNotes.push({ sticky: s, noteId: n.id });
      }
    });
  });

  if (screenPinnedStickyNotes.length === 0) return null;

  return (
    <>
      {screenPinnedStickyNotes.map(({ sticky, noteId }) => (
        <DraggableScreenStickyCard
          key={sticky.id}
          sticky={sticky}
          noteId={noteId}
          onUpdate={updates => updateStickyNote(noteId, sticky.id, updates)}
          onUnpin={() => togglePinStickyNote(noteId, sticky.id)}
          onDelete={() => deleteStickyNote(noteId, sticky.id)}
          onUpdatePos={pos => updateStickyPosition(sticky.id, pos)}
          onShare={() => setShareStickyContent(sticky.content)}
        />
      ))}

      {shareStickyContent !== null && (
        <NotepadShareModal type="sticky" content={shareStickyContent} onClose={() => setShareStickyContent(null)} />
      )}
    </>
  );
};

interface DraggableScreenStickyCardProps {
  sticky: StickyNote;
  noteId: string;
  onUpdate: (updates: Partial<StickyNote>) => void;
  onUnpin: () => void;
  onDelete: () => void;
  onUpdatePos: (pos: { x: number; y: number }) => void;
  onShare: () => void;
}

const DraggableScreenStickyCard: React.FC<DraggableScreenStickyCardProps> = ({
  sticky,
  onUpdate,
  onUnpin,
  onDelete,
  onUpdatePos,
  onShare,
}) => {
  const colorScheme = PASTEL_COLORS[sticky.color] || PASTEL_COLORS.yellow;
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const position = sticky.position || { x: 100, y: 150 };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).tagName === 'BUTTON') {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = Math.max(10, Math.min(window.innerWidth - 240, e.clientX - dragOffset.x));
    const newY = Math.max(10, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y));
    onUpdatePos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div
      ref={cardRef}
      className="floating-screen-sticky pastel-sticky-card"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        backgroundColor: colorScheme.bg,
        border: `1px solid ${colorScheme.border}`,
        color: colorScheme.text,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="screen-sticky-badge">
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📌 Pinned</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Card Swatch Color Selector */}
          <div className="card-color-swatch-bar">
            {(Object.keys(PASTEL_COLORS) as Array<keyof typeof PASTEL_COLORS>).map(cKey => (
              <button
                key={cKey}
                className={`mini-swatch-btn ${sticky.color === cKey ? 'active' : ''}`}
                style={{
                  background: PASTEL_COLORS[cKey].bg,
                  borderColor: sticky.color === cKey ? '#ffffff' : 'rgba(0, 0, 0, 0.2)',
                  boxShadow: sticky.color === cKey ? `0 0 0 2px ${PASTEL_COLORS[cKey].ring}` : 'none',
                }}
                onClick={() => onUpdate({ color: cKey })}
                title={`Change to ${PASTEL_COLORS[cKey].name}`}
              />
            ))}
          </div>

          <button
            onClick={onShare}
            style={{
              background: 'transparent',
              border: 'none',
              color: colorScheme.text,
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Share Sticky Note with LAN members"
          >
            <Share2 size={13} />
          </button>

          <button
            onClick={onUnpin}
            style={{
              background: 'transparent',
              border: 'none',
              color: colorScheme.text,
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Unpin from Screen (Return to Note)"
          >
            <PinOff size={14} />
          </button>
          <button
            onClick={onDelete}
            style={{
              background: 'transparent',
              border: 'none',
              color: colorScheme.text,
              cursor: 'pointer',
              padding: '2px',
            }}
            title="Delete Sticky Note"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <textarea
        className="pastel-sticky-textarea"
        style={{ color: colorScheme.text }}
        placeholder="Type a sticky note..."
        value={sticky.content}
        onChange={e => onUpdate({ content: e.target.value })}
      />
    </div>
  );
};
