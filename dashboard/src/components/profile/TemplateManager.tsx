import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, FileText, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { type MessageTemplate, type TemplatePayload } from '../../services/api';
import { useRole } from '../../hooks/useRole';
import { useToast } from '../../hooks/useToast';
import {
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useSessionsQuery,
  useTemplatesQuery,
  useAccountTemplatesQuery,
  useUpdateTemplateMutation,
} from '../../hooks/queries';
import { Modal } from '../../components/Modal';
import { copyToClipboard } from '../../utils/clipboard';
import './TemplateManager.css';

type TemplateForm = {
  name: string;
  header: string;
  body: string;
  footer: string;
};

const emptyForm: TemplateForm = {
  name: '',
  header: '',
  body: '',
  footer: '',
};

function extractPlaceholders(template: TemplateForm | MessageTemplate) {
  const source = [template.header, template.body, template.footer].filter(Boolean).join('\n');
  return Array.from(new Set(Array.from(source.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g), match => match[1]))).sort();
}

function toPayload(form: TemplateForm): TemplatePayload {
  return {
    name: form.name.trim(),
    header: form.header.trim() || null,
    body: form.body.trim(),
    footer: form.footer.trim() || null,
  };
}

function renderPreview(template: TemplateForm, values: Record<string, string>) {
  return [template.header, template.body, template.footer]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, key: string) => values[key] || `{{${key}}}`);
}

export function TemplateManager() {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const { data: sessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const [selectedSessionId, setSelectedSessionId] = useState('all');
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageTemplate | null>(null);
  const toast = useToast();
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  const sessionIds = useMemo(() => sessions.map(s => s.id), [sessions]);
  const { data: accountTemplates = [], isLoading: loadingAccount } = useAccountTemplatesQuery(sessionIds, selectedSessionId === 'all');
  const { data: singleTemplates = [], isLoading: loadingSingle } = useTemplatesQuery(
    selectedSessionId,
    selectedSessionId !== 'all' && !!selectedSessionId,
  );
  const templates = selectedSessionId === 'all' ? accountTemplates : singleTemplates;
  const loadingTemplates = selectedSessionId === 'all' ? loadingAccount : loadingSingle;

  const createMutation = useCreateTemplateMutation();
  const updateMutation = useUpdateTemplateMutation();
  const deleteMutation = useDeleteTemplateMutation();

  const placeholders = useMemo(() => extractPlaceholders(form), [form]);
  const preview = useMemo(() => renderPreview(form, previewValues), [form, previewValues]);
  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter(template =>
      [template.name, template.header, template.body, template.footer]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(query)),
    );
  }, [searchTerm, templates]);
  const isSaving = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    setPreviewValues(current => {
      const next: Record<string, string> = {};
      for (const key of placeholders) {
        next[key] = current[key] || '';
      }
      return next;
    });
  }, [placeholders]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingTemplate(null);
    setPreviewValues({});
  };

  const openEdit = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setForm({
      name: template.name,
      header: template.header || '',
      body: template.body,
      footer: template.footer || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    const targetSessions = (selectedSessionId === 'all' || !selectedSessionId)
      ? sessions
      : sessions.filter(s => s.id === selectedSessionId);

    if (targetSessions.length === 0) return;

    try {
      if (editingTemplate) {
        await Promise.allSettled(
          targetSessions.map(s =>
            updateMutation.mutateAsync({
              sessionId: s.id,
              id: editingTemplate.id,
              data: toPayload(form),
            }),
          ),
        );
        toast.success(t('templates.toasts.updated'));
      } else {
        await Promise.allSettled(
          targetSessions.map(s =>
            createMutation.mutateAsync({
              sessionId: s.id,
              data: toPayload(form),
            }),
          ),
        );
        toast.success(t('templates.toasts.created'));
      }
      resetForm();
    } catch (err) {
      toast.error(
        t(editingTemplate ? 'templates.toasts.updateFailed' : 'templates.toasts.createFailed', {
          message: err instanceof Error ? err.message : t('common.unknownError'),
        }),
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetSessions = (selectedSessionId === 'all' || !selectedSessionId)
      ? sessions
      : sessions.filter(s => s.id === selectedSessionId);

    try {
      await Promise.allSettled(
        targetSessions.map(s =>
          deleteMutation.mutateAsync({ sessionId: s.id, id: deleteTarget.id }),
        ),
      );
      toast.success(t('templates.toasts.deleted'));
      if (editingTemplate?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        t('templates.toasts.deleteFailed', {
          message: err instanceof Error ? err.message : t('common.unknownError'),
        }),
      );
    }
  };

  const copyName = async (name: string) => {
    if (await copyToClipboard(name)) {
      toast.success(t('templates.toasts.copied'));
    }
  };

  if (loadingSessions) {
    return (
      <div className="templates-page templates-loading">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="templates-page">
      <div className="cyber-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{t('templates.title')}</h2>
          <p>{t('templates.subtitle')}</p>
        </div>
        <select
          className="templates-session-select"
          aria-label={t('templates.sessionSelect')}
          value={selectedSessionId}
          onChange={event => {
            setSelectedSessionId(event.target.value);
            resetForm();
          }}
          style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#fff', border: '1px solid #334155', borderRadius: '6px', padding: '6px 12px' }}
        >
          {sessions.length === 0 && <option value="">{t('templates.noSessions')}</option>}
          {sessions.length > 0 && <option value="all">All Account Sessions (Universal Templates)</option>}
          {sessions.map(session => (
            <option key={session.id} value={session.id}>
              {session.name}{session.phone ? ` (${session.phone})` : ''}
            </option>
          ))}
        </select>
      </div>

      {sessions.length === 0 ? (
        <div className="templates-empty-page">
          <FileText size={48} strokeWidth={1} />
          <h3>{t('templates.empty.noSessionsTitle')}</h3>
          <p>{t('templates.empty.noSessionsDesc')}</p>
        </div>
      ) : (
        <div className="templates-workspace">
          <aside className="templates-library">
            <div className="templates-library-header">
              <div>
                <h2>{t('templates.savedTitle')}</h2>
                <span>{t('templates.count', { count: templates.length })}</span>
              </div>
              <button className="btn-primary templates-new-btn" onClick={resetForm} disabled={!canWrite}>
                <Plus size={16} />
                {t('templates.newTemplate')}
              </button>
            </div>

            <div className="templates-search">
              <Search size={16} />
              <input
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                placeholder={t('common.search')}
              />
            </div>

            {loadingTemplates ? (
              <div className="templates-loading-inline">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : templates.length === 0 ? (
              <div className="templates-empty-list">
                <FileText size={40} strokeWidth={1} />
                <h3>{t('templates.empty.title')}</h3>
                <p>{t('templates.empty.description')}</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="templates-empty-list compact">
                <Search size={32} strokeWidth={1.5} />
                <h3>{t('templates.empty.title')}</h3>
              </div>
            ) : (
              <div className="template-list" role="list">
                {filteredTemplates.map(template => {
                  const templatePlaceholders = extractPlaceholders(template);
                  const isSelected = editingTemplate?.id === template.id;
                  return (
                    <button
                      key={template.id}
                      className={`template-list-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => openEdit(template)}
                      type="button"
                    >
                      <span className="template-list-title">{template.name}</span>
                      <span className="template-list-body">{template.body}</span>
                      <span className="template-list-meta">
                        {templatePlaceholders.length > 0
                          ? templatePlaceholders.map(key => `{{${key}}}`).join(' ')
                          : t('templates.noPlaceholders')}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="template-workspace-area">
            <div className="template-editor-header">
              <div className="template-view-toggle">
                <button 
                  className={viewMode === 'edit' ? 'active' : ''} 
                  onClick={() => setViewMode('edit')}
                  type="button"
                >
                  {t('common.edit', 'Edit')}
                </button>
                <button 
                  className={viewMode === 'preview' ? 'active' : ''} 
                  onClick={() => setViewMode('preview')}
                  type="button"
                >
                  {t('common.preview', 'Preview')}
                </button>
              </div>
              <div className="template-header-actions">
                {editingTemplate && (
                  <button
                    className="icon-btn"
                    title={t('templates.actions.copyName')}
                    onClick={() => void copyName(editingTemplate.name)}
                    type="button"
                  >
                    <Copy size={16} />
                  </button>
                )}
                {editingTemplate && canWrite && (
                  <button
                    className="icon-btn danger"
                    title={t('common.delete')}
                    onClick={() => setDeleteTarget(editingTemplate)}
                    type="button"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            {viewMode === 'edit' ? (
            <div className="template-form">
              <div className="form-group">
                <label htmlFor="tpl-1">{t('common.name')}</label>
                <input
                  id="tpl-1"
                  value={form.name}
                  onChange={event => setForm({ ...form, name: event.target.value })}
                  placeholder={t('templates.namePlaceholder')}
                  disabled={!canWrite}
                />
              </div>

              <div className="template-message-fields">
                <div className="form-group">
                  <label htmlFor="tpl-2">{t('templates.header')}</label>
                  <input
                    id="tpl-2"
                    value={form.header}
                    onChange={event => setForm({ ...form, header: event.target.value })}
                    placeholder={t('templates.headerPlaceholder')}
                    disabled={!canWrite}
                  />
                </div>

                <div className="form-group body-field">
                  <label htmlFor="tpl-3">{t('templates.body')}</label>
                  <textarea
                    id="tpl-3"
                    value={form.body}
                    onChange={event => setForm({ ...form, body: event.target.value })}
                    placeholder={t('templates.bodyPlaceholder')}
                    rows={10}
                    disabled={!canWrite}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tpl-4">{t('templates.footer')}</label>
                  <input
                    id="tpl-4"
                    value={form.footer}
                    onChange={event => setForm({ ...form, footer: event.target.value })}
                    placeholder={t('templates.footerPlaceholder')}
                    disabled={!canWrite}
                  />
                </div>
              </div>

              <div className="template-editor-actions">
                <button className="btn-secondary" onClick={resetForm} disabled={isSaving} type="button">
                  {t('common.cancel')}
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSave}
                  disabled={!canWrite || isSaving || !selectedSessionId || !form.name.trim() || !form.body.trim()}
                  type="button"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                  {canWrite
                    ? t(editingTemplate ? 'templates.saveChanges' : 'templates.createTemplate')
                    : t('templates.viewOnly')}
                </button>
              </div>
            </div>
            ) : (
            <div className="template-preview-container">
              <div className="template-preview-header">
                <h2>{t('templates.previewTitle')}</h2>
                <span>{placeholders.length}</span>
              </div>
              <div className="template-preview-message">
                <pre>{preview || t('templates.previewEmpty')}</pre>
              </div>
              <div className="template-variable-panel">
                {placeholders.length > 0 ? (
                  <div className="placeholder-list">
                    {placeholders.map(key => (
                      <label key={key}>
                        <span>{`{{${key}}}`}</span>
                        <input
                          value={previewValues[key] || ''}
                          onChange={event => setPreviewValues({ ...previewValues, [key]: event.target.value })}
                          placeholder={t('templates.previewValuePlaceholder')}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="template-muted">{t('templates.noPlaceholders')}</p>
                )}
              </div>
            </div>
            )}
          </section>


        </div>
      )}

      {deleteTarget && (
        <Modal
          open
          onClose={() => setDeleteTarget(null)}
          title={t('templates.deleteTitle')}
          className="modal-sm"
          closeLabel={t('common.close')}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="btn-danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                {t('common.delete')}
              </button>
            </>
          }
        >
          <p>{t('templates.deleteConfirm', { name: deleteTarget.name })}</p>
        </Modal>
      )}
    </div>
  );
}
