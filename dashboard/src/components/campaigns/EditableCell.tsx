import { useState, useEffect } from 'react';

export function EditableCell({ initialValue, onSave }: { initialValue: string; onSave: (val: string) => void }) {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        style={{ cursor: 'pointer', minHeight: '24px', display: 'flex', alignItems: 'center' }}
        title="Click to edit"
      >
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    );
  }

  return (
    <input
      autoFocus
      className="input"
      aria-label="Edit value"
      style={{ padding: '0.25rem 0.5rem', height: '28px', minWidth: '80px', fontSize: '0.8125rem' }}
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => {
        setIsEditing(false);
        if (value !== initialValue) onSave(value);
      }}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          setIsEditing(false);
          if (value !== initialValue) onSave(value);
        }
        if (e.key === 'Escape') {
          setIsEditing(false);
          setValue(initialValue);
        }
      }}
    />
  );
}
