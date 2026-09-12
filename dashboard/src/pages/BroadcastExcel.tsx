import React, { useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSpreadsheetStore } from '../stores/useSpreadsheetStore';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Plus, Trash2, HelpCircle, FileSpreadsheet, Sparkles, Clipboard, Upload, ArrowRight } from 'lucide-react';
import { useToast } from '../hooks/useToast';
import { Modal } from '../components/Modal';

export function BroadcastExcel() {
  useDocumentTitle('Broadcast Data - LeadWeave');
  const { columns, setColumns, rows, setRows, updateCell, deleteRow, deleteColumn } = useSpreadsheetStore();
  const { success } = useToast();
  
  const [newColName, setNewColName] = useState('');
  const [isAddingCol, setIsAddingCol] = useState(false);
  const addColInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Column Mapping State
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [pendingParsedData, setPendingParsedData] = useState<{ headers: string[], data: string[][] } | null>(null);
  const [mappingPhoneIdx, setMappingPhoneIdx] = useState<number>(0);
  const [mappingNameIdx, setMappingNameIdx] = useState<number>(-1);

  // Virtualizer for high-performance spreadsheet rendering
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 42,
    overscan: 10,
    initialRect: { width: 800, height: 600 },
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  // Validate phone
  const validatePhone = (raw: string): { isValid: boolean; cleaned: string } => {
    const cleaned = raw.replace(/[^\d+]/g, '');
    const digitsOnly = cleaned.replace(/\+/g, '');
    const isValid = digitsOnly.length >= 8 && digitsOnly.length <= 15;
    return { isValid, cleaned };
  };

  const validContacts = useMemo(() => {
    return rows.filter(r => validatePhone(r.phone).isValid).length;
  }, [rows]);

  const processPasteString = (pasteData: string) => {
    if (!pasteData || (!pasteData.includes('\t') && !pasteData.includes(','))) {
      return false; // Not a spreadsheet format
    }

    const delimiter = pasteData.includes('\t') ? '\t' : ',';
    const lines = pasteData.trim().split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length === 0) return false;

    // Detect if first line contains headers or phone data
    const firstLineCols = lines[0].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
    
    // Check if first line is headers
    const looksLikeHeader = firstLineCols.some(c => 
      ['phone', 'mobile', 'number', 'tel', 'whatsapp', 'name', 'recipient', 'contact'].some(k => c.toLowerCase().includes(k))
    );

    let parsedHeaders: string[];
    let dataLines: string[][];

    if (looksLikeHeader) {
      parsedHeaders = firstLineCols;
      dataLines = lines.slice(1).map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
    } else {
      parsedHeaders = ['Column_1', ...Array.from({ length: firstLineCols.length - 1 }, (_, i) => `Column_${i + 2}`)];
      dataLines = lines.map(l => l.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, '')));
    }

    // Guess indices
    const guessedPhoneIdx = parsedHeaders.findIndex(h => 
      ['phone', 'mobile', 'number', 'tel', 'whatsapp'].some(k => h.toLowerCase().includes(k))
    );
    const guessedNameIdx = parsedHeaders.findIndex(h => 
      ['name', 'recipient', 'contact', 'first name', 'full name'].some(k => h.toLowerCase().includes(k))
    );

    setMappingPhoneIdx(guessedPhoneIdx >= 0 ? guessedPhoneIdx : 0);
    setMappingNameIdx(guessedNameIdx);
    setPendingParsedData({ headers: parsedHeaders, data: dataLines });
    setMappingModalOpen(true);
    return true;
  };

  const handleConfirmMapping = () => {
    if (!pendingParsedData) return;
    const { headers, data } = pendingParsedData;

    // Generate custom columns
    const customCols: string[] = [];
    headers.forEach((h, idx) => {
      if (idx !== mappingPhoneIdx && idx !== mappingNameIdx) {
        customCols.push(h.replace(/[^a-zA-Z0-9_]/g, '').replace(/\s+/g, '_') || `Col_${idx}`);
      }
    });

    const finalCols = mappingNameIdx >= 0 ? ['name', ...customCols] : customCols;
    
    const newRows = data.map((line, idx) => {
      const rowObj: Record<string, string> = { 
        id: `row_${Date.now()}_${idx}`, 
        phone: line[mappingPhoneIdx] || '' 
      };
      
      if (mappingNameIdx >= 0) {
         rowObj['name'] = line[mappingNameIdx] || '';
      }

      let customColIdx = mappingNameIdx >= 0 ? 1 : 0;
      line.forEach((cell, i) => {
        if (i !== mappingPhoneIdx && i !== mappingNameIdx && customColIdx < finalCols.length) {
          rowObj[finalCols[customColIdx]] = cell;
          customColIdx++;
        }
      });
      return rowObj;
    }).filter(r => r.phone.length > 0);

    setColumns(finalCols);
    setRows(newRows);
    success(`Imported ${newRows.length} contacts with mapped fields`);
    setMappingModalOpen(false);
    setPendingParsedData(null);
  };

  // Clipboard TSV/CSV Paste Handler
  const handleSpreadsheetPaste = (e: React.ClipboardEvent) => {
    const pasteData = e.clipboardData.getData('text');
    if (processPasteString(pasteData)) {
      e.preventDefault();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const successParse = processPasteString(text);
        if (!successParse) {
          console.error('Could not parse the uploaded file. Please ensure it is a valid CSV or TSV format.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handlePasteClick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!processPasteString(text)) {
        if (text) {
          setRows([...rows, { id: `row_${Date.now()}`, phone: text.trim() }]);
          success('Added 1 contact from clipboard');
        }
      }
    } catch {
      alert('Could not read clipboard. Please press Ctrl+V to paste data instead.');
    }
  };

  const handleAddColumn = () => {
    const col = newColName.trim().replace(/\\s+/g, '');
    if (col && !columns.includes(col) && col.toLowerCase() !== 'phone') {
      setColumns([...columns, col]);
      setNewColName('');
      setIsAddingCol(false);
    }
  };

  return (
    <div className="studio-card-container" onPaste={handleSpreadsheetPaste}>
      <div className="studio-card-header-row">
        <div>
          <h2 className="studio-card-title">
            <FileSpreadsheet size={20} className="text-primary" />
            <span>Broadcast Recipient Grid</span>
          </h2>
          <p className="studio-card-subtitle">
            Upload a CSV, paste directly from Excel (<code>Ctrl+V</code>), or edit inline below.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'var(--primary-soft)', padding: '0.35rem 0.75rem', borderRadius: 20, border: '1px solid rgba(37, 211, 102, 0.3)', fontWeight: 600 }}>
            {rows.length} Contacts ({validContacts} Valid Phone{validContacts !== 1 ? 's' : ''})
          </span>

          {isAddingCol ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                ref={addColInputRef}
                type="text"
                className="form-control"
                placeholder="Column name..."
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddColumn()}
                style={{ width: 140, padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#0f172a' }}
                autoFocus
              />
              <button className="btn-tool btn-primary" onClick={handleAddColumn} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Add</button>
              <button className="btn-tool" onClick={() => setIsAddingCol(false)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Cancel</button>
            </div>
          ) : (
            <button className="btn-tool" onClick={() => setIsAddingCol(true)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', height: '28px' }}>
              <Plus size={14} />
              <span>Col</span>
            </button>
          )}

          <button className="btn-tool" onClick={() => setRows([...rows, { id: `row_${Date.now()}`, phone: '' }])} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', height: '28px' }}>
            <Plus size={14} />
            <span>Row</span>
          </button>

          <button className="btn-tool" onClick={handlePasteClick} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', height: '28px', background: 'rgba(255,255,255,0.05)' }}>
            <Clipboard size={14} />
            <span>Paste</span>
          </button>

          <button className="btn-tool btn-primary" onClick={() => document.getElementById('csv-upload-input')?.click()} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', height: '28px' }}>
            <Upload size={14} />
            <span>Upload CSV</span>
          </button>
          <input 
             type="file" 
             id="csv-upload-input" 
             accept=".csv,.txt,.tsv" 
             style={{ display: 'none' }} 
             onChange={handleFileUpload} 
          />
        </div>
      </div>

      <div className="spreadsheet-grid-wrapper" ref={tableContainerRef} style={{ maxHeight: '560px', overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
            <Sparkles size={40} color="#38bdf8" style={{ margin: '0 auto 1rem', opacity: 0.8 }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem' }}>No recipients in broadcast table</h3>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', maxWidth: 460, margin: '0 auto 1.5rem' }}>
              Click anywhere on this page and press <strong>Ctrl+V</strong> to paste data directly from your spreadsheet, or add a row manually.
            </p>
            <button className="btn-tool btn-primary" onClick={() => setRows([{ id: 'row_1', phone: '' }])} style={{ padding: '0.6rem 1.25rem' }}>
              <Plus size={16} />
              <span>Add First Row</span>
            </button>
          </div>
        ) : (
          <table className="spreadsheet-grid-table">
            <thead>
              <tr>
                <th style={{ width: '45px', textAlign: 'center', color: '#64748b' }}>#</th>
                <th style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Phone / WhatsApp</span>
                    <span title="Requires international format with country code (e.g., +1... or 1...).">
                      <HelpCircle size={13} color="#64748b" />
                    </span>
                  </div>
                </th>
                {columns.map(col => (
                  <th key={col} style={{ minWidth: '140px' }}>
                    <div className="spreadsheet-header-cell">
                      <span>{col}</span>
                      <button className="spreadsheet-header-del-btn" onClick={() => deleteColumn(col)} title={`Delete column ${col}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </th>
                ))}
                <th style={{ width: '45px', textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 50 ? (
                <>
                  {paddingTop > 0 && (
                    <tr>
                      <td style={{ height: `${paddingTop}px`, padding: 0, border: 'none' }} colSpan={columns.length + 3} />
                    </tr>
                  )}
                  {virtualRows.map(virtualRow => {
                    const row = rows[virtualRow.index];
                    const idx = virtualRow.index;
                    const phoneValid = row.phone.length === 0 || validatePhone(row.phone).isValid;
                    return (
                      <tr key={row.id}>
                        <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{idx + 1}</td>
                        <td>
                          <input
                            type="text"
                            className={`spreadsheet-cell-input ${!phoneValid ? 'invalid-phone' : ''}`}
                            value={row.phone}
                            onChange={e => updateCell(row.id, 'phone', e.target.value)}
                            placeholder="+1234567890"
                          />
                        </td>
                        {columns.map(col => (
                          <td key={col}>
                            <input
                              type="text"
                              className="spreadsheet-cell-input"
                              value={row[col] || ''}
                              onChange={e => updateCell(row.id, col, e.target.value)}
                              placeholder="..."
                            />
                          </td>
                        ))}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="spreadsheet-header-del-btn"
                            style={{ opacity: 0.6, display: 'inline-flex' }}
                            onClick={() => deleteRow(row.id)}
                            title="Delete Row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td style={{ height: `${paddingBottom}px`, padding: 0, border: 'none' }} colSpan={columns.length + 3} />
                    </tr>
                  )}
                </>
              ) : (
                rows.map((row, idx) => {
                  const phoneValid = row.phone.length === 0 || validatePhone(row.phone).isValid;
                  return (
                    <tr key={row.id}>
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <input
                          type="text"
                          className={`spreadsheet-cell-input ${!phoneValid ? 'invalid-phone' : ''}`}
                          value={row.phone}
                          onChange={e => updateCell(row.id, 'phone', e.target.value)}
                          placeholder="+1234567890"
                        />
                      </td>
                      {columns.map(col => (
                        <td key={col}>
                          <input
                            type="text"
                            className="spreadsheet-cell-input"
                            value={row[col] || ''}
                            onChange={e => updateCell(row.id, col, e.target.value)}
                            placeholder="..."
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="spreadsheet-header-del-btn"
                          style={{ opacity: 0.6, display: 'inline-flex' }}
                          onClick={() => deleteRow(row.id)}
                          title="Delete Row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {mappingModalOpen && pendingParsedData && (
        <Modal
          open={mappingModalOpen}
          onClose={() => setMappingModalOpen(false)}
          title="Map Your Columns"
          className="standard-modal"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', lineHeight: 1.5 }}>
              We've analyzed your spreadsheet. Please confirm which columns correspond to the required fields. Any remaining columns will be imported as custom variables (e.g., <code>{"{{location}}"}</code>).
            </p>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Phone Number Column <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select 
                  className="form-control" 
                  aria-label="Phone Number Column"
                  value={mappingPhoneIdx} 
                  onChange={(e) => setMappingPhoneIdx(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  {pendingParsedData.headers.map((h, i) => (
                    <option key={i} value={i} disabled={i === mappingNameIdx}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Name Column <span style={{ color: '#94a3b8', fontWeight: 400 }}>(Optional)</span>
                </label>
                <select 
                  className="form-control" 
                  aria-label="Name Column"
                  value={mappingNameIdx} 
                  onChange={(e) => setMappingNameIdx(Number(e.target.value))}
                  style={{ width: '100%' }}
                >
                  <option value={-1}>-- None --</option>
                  {pendingParsedData.headers.map((h, i) => (
                    <option key={i} value={i} disabled={i === mappingPhoneIdx}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </div>

            </div>

            <div style={{ background: 'rgba(var(--success-rgb), 0.05)', border: '1px solid rgba(var(--success-rgb), 0.2)', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--success)', margin: 0, fontWeight: 500 }}>
                {pendingParsedData.headers.filter((_, i) => i !== mappingPhoneIdx && i !== mappingNameIdx).length} additional columns will be imported as custom variables.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn-tool" onClick={() => setMappingModalOpen(false)}>
                Cancel
              </button>
              <button className="btn-tool btn-primary" onClick={handleConfirmMapping} style={{ padding: '0.5rem 1rem' }}>
                <ArrowRight size={16} />
                <span>Confirm & Import</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
