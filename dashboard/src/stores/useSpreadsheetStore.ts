import { create } from 'zustand';

export type SpreadsheetRow = Record<string, string>;

export interface CampaignSpreadsheetState {
  columns: string[];
  rows: SpreadsheetRow[];
  setColumns: (columns: string[]) => void;
  setRows: (rows: SpreadsheetRow[]) => void;
  updateCell: (rowId: string, field: string, value: string) => void;
  deleteRow: (rowId: string) => void;
  deleteColumn: (colName: string) => void;
}

export const useSpreadsheetStore = create<CampaignSpreadsheetState>(set => ({
  columns: [],
  rows: [],
  setColumns: columns => set({ columns }),
  setRows: rows => set({ rows }),
  updateCell: (rowId, field, value) =>
    set(state => ({
      rows: state.rows.map(r => (r.id === rowId ? { ...r, [field]: value } : r)),
    })),
  deleteRow: rowId =>
    set(state => ({
      rows: state.rows.filter(r => r.id !== rowId),
    })),
  deleteColumn: colName =>
    set(state => ({
      columns: state.columns.filter(c => c !== colName),
      rows: state.rows.map(r => {
        const copy = { ...r };
        delete copy[colName];
        return copy;
      }),
    })),
}));
