import { useState } from 'react';
import { BroadcastExcel } from './BroadcastExcel';
import { GoogleSheetsCRM } from './GoogleSheetsCRM';
import { Database, TableProperties } from 'lucide-react';

export function AudienceDataSelection() {
  const [source, setSource] = useState<'local' | 'google_sheets'>('local');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem' }}>
      
      {/* Minimal Segmented Control */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.03)', padding: '0.25rem', borderRadius: '8px', alignSelf: 'flex-start', border: '1px solid var(--studio-border)', marginBottom: '0.5rem' }}>
        <button
          onClick={() => setSource('local')}
          style={{
            padding: '0.5rem 1rem',
            background: source === 'local' ? 'var(--primary-soft)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out)',
            color: source === 'local' ? 'var(--success)' : 'var(--text-secondary)',
            fontWeight: source === 'local' ? 600 : 500,
            fontSize: '0.8125rem'
          }}
        >
          <Database size={14} />
          <span>Paste & Upload</span>
        </button>

        <button
          onClick={() => setSource('google_sheets')}
          style={{
            padding: '0.5rem 1rem',
            background: source === 'google_sheets' ? 'var(--primary-soft)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            transition: 'background-color 150ms var(--ease-out), color 150ms var(--ease-out)',
            color: source === 'google_sheets' ? 'var(--success)' : 'var(--text-secondary)',
            fontWeight: source === 'google_sheets' ? 600 : 500,
            fontSize: '0.8125rem'
          }}
        >
          <TableProperties size={14} />
          <span>Google Sheets</span>
        </button>
      </div>

      <div className="source-content" style={{ animation: 'fadeIn 300ms var(--ease-out)' }}>
        {source === 'local' ? <BroadcastExcel /> : <GoogleSheetsCRM />}
      </div>
    </div>
  );
}
