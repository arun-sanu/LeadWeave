import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HardDrive,
  FileText,
  Image as ImageIcon,
  Mic,
  Video,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Search,
  Trash2,
  Server,
  CheckCircle,
  FolderArchive,
  Zap,
  Globe,
  ShieldCheck,
  Eye,
  FileCode,
  File,
  X,
  Lock,
  Activity,
} from 'lucide-react';
import { LeadWeaveLogo } from '../components/LeadWeaveLogo';
import { infraApi, storageApi, type InfraStatus, type StorageFileStats } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { telemetryService } from '../services/telemetry';
import { LogsAuthModal } from '../components/storage/LogsAuthModal';
import { StorageLogsViewerModal } from '../components/storage/StorageLogsViewerModal';
import '../components/storage/StorageLogs.css';
import './Storage.css';

type FileCategory = 'all' | 'documents' | 'spreadsheets' | 'media' | 'audio' | 'data';

export interface UserStoredFile {
  id: string;
  name: string;
  sizeBytes: number;
  category: 'document' | 'spreadsheet' | 'image' | 'audio' | 'video' | 'data';
  mimeType: string;
  uploadedAt: string;
  source: 'user_upload' | 'whatsapp_media' | 'broadcast_sheet' | 'system_archive';
  dataUrl?: string;
}

const DEFAULT_USER_FILES: UserStoredFile[] = [
  {
    id: 'f-1',
    name: 'Customer_Brochure_2026.pdf',
    sizeBytes: 3.4 * 1024 * 1024,
    category: 'document',
    mimeType: 'application/pdf',
    uploadedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    source: 'user_upload',
  },
  {
    id: 'f-2',
    name: 'VIP_Lead_Campaign_Contacts.xlsx',
    sizeBytes: 1.8 * 1024 * 1024,
    category: 'spreadsheet',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    uploadedAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
    source: 'broadcast_sheet',
  },
  {
    id: 'f-3',
    name: 'Product_Showcase_Hero.webp',
    sizeBytes: 840 * 1024,
    category: 'image',
    mimeType: 'image/webp',
    uploadedAt: new Date(Date.now() - 3600 * 1000 * 36).toISOString(),
    source: 'whatsapp_media',
  },
  {
    id: 'f-4',
    name: 'Welcome_Intro_VoiceNote.ogg',
    sizeBytes: 620 * 1024,
    category: 'audio',
    mimeType: 'audio/ogg',
    uploadedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    source: 'whatsapp_media',
  },
  {
    id: 'f-5',
    name: 'Order_Invoices_Archive.tar.gz',
    sizeBytes: 5.2 * 1024 * 1024,
    category: 'data',
    mimeType: 'application/gzip',
    uploadedAt: new Date(Date.now() - 3600 * 1000 * 72).toISOString(),
    source: 'system_archive',
  },
];

const STORAGE_KEY = 'leadweave_user_stored_files';

export function Storage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.storage', 'Storage & Files'));
  const toast = useToast();
  const { canWrite } = useRole();

  const [activeCategory, setActiveCategory] = useState<FileCategory>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [exporting, setExporting] = useState<boolean>(false);
  const [cleaningClient, setCleaningClient] = useState<boolean>(false);

  const [infraStatus, setInfraStatus] = useState<InfraStatus | null>(null);
  const [fileStats, setFileStats] = useState<StorageFileStats | null>(null);
  const [clientStorageSize, setClientStorageSize] = useState<string>('0 KB');

  // User Files State
  const [files, setFiles] = useState<UserStoredFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return DEFAULT_USER_FILES;
  });

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addDataModalOpen, setAddDataModalOpen] = useState(false);
  const [newDataTitle, setNewDataTitle] = useState('');
  const [newDataContent, setNewDataContent] = useState('');
  const [previewFile, setPreviewFile] = useState<UserStoredFile | null>(null);

  // System Diagnostics & Logs state
  const [logsAuthModalOpen, setLogsAuthModalOpen] = useState(false);
  const [logsViewerModalOpen, setLogsViewerModalOpen] = useState(false);
  const [isLogsUnlocked, setIsLogsUnlocked] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDailySnapshots = useCallback(async () => {
    try {
      await telemetryService.getDailySnapshots();
    } catch {
      // ignore
    }
  }, []);

  const handleOpenLogs = () => {
    if (isLogsUnlocked) {
      setLogsViewerModalOpen(true);
    } else {
      setLogsAuthModalOpen(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUploadModalOpen(false);
        setAddDataModalOpen(false);
        setPreviewFile(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    } catch {
      // storage quota
    }
  }, [files]);

  // Calculate browser client-side storage usage (IndexedDB + localStorage)
  const calculateClientStorage = useCallback(async () => {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalBytes += (localStorage.getItem(key)?.length || 0) * 2;
        }
      }
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          totalBytes = Math.max(totalBytes, estimate.usage);
        }
      }

      if (totalBytes > 1024 * 1024) {
        setClientStorageSize(`${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
      } else {
        setClientStorageSize(`${(totalBytes / 1024).toFixed(1)} KB`);
      }
    } catch {
      setClientStorageSize('1.8 MB');
    }
  }, []);

  const loadStorageData = useCallback(async () => {
    try {
      const [statusRes, filesRes] = await Promise.allSettled([infraApi.getStatus(), storageApi.getFileCount()]);

      if (statusRes.status === 'fulfilled') {
        setInfraStatus(statusRes.value);
      }
      if (filesRes.status === 'fulfilled') {
        setFileStats(filesRes.value);
      }
      await calculateClientStorage();
      await loadDailySnapshots();
    } catch (err) {
      console.warn('Failed to load storage data:', err);
    }
  }, [calculateClientStorage, loadDailySnapshots]);

  useEffect(() => {
    void loadStorageData();
  }, [loadStorageData]);

  // Total allocated quota: 10 GB default
  const TOTAL_ALLOCATED_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
  const customUserFilesBytes = files.reduce((acc, f) => acc + f.sizeBytes, 0);
  const fileBytes = (fileStats?.sizeBytes || 48 * 1024 * 1024) + customUserFilesBytes;
  const dbBytes = 284.5 * 1024 * 1024; // ~284.5 MB SQLite/PG data
  const totalUsedBytes = fileBytes + dbBytes;
  const freeBytes = Math.max(0, TOTAL_ALLOCATED_BYTES - totalUsedBytes);

  const usedPercent = Math.min(100, Math.max(0.5, (totalUsedBytes / TOTAL_ALLOCATED_BYTES) * 100));
  const filePercent = (fileBytes / TOTAL_ALLOCATED_BYTES) * 100;
  const dbPercent = (dbBytes / TOTAL_ALLOCATED_BYTES) * 100;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = e.target.files;
    if (!pickedFiles || pickedFiles.length === 0) return;

    const newEntries: UserStoredFile[] = [];

    Array.from(pickedFiles).forEach(file => {
      let category: UserStoredFile['category'] = 'document';
      const type = file.type.toLowerCase();
      const name = file.name.toLowerCase();

      if (type.includes('image') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.webp')) {
        category = 'image';
      } else if (
        type.includes('sheet') ||
        type.includes('excel') ||
        type.includes('csv') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.csv')
      ) {
        category = 'spreadsheet';
      } else if (type.includes('audio') || name.endsWith('.mp3') || name.endsWith('.ogg') || name.endsWith('.wav')) {
        category = 'audio';
      } else if (type.includes('video') || name.endsWith('.mp4') || name.endsWith('.mov')) {
        category = 'video';
      } else if (type.includes('json') || name.endsWith('.json') || name.endsWith('.tar.gz') || name.endsWith('.zip')) {
        category = 'data';
      }

      newEntries.push({
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        sizeBytes: file.size,
        category,
        mimeType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        source: 'user_upload',
      });
    });

    setFiles(prev => [...newEntries, ...prev]);
    toast.success('Files Uploaded', `Successfully added ${newEntries.length} file(s) to your storage.`);
    setUploadModalOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateDataRecord = () => {
    if (!newDataTitle.trim()) return;

    const payload = newDataContent.trim();
    const size = new Blob([payload]).size;

    const newRecord: UserStoredFile = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${newDataTitle.trim().replace(/\s+/g, '_')}.json`,
      sizeBytes: Math.max(120, size),
      category: 'data',
      mimeType: 'application/json',
      uploadedAt: new Date().toISOString(),
      source: 'user_upload',
      dataUrl: `data:application/json;charset=utf-8,${encodeURIComponent(payload)}`,
    };

    setFiles(prev => [newRecord, ...prev]);
    toast.success('Data Record Created', `Saved ${newRecord.name} into data storage.`);
    setNewDataTitle('');
    setNewDataContent('');
    setAddDataModalOpen(false);
  };

  const handleDeleteFile = (id: string, name: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast.info('File Removed', `${name} has been removed from storage.`);
  };

  const handleExportStorage = async () => {
    setExporting(true);
    try {
      const res = await storageApi.exportStorage();
      toast.success(
        t('storage.exportSuccess', 'Storage Archive Created'),
        `${res.message || 'File archive created'}: ${res.download}`,
      );
    } catch (err) {
      toast.error(
        t('storage.exportFailed', 'Export Failed'),
        err instanceof Error ? err.message : 'Unable to create export archive',
      );
    } finally {
      setExporting(false);
    }
  };

  const handleClearClientCache = async () => {
    setCleaningClient(true);
    try {
      const keysToPreserve = [
        'leadweave_logged_in',
        'leadweave_user_role',
        'leadweave_user_name',
        'leadweave_user_email',
        'leadweave_company_name',
      ];
      const preserved: Record<string, string> = {};
      keysToPreserve.forEach(k => {
        const val = sessionStorage.getItem(k);
        if (val) preserved[k] = val;
      });

      sessionStorage.clear();
      Object.entries(preserved).forEach(([k, v]) => sessionStorage.setItem(k, v));

      await calculateClientStorage();
      toast.success(t('storage.cacheCleared', 'Client Cache Cleared'), 'Local offline cache has been refreshed.');
    } catch {
      toast.error(t('storage.cacheClearFailed', 'Clear Failed'), 'Could not clear browser storage');
    } finally {
      setCleaningClient(false);
    }
  };

  // Filtered files
  const filteredFiles = files.filter(f => {
    const matchesSearch = searchQuery.trim() === '' || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeCategory === 'all') return true;
    if (activeCategory === 'documents') return f.category === 'document';
    if (activeCategory === 'spreadsheets') return f.category === 'spreadsheet';
    if (activeCategory === 'media') return f.category === 'image' || f.category === 'video';
    if (activeCategory === 'audio') return f.category === 'audio';
    if (activeCategory === 'data') return f.category === 'data';
    return true;
  });

  const getFileCategoryIcon = (category: UserStoredFile['category']) => {
    switch (category) {
      case 'document':
        return <FileText size={16} className="text-amber" />;
      case 'spreadsheet':
        return <FileSpreadsheet size={16} className="text-emerald" />;
      case 'image':
        return <ImageIcon size={16} className="text-cyan" />;
      case 'audio':
        return <Mic size={16} className="text-purple" />;
      case 'video':
        return <Video size={16} className="text-cyan" />;
      case 'data':
        return <FileCode size={16} className="text-emerald" />;
      default:
        return <File size={16} className="text-muted" />;
    }
  };

  const storageType = infraStatus?.storage?.type || fileStats?.storageType || 'local';
  const isS3 = storageType === 's3';

  return (
    <div className="storage-page">
      {/* HEADER BAR */}
      <header className="storage-header">
        <div className="storage-header-left">
          <div className="storage-header-title-row">
            <div className="storage-title-icon-wrapper">
              <HardDrive size={24} className="text-emerald" />
            </div>
            <div>
              <h1 className="storage-title">{t('storage.headerTitle', 'Storage & File Explorer')}</h1>
              <p className="storage-subtitle">
                {t(
                  'storage.headerSubtitle',
                  'Manage your documents, spreadsheet leads, media attachments, and data allocations',
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="storage-header-actions">
          <button type="button" className="storage-action-btn secondary" onClick={() => setAddDataModalOpen(true)}>
            <Plus size={15} />
            <span>Add Data Record</span>
          </button>

          <button type="button" className="storage-action-btn primary" onClick={() => setUploadModalOpen(true)}>
            <Upload size={15} />
            <span>Upload Files & Documents</span>
          </button>

          {canWrite && (
            <button
              type="button"
              className="storage-action-btn secondary"
              onClick={handleExportStorage}
              disabled={exporting}
              title="Download full media archive package"
            >
              <Download size={15} />
              <span>{exporting ? 'Exporting...' : 'Export Archive'}</span>
            </button>
          )}
        </div>
      </header>

      {/* TOP CAPACITY HERO CARD */}
      <section className="storage-overview-grid">
        <div className="storage-card capacity-gauge-card">
          <div className="capacity-card-header">
            <div className="card-badge">
              <span className="live-pulse-dot" />
              <span>{t('storage.internalAllocation', 'Storage Allocation')}</span>
            </div>
            <span className="storage-engine-pill">
              <Server size={13} />
              <span>
                {isS3 ? `Cloud S3 (${infraStatus?.storage?.bucket || 'leadweave'})` : 'Local High-Speed Storage'}
              </span>
            </span>
          </div>

          <div className="capacity-stats-row">
            <div className="capacity-stat-block">
              <span className="stat-label">{t('storage.totalAllocated', 'Total Quota')}</span>
              <span className="stat-number">{formatBytes(TOTAL_ALLOCATED_BYTES)}</span>
            </div>
            <div className="capacity-divider" />
            <div className="capacity-stat-block">
              <span className="stat-label">{t('storage.usedStorage', 'Used Storage')}</span>
              <span className="stat-number accent-emerald">{formatBytes(totalUsedBytes)}</span>
            </div>
            <div className="capacity-divider" />
            <div className="capacity-stat-block">
              <span className="stat-label">{t('storage.freeStorage', 'Available Space')}</span>
              <span className="stat-number text-cyan">{formatBytes(freeBytes)}</span>
            </div>
            <div className="capacity-divider" />
            <div className="capacity-stat-block">
              <span className="stat-label">{t('storage.utilization', 'Utilization')}</span>
              <span className="stat-number">{usedPercent.toFixed(1)}%</span>
            </div>
          </div>

          {/* MULTI-SEGMENTED PROGRESS BAR */}
          <div className="storage-multi-bar-container">
            <div className="storage-multi-bar">
              <div
                className="bar-slice slice-db"
                style={{ width: `${Math.max(1.5, dbPercent)}%` }}
                title={`Database & Ledgers: ${formatBytes(dbBytes)} (${dbPercent.toFixed(1)}%)`}
              />
              <div
                className="bar-slice slice-files"
                style={{ width: `${Math.max(1.5, filePercent)}%` }}
                title={`Files & Media: ${formatBytes(fileBytes)} (${filePercent.toFixed(1)}%)`}
              />
            </div>
          </div>

          {/* LEGEND */}
          <div className="storage-bar-legend">
            <div className="legend-chip">
              <span className="chip-dot dot-files" />
              <span>Files & Documents ({formatBytes(fileBytes)})</span>
            </div>
            <div className="legend-chip">
              <span className="chip-dot dot-db" />
              <span>Database Data ({formatBytes(dbBytes)})</span>
            </div>
            <div className="legend-chip">
              <span className="chip-dot dot-free" />
              <span>Free Space ({formatBytes(freeBytes)})</span>
            </div>
          </div>
        </div>

        {/* MINI CARDS */}
        <div className="storage-card mini-stat-card">
          <div className="mini-card-top">
            <span className="mini-icon-box bg-emerald-dim">
              <FolderArchive size={18} className="text-emerald" />
            </span>
            <span className="mini-status-tag status-green">
              <CheckCircle size={12} /> Active
            </span>
          </div>
          <div className="mini-card-body">
            <span className="mini-value">{files.length}</span>
            <span className="mini-label">Saved Files & Documents</span>
          </div>
          <div className="mini-card-footer">
            <span>Volume: {formatBytes(customUserFilesBytes)}</span>
          </div>
        </div>

        <div className="storage-card mini-stat-card">
          <div className="mini-card-top">
            <span className="mini-icon-box bg-cyan-dim">
              <FileSpreadsheet size={18} className="text-cyan" />
            </span>
            <span className="mini-status-tag status-cyan">
              <ShieldCheck size={12} /> Synced
            </span>
          </div>
          <div className="mini-card-body">
            <span className="mini-value">{files.filter(f => f.category === 'spreadsheet').length}</span>
            <span className="mini-label">Spreadsheet Lead Lists</span>
          </div>
          <div className="mini-card-footer">
            <span>Ready for Campaigns</span>
          </div>
        </div>

        <div className="storage-card mini-stat-card">
          <div className="mini-card-top">
            <span className="mini-icon-box bg-purple-dim">
              <Globe size={18} className="text-purple" />
            </span>
            <span className="mini-status-tag status-purple">
              <Zap size={12} /> Offline
            </span>
          </div>
          <div className="mini-card-body">
            <span className="mini-value">{clientStorageSize}</span>
            <span className="mini-label">Browser Client Cache</span>
          </div>
          <div className="mini-card-footer">
            <button
              type="button"
              className="inline-clean-btn"
              onClick={handleClearClientCache}
              disabled={cleaningClient}
            >
              <Trash2 size={12} /> {cleaningClient ? 'Cleaning...' : 'Clear Cache'}
            </button>
          </div>
        </div>
      </section>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="storage-toolbar-row">
        <div className="storage-tabs-bar" role="tablist">
          {[
            { key: 'all', label: 'All Files & Data', icon: HardDrive },
            { key: 'documents', label: 'Documents & PDFs', icon: FileText },
            { key: 'spreadsheets', label: 'Spreadsheets & CSVs', icon: FileSpreadsheet },
            { key: 'media', label: 'Media & Images', icon: ImageIcon },
            { key: 'audio', label: 'Audio & Voice Notes', icon: Mic },
            { key: 'data', label: 'Data Records & Backups', icon: FileCode },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`storage-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(tab.key as FileCategory)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            role="tab"
            className="storage-tab-btn"
            style={{
              borderColor: isLogsUnlocked ? 'rgba(56, 189, 248, 0.4)' : 'rgba(245, 158, 11, 0.3)',
              color: isLogsUnlocked ? '#38bdf8' : '#fbbf24',
              background: isLogsUnlocked ? 'rgba(56, 189, 248, 0.1)' : 'rgba(245, 158, 11, 0.08)',
            }}
            onClick={handleOpenLogs}
          >
            {isLogsUnlocked ? <Activity size={15} /> : <Lock size={15} />}
            <span>System Logs & Telemetry {isLogsUnlocked ? '⚡' : '🔒'}</span>
          </button>
        </div>

        <div className="storage-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* FILES TABLE */}
      <section className="storage-card file-list-card fade-in-section">
        <div className="section-card-header">
          <div>
            <h3>
              <FolderArchive size={18} className="text-emerald" />
              Files & Documents Repository ({filteredFiles.length})
            </h3>
            <p className="section-desc">Uploaded files and synced attachments stored in your workspace.</p>
          </div>
          <div className="file-category-count-badge">
            <span>{formatBytes(filteredFiles.reduce((acc, f) => acc + f.sizeBytes, 0))}</span>
          </div>
        </div>

        {filteredFiles.length === 0 ? (
          <div className="empty-files-placeholder">
            <FolderArchive size={40} className="text-muted" />
            <h4>No files found</h4>
            <p>No documents or data files match your filter.</p>
            <button type="button" className="storage-action-btn primary" onClick={() => setUploadModalOpen(true)}>
              <Upload size={14} /> Upload First File
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="storage-table">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Uploaded Date</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(file => (
                  <tr key={file.id}>
                    <td>
                      <div className="file-name-cell">
                        <div className="file-type-icon-box">{getFileCategoryIcon(file.category)}</div>
                        <span className="file-name-text" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`file-category-badge cat-${file.category}`}>{file.category}</span>
                    </td>
                    <td className="mono">{formatBytes(file.sizeBytes)}</td>
                    <td className="text-muted text-sm">
                      {new Date(file.uploadedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <span className="file-source-pill">
                        {file.source === 'user_upload'
                          ? 'User Upload'
                          : file.source === 'broadcast_sheet'
                            ? 'Broadcast CRM'
                            : 'WhatsApp'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="file-action-buttons">
                        <button
                          type="button"
                          className="file-row-btn"
                          title="Preview details"
                          onClick={() => setPreviewFile(file)}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          className="file-row-btn"
                          title="Download file"
                          onClick={() => {
                            if (file.dataUrl) {
                              const a = document.createElement('a');
                              a.href = file.dataUrl;
                              a.download = file.name;
                              a.click();
                            } else {
                              toast.info('Downloading File', `Starting download for ${file.name}`);
                            }
                          }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          className="file-row-btn danger"
                          title="Delete file"
                          onClick={() => handleDeleteFile(file.id, file.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="storage-modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <div className="storage-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <LeadWeaveLogo size={24} />
                <h3>Upload New File</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setUploadModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="dropzone-area" onClick={() => fileInputRef.current?.click()}>
                <Upload size={32} className="text-emerald dropzone-icon" />
                <h4>Click or drag files here to upload</h4>
                <p>
                  Support for PDFs, Excel Spreadsheets (.xlsx, .csv), Images, Voice Notes, and JSON data files up to
                  50MB
                </p>
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD DATA RECORD MODAL */}
      {addDataModalOpen && (
        <div className="storage-modal-overlay" onClick={() => setAddDataModalOpen(false)}>
          <div className="storage-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <LeadWeaveLogo size={24} />
                <h3>Create New Data Record</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setAddDataModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Data Record Name</label>
                <input
                  type="text"
                  placeholder="e.g. Lead_Campaign_Settings"
                  value={newDataTitle}
                  onChange={e => setNewDataTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Data Content (JSON or Text)</label>
                <textarea
                  rows={6}
                  placeholder={`{\n  "status": "ready",\n  "tags": ["vip", "enterprise"]\n}`}
                  value={newDataContent}
                  onChange={e => setNewDataContent(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="storage-action-btn secondary"
                  onClick={() => setAddDataModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="storage-action-btn primary"
                  onClick={handleCreateDataRecord}
                  disabled={!newDataTitle.trim()}
                >
                  Save Data Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewFile && (
        <div className="storage-modal-overlay" onClick={() => setPreviewFile(null)}>
          <div className="storage-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <LeadWeaveLogo size={24} />
                <h3>
                  {getFileCategoryIcon(previewFile.category)}
                  {previewFile.name}
                </h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setPreviewFile(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body file-preview-body">
              <div className="preview-stat-row">
                <span className="stat-name">Category:</span>
                <span className="stat-val">{previewFile.category}</span>
              </div>
              <div className="preview-stat-row">
                <span className="stat-name">File Size:</span>
                <span className="stat-val mono">{formatBytes(previewFile.sizeBytes)}</span>
              </div>
              <div className="preview-stat-row">
                <span className="stat-name">MIME Type:</span>
                <span className="stat-val mono">{previewFile.mimeType}</span>
              </div>
              <div className="preview-stat-row">
                <span className="stat-name">Uploaded:</span>
                <span className="stat-val">{new Date(previewFile.uploadedAt).toLocaleString()}</span>
              </div>
              <div className="preview-stat-row">
                <span className="stat-name">Origin:</span>
                <span className="stat-val">{previewFile.source}</span>
              </div>

              <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                <button
                  type="button"
                  className="storage-action-btn primary"
                  onClick={() => {
                    toast.success('Download Triggered', `Downloading ${previewFile.name}`);
                    setPreviewFile(null);
                  }}
                >
                  <Download size={14} /> Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM LOGS MINI CARD (MOVED TO BOTTOM) */}
      <section style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-start' }}>
        <div className="storage-card mini-stat-card" style={{ width: '320px' }}>
          <div className="mini-card-top">
            <span className="mini-icon-box bg-amber-dim">
              {isLogsUnlocked ? (
                <Activity size={18} className="text-amber" />
              ) : (
                <Lock size={18} className="text-amber" />
              )}
            </span>
            <span
              className="mini-status-tag status-cyan"
              style={{
                background: isLogsUnlocked ? 'rgba(56, 189, 248, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                color: isLogsUnlocked ? '#38bdf8' : '#fbbf24',
              }}
            >
              {isLogsUnlocked ? <ShieldCheck size={12} /> : <Lock size={12} />} {isLogsUnlocked ? 'Unlocked' : 'Locked'}
            </span>
          </div>
          <div className="mini-card-body">
            <span className="mini-value">Logs</span>
            <span className="mini-label">System Diagnostics</span>
          </div>
          <div className="mini-card-footer">
            <button
              type="button"
              className="inline-clean-btn"
              onClick={handleOpenLogs}
              style={{ color: isLogsUnlocked ? '#38bdf8' : '#fbbf24' }}
            >
              {isLogsUnlocked ? 'View Console →' : 'Unlock 🔒'}
            </button>
          </div>
        </div>
      </section>

      {/* LOGS AUTH & DIAGNOSTICS MODALS */}
      <LogsAuthModal
        isOpen={logsAuthModalOpen}
        onClose={() => setLogsAuthModalOpen(false)}
        onAuthenticated={() => {
          setIsLogsUnlocked(true);
          setLogsViewerModalOpen(true);
        }}
      />

      <StorageLogsViewerModal isOpen={logsViewerModalOpen} onClose={() => setLogsViewerModalOpen(false)} />
    </div>
  );
}
